const User = require("../models/User");
const Agent = require("../models/Agent");
const { sendKycResponse } = require("../services/emailService");

exports.handleDojahWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log("🔔 Dojah Webhook received:", JSON.stringify(payload, null, 2));

    const userId = payload.metadata?.user_id;
    const verificationStatus = payload.verification_status || "Unknown";
    const idUrl = payload.id_url || null;

    const user = await User.findById(userId);
    const agent = await Agent.findOne({ userId });

    if (!user || !agent) {
      console.error("❌ User or Agent not found for:", userId);
      return res.status(404).json({ success: false, error: "User or Agent not found" });
    }

    const isLivenessPassed = payload.data?.selfie?.status === true;
    const isIdVerified = payload.data?.id?.status === true;

    // 🧠 Some payloads don’t include face_match_score
    const faceMatchScore = payload.data?.selfie?.data?.face_match_score;
    const isFaceMatchGood = typeof faceMatchScore === "number" ? faceMatchScore >= 0.5 : true;

    if (
      verificationStatus.toLowerCase() === "completed" &&
      isLivenessPassed &&
      isIdVerified &&
      isFaceMatchGood
    ) {
      // ✅ KYC Verified
      agent.verificationStatus = "verified";
      agent.governmentId = idUrl;
      await agent.save();

      await sendKycResponse(
        {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        "success"
      );

      console.log(`✅ Agent ${user.name} verified successfully.`);
    } else {
      // ❌ KYC Failed
      agent.verificationStatus = "rejected";
      agent.governmentId = idUrl || null;
      await agent.save();

      await sendKycResponse(
        {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        "failed"
      );

      console.log(`❌ Agent ${user.name} KYC failed.`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("🔥 Dojah webhook processing error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
