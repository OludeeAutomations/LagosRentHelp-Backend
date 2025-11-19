const Lead = require("../models/Lead");
const Agent = require("../models/Agent");

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

    // Check if lead already exists
    const existingLead = await Lead.findOne({
      agentId,
      userId,
    });

    if (existingLead) {
      return res.status(200).json({
        success: true,
        data: existingLead,
        message: "Lead already exists",
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

    console.log(
      `Agent ${agentId} totalLeads updated to:`,
      updatedAgent.totalLeads
    );

    res.status(201).json({
      success: true,
      data: lead,
      agentTotalLeads: updatedAgent.totalLeads, // Optional: return updated count
    });
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
// Check if user has contacted an agent
exports.checkLead = async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user.id;

    console.log("Checking lead for:", { agentId, userId });

    // Check if lead already exists for this user-agent combination
    const existingLead = await Lead.findOne({
      agentId,
      userId,
    });

    console.log("Existing lead found:", existingLead);

    res.json({
      success: true,
      hasContacted: !!existingLead,
    });
  } catch (error) {
    console.error("Error checking lead:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
// Get leads with optional filters
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
    const userId = req.user.id; // From auth middleware

    console.log("Fetching leads with filters:", req.query);

    // Build filter object
    const filter = {};

    // If user is an agent, they can only see their own leads
    if (agentId) {
      filter.agentId = agentId;
    }

    // Optional filters
    if (propertyId) filter.propertyId = propertyId;
    if (type) filter.type = type;
    if (status) filter.status = status;

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get leads with population
    const leads = await Lead.find(filter)
      .populate("userId", "name email phone") // Populate client info
      .populate("propertyId", "title location price images") // Populate property info
      .sort({ timestamp: -1 }) // Newest first
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
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
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
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
// Get leads for a specific agent
exports.getAgentLeads = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { page = 1, limit = 10, type } = req.query;

    console.log("Fetching leads for agent:", agentId);

    // Build filter
    const filter = { agentId };
    if (type) filter.type = type;

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get leads
    const leads = await Lead.find(filter)
      .populate("userId", "name email phone")
      .populate("propertyId", "title location price images")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count
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
      error: error.message,.
    });
  }
};
