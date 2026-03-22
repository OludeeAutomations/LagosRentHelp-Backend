const Lead = require("../models/Lead");
const Property = require("../models/Property");

exports.createLead = async (req, res) => {
  try {
    const { propertyId, type, message } = req.body;
    const userId = req.user.id;

    if (!propertyId || !type) {
      return res.status(400).json({ success: false, error: "propertyId and type are required" });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    const existingLead = await Lead.findOne({ propertyId, userId });
    if (existingLead) {
      existingLead.timestamp = new Date();
      existingLead.message = message || existingLead.message;
      await existingLead.save();
      return res.status(200).json({ success: true, data: existingLead, message: "Lead updated" });
    }

    const lead = new Lead({
      propertyId,
      userId,
      ownerId: property.contactUserId || property.ownerId,
      type,
      message: message || `${type.toUpperCase()} contact initiated`,
      timestamp: new Date(),
    });

    await lead.save();

    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.checkLead = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user.id;

    const existingLead = await Lead.findOne({ propertyId, userId });

    res.json({ success: true, hasContacted: !!existingLead, lastContacted: existingLead ? existingLead.timestamp : null });
  } catch (error) {
    console.error("Error checking lead:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getLeads = async (req, res) => {
  try {
    const { propertyId, type, status, page = 1, limit = 10 } = req.query;
    const userId = req.user.id;

    const filter = {};

    if (req.user.role === "user") {
      filter.userId = userId;
    } else if (req.user.role === "admin") {
      filter.ownerId = userId;
    }

    if (propertyId) filter.propertyId = propertyId;
    if (type) filter.type = type;
    if (status) filter.status = status;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const leads = await Lead.find(filter)
      .populate("userId", "name email phone avatar")
      .populate("propertyId", "title location price images type")
      .sort({ timestamp: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await Lead.countDocuments(filter);

    res.json({
      success: true,
      data: leads,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
