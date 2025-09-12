// controllers/subscriptionController.js
const Agent = require("../models/Agent");

exports.getSubscriptionStatus = async (req, res) => {
  try {
    const agent = await Agent.findOne({ userId: req.user.id });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: "Agent not found",
      });
    }

    const canList = agent.canListProperties();
    const now = new Date();

    res.json({
      success: true,
      data: {
        canListProperties: canList,
        subscription: agent.subscription,
        freeListingWeeks: agent.freeListingWeeks,
        trialEndsAt: agent.subscription.trialEndsAt,
        daysRemaining: canList
          ? Math.ceil(
              (agent.subscription.trialEndsAt - now) / (1000 * 60 * 60 * 24)
            )
          : 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.createSubscription = async (req, res) => {
  try {
    const { plan, paymentMethodId } = req.body;
    const agent = await Agent.findOne({ userId: req.user.id });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: "Agent not found",
      });
    }

    // Here you would integrate with Stripe or your payment processor
    // This is a simplified version

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1); // 1 month subscription

    agent.subscription = {
      status: "active",
      plan: plan || "basic",
      currentPeriodEnd: periodEnd,
      trialEndsAt: agent.subscription.trialEndsAt,
    };

    await agent.save();

    res.json({
      success: true,
      message: "Subscription activated successfully",
      data: {
        subscription: agent.subscription,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
