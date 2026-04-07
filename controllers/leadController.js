const {
  createLead,
  findLeadByPropertyAndUser,
  listLeads,
  updateLead,
} = require("../repositories/leads");
const { findPropertyById } = require("../repositories/properties");

exports.createLead = async (req, res) => {
  try {
    const { propertyId, type, message } = req.body;
    const userId = req.user.id;

    if (!propertyId || !type) {
      return res.status(400).json({
        success: false,
        error: "propertyId and type are required",
      });
    }

    const property = await findPropertyById(propertyId);
    if (!property) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    const existingLead = await findLeadByPropertyAndUser({ propertyId, userId });
    if (existingLead) {
      const updatedLead = await updateLead(existingLead._id, {
        timestamp: new Date().toISOString(),
        message: message || existingLead.message,
      });
      return res
        .status(200)
        .json({ success: true, data: updatedLead, message: "Lead updated" });
    }

    const lead = await createLead({
      propertyId,
      userId,
      ownerId:
        property.contactUserId?._id ||
        property.contactUserId ||
        property.ownerId?._id ||
        property.ownerId,
      type,
      message: message || `${type.toUpperCase()} contact initiated`,
      timestamp: new Date().toISOString(),
    });

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
    const existingLead = await findLeadByPropertyAndUser({ propertyId, userId });

    res.json({
      success: true,
      hasContacted: Boolean(existingLead),
      lastContacted: existingLead ? existingLead.timestamp : null,
    });
  } catch (error) {
    console.error("Error checking lead:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getLeads = async (req, res) => {
  try {
    const { propertyId, type, page = 1, limit = 10 } = req.query;
    const userId = req.user.id;
    const filter = {};

    if (req.user.role === "user") filter.userId = userId;
    else if (req.user.role === "admin") filter.ownerId = userId;

    if (propertyId) filter.propertyId = propertyId;
    if (type) filter.type = type;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { data, total } = await listLeads({
      filter,
      page: pageNum,
      limit: limitNum,
    });

    res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
