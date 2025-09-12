// scripts/fixExistingAgents.js
const mongoose = require("mongoose");
const Agent = require("../models/Agent");

const fixExistingAgents = async () => {
  try {
    await mongoose.connect(
      "mongodb+srv://LagosRentHelp:EhKWGCDTuqCWkmLR@lagosrenthelp.foeecwp.mongodb.net/"
    );

    // Find all agents that need fixing
    const agents = await Agent.find({
      $or: [
        { referralCode: { $in: [null, undefined, ""] } },
        {
          verificationStatus: "verified",
          "subscription.status": "trial",
          $or: [
            { "subscription.trialStartsAt": { $exists: false } },
            { "subscription.trialEndsAt": { $exists: false } },
          ],
        },
      ],
    });

    console.log(`Found ${agents.length} agents that need fixing`);

    for (const agent of agents) {
      let updated = false;

      // Fix referral code
      if (!agent.referralCode) {
        agent.referralCode = agent.generateReferralCode();
        updated = true;
        console.log(
          `Added referral code to agent ${agent._id}: ${agent.referralCode}`
        );
      }

      // Fix subscription dates for verified agents
      if (
        agent.verificationStatus === "verified" &&
        agent.subscription.status === "trial" &&
        (!agent.subscription.trialStartsAt || !agent.subscription.trialEndsAt)
      ) {
        const now = new Date();
        const trialEnds = new Date(now);
        trialEnds.setDate(trialEnds.getDate() + 14);

        agent.subscription.trialStartsAt =
          agent.subscription.trialStartsAt || now;
        agent.subscription.trialEndsAt =
          agent.subscription.trialEndsAt || trialEnds;
        updated = true;

        console.log(
          `Fixed subscription dates for agent ${
            agent._id
          }: ${agent.subscription.trialEndsAt.toLocaleDateString()}`
        );
      }

      if (updated) {
        await agent.save();
      }
    }

    console.log("Agent migration completed");
    process.exit(0);
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
};

fixExistingAgents();
