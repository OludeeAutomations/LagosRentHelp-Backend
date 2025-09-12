// middleware/checkSubscription.js
const Agent = require("../models/Agent");

const checkSubscription = async (req, res, next) => {
  try {
    const agent = await Agent.findOne({ userId: req.user.id });

    if (!agent) {
      return res.status(403).json({
        success: false,
        error: "Agent profile not found",
      });
    }

    if (!agent.canListProperties()) {
      return res.status(403).json({
        success: false,
        error:
          "Your subscription has expired. Please subscribe to continue listing properties.",
      });
    }

    req.agent = agent;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = checkSubscription;
