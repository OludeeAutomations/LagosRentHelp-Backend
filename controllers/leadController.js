const Lead = require("../models/Lead");
const Property = require("../models/Property");
const User = require("../models/User");
const Agent = require("../models/Agent");
const { sendLeadNotificationEmail } = require("../services/emailService");

exports.createLead = async (req, res) => {
  try {
    const { agentId, propertyId, type, message } = req.body;

    const lead = new Lead({
      agentId,
      propertyId: propertyId || null,
      type,
      clientId: req.user.id,
      message,
      timestamp: new Date(),
    });

    await lead.save();

    // Send email notification to agent
    const agent = await User.findById(agentId);
    const agentProfile = await Agent.findOne({ userId: agentId });
    let property = null;

    if (propertyId) {
      property = await Property.findById(propertyId);
    }

    if (agent && agentProfile) {
      await sendLeadNotificationEmail(
        { ...agent.toObject(), ...agentProfile.toObject() },
        lead,
        property
      );
    }

    res.status(201).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
