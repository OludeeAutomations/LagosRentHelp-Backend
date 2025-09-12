// controllers/referralController.js
const Agent = require("../models/Agent");

exports.applyReferral = async (req, res) => {
  try {
    const { referralCode } = req.body;
    const agentId = req.user.id;

    // Find the current agent
    const agent = await Agent.findOne({ userId: agentId });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: "Agent not found",
      });
    }

    // Check if agent already used a referral code
    if (agent.referredBy) {
      return res.status(400).json({
        success: false,
        error: "You have already used a referral code",
      });
    }

    // Find the referring agent
    const referringAgent = await Agent.findOne({ referralCode });

    if (!referringAgent) {
      return res.status(404).json({
        success: false,
        error: "Invalid referral code",
      });
    }

    // Can't use own referral code
    if (referringAgent._id.toString() === agent._id.toString()) {
      return res.status(400).json({
        success: false,
        error: "Cannot use your own referral code",
      });
    }

    // Update both agents
    agent.referredBy = referralCode;
    await agent.save();

    referringAgent.freeListingWeeks += 1;
    referringAgent.totalReferrals += 1;
    await referringAgent.save();

    res.json({
      success: true,
      message:
        "Referral code applied successfully. You get 1 free week of listing!",
      data: {
        freeWeeks: 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getReferralStats = async (req, res) => {
  try {
    const agent = await Agent.findOne({ userId: req.user.id });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: "Agent not found",
      });
    }

    res.json({
      success: true,
      data: {
        referralCode: agent.referralCode,
        totalReferrals: agent.totalReferrals,
        freeListingWeeks: agent.freeListingWeeks,
        referralLink: `${process.env.FRONTEND_URL}/register?ref=${agent.referralCode}`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
