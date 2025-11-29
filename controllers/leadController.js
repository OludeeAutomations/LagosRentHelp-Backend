const Lead = require("../models/Lead");
const Agent = require("../models/Agent");
const Property = require("../models/Property"); // Assuming you might need to check if property exists

// 1. Create a Lead
exports.createLead = async (req, res) => {
  try {
    const { agentId, type, propertyId } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!agentId || !type) {
      return res.status(400).json({
        success: false,
        error: "agentId and type are required",
      });
    }

    // Check if agent exists
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: "Agent not found",
      });
    }

    // ✅ FIXED: Check uniqueness based on User + Agent + Property (if property exists)
    // This allows a user to contact the same agent for DIFFERENT properties.
    const duplicateCheck = {
      agentId,
      userId,
      // If propertyId is provided, check specifically for this property.
      // If not provided (general inquiry), check where propertyId is null
      propertyId: propertyId || null,
    };

    const existingLead = await Lead.findOne(duplicateCheck);

    if (existingLead) {
      // Update the timestamp of the existing lead instead of creating a new one
      existingLead.timestamp = new Date();
      existingLead.message = `${type.toUpperCase()} contact re-initiated`;
      await existingLead.save();

      return res.status(200).json({
        success: true,
        data: existingLead,
        message: "Lead updated",
      });
    }

    // Create new lead
    const lead = new Lead({
      agentId,
      propertyId: propertyId || null,
      type,
      userId,
      message: `${type.toUpperCase()} contact initiated`,
      timestamp: new Date(),
    });

    await lead.save();

    // ✅ INCREMENT AGENT'S TOTAL LEADS COUNT
    const updatedAgent = await Agent.findByIdAndUpdate(
      agentId,
      { $inc: { totalLeads: 1 } },
      { new: true }
    );

    // console.log(`Agent ${agentId} totalLeads updated to:`, updatedAgent.totalLeads);

    res.status(201).json({
      success: true,
      data: lead,
      agentTotalLeads: updatedAgent.totalLeads,
    });
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// 2. Check if user has contacted an agent (Specific to Property)
exports.checkLead = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { propertyId } = req.query; // ✅ Accept propertyId from query params
    const userId = req.user.id;

    // Build the query
    const query = { agentId, userId };

    // If checking for a specific property, include it in query
    if (propertyId) {
      query.propertyId = propertyId;
    }

    const existingLead = await Lead.findOne(query);

    res.json({
      success: true,
      hasContacted: !!existingLead,
      lastContacted: existingLead ? existingLead.timestamp : null,
    });
  } catch (error) {
    console.error("Error checking lead:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// 3. Get Leads (For Users viewing their history OR Admins)
exports.getLeads = async (req, res) => {
  try {
    const {
      agentId,
      propertyId,
      type,
      status,
      page = 1,
      limit = 10,
    } = req.query;

    const userId = req.user.id;

    // Build filter object
    const filter = {};

    // ✅ SECURITY: If the user is a normal 'user', they should only see leads THEY created.
    // If the user is 'admin', they can see everything.
    // If the user is 'agent', they should use the 'getAgentLeads' endpoint usually,
    // but if they use this one, we restrict to their own leads.

    if (req.user.role === "user") {
      filter.userId = userId;
    } else if (req.user.role === "agent") {
      // Find the agent profile for this user
      const agentProfile = await Agent.findOne({ userId: userId });
      if (agentProfile) {
        filter.agentId = agentProfile._id;
      } else {
        return res
          .status(404)
          .json({ success: false, error: "Agent profile not found" });
      }
    }
    // Admins can pass filter.agentId manually

    if (agentId && req.user.role === "admin") filter.agentId = agentId;
    if (propertyId) filter.propertyId = propertyId;
    if (type) filter.type = type;
    if (status) filter.status = status;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const leads = await Lead.find(filter)
      .populate("userId", "name email phone avatar")
      .populate("propertyId", "title location price images type")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Lead.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: leads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// 4. Get Leads SPECIFICALLY for the logged-in Agent
exports.getAgentLeads = async (req, res) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    const userId = req.user.id;

    // ✅ SECURITY: Find the agent profile associated with the logged-in User
    const agent = await Agent.findOne({ userId: userId });

    if (!agent) {
      return res.status(403).json({
        success: false,
        error: "You do not have an agent profile.",
      });
    }

    // Build filter using the securely found agent._id
    const filter = { agentId: agent._id };

    if (type) filter.type = type;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const leads = await Lead.find(filter)
      .populate("userId", "name email phone avatar")
      .populate("propertyId", "title location price images type")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Lead.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: leads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching agent leads:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
