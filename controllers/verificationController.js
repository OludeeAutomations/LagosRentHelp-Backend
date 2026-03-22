const dojahService = require("../services/kycService");
const User = require("../models/User");
const { validationResult } = require("express-validator");

exports.submitVerification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { idType, idNumber, fullName, dateOfBirth } = req.body;
    const selfieImage = req.file;

    if (!idType || !idNumber) {
      return res.status(400).json({ success: false, error: "idType and idNumber are required" });
    }

    if ((idType === "nin" || idType === "bvn") && !selfieImage) {
      return res.status(400).json({ success: false, error: "Selfie image is required for NIN and BVN verification" });
    }

    let selfieBase64 = null;
    if (selfieImage) {
      selfieBase64 = `data:${selfieImage.mimetype};base64,${selfieImage.buffer.toString("base64")}`;
    }

    const additionalData = { fullName, dateOfBirth };
    const verificationResult = await dojahService.verifyIdentity(idType, idNumber, selfieBase64, additionalData);

    if (!verificationResult.success) {
      return res.status(400).json({ success: false, error: verificationResult.error, message: verificationResult.message });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const status = "verified";
    user.verification = user.verification || {};
    user.verification.idType = idType;
    user.verification.idNumber = idNumber;
    user.verification.status = status;
    user.verification.verifiedAt = new Date();
    user.verification.dojahResponse = verificationResult.data;
    await user.save();

    return res.status(200).json({ success: true, message: "Identity verified successfully!", data: { status, idType, idNumberMasked: idNumber.replace(/(.{4})$/, "****") } });
  } catch (error) {
    console.error("Verification submission error:", error);
    return res.status(500).json({ success: false, error: "Internal server error", message: "Failed to submit verification" });
  }
};

exports.checkVerificationStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    return res.status(200).json({ success: true, data: user.verification || {} });
  } catch (error) {
    console.error("Verification status check error:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

exports.dojahWebhook = async (req, res) => {
  try {
    const webhookSecret = req.headers["x-dojah-secret"];
    if (webhookSecret !== process.env.DOJAH_WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // If needed, user matching logic using verification reference (not implemented)
    return res.status(200).json({ success: true, message: "Webhook received" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};
exports.dojahWebhook = async (req, res) => {
  try {
    const { event, data, entity_id, request_id, status, timestamp } = req.body;

    // Verify webhook secret (important for security)
    const webhookSecret = req.headers["x-dojah-secret"];
    if (webhookSecret !== process.env.DOJAH_WEBHOOK_SECRET) {
      console.error("Invalid webhook secret");
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    console.log(`Received Dojah webhook: ${event} for request ${request_id}`);

    // Find agent by verification ID
    const agent = await Agent.findOne({
      $or: [
        { "verificationData.dojahResponse.entity.id": entity_id },
        { "verificationData.dojahResponse.request_id": request_id },
      ],
    });

    if (!agent) {
      console.error(
        "Agent not found for verification ID:",
        entity_id || request_id
      );
      return res.status(404).json({ success: false, error: "Agent not found" });
    }

    // Update agent verification status based on Dojah's response
    agent.verificationStatus = status; // 'approved', 'rejected', 'pending'
    agent.verificationData.status = status;
    agent.verificationData.processedAt = new Date();
    agent.verificationData.webhookResponse = req.body; // Store full webhook data

    // If verification is approved, update additional fields
    if (status === "verified") {
      agent.isVerified = true;
      agent.verifiedAt = new Date();

      // Extract verified data from Dojah response
      if (data && data.validations) {
        agent.verifiedData = {
          fullName: data.validations.full_name,
          dateOfBirth: data.validations.date_of_birth,
          idNumber: data.validations.id_number,
          // Add other verified fields as needed
        };
      }
    }

    await agent.save();

    // TODO: Trigger notifications (email, push, etc.)
    await sendVerificationNotification(agent.userId, status);

    return res
      .status(200)
      .json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
};
