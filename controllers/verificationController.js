// controllers/verificationController.js
const dojahService = require("../services/kycService");
const Agent = require("../models/Agent");
const { validationResult } = require("express-validator");

exports.submitVerification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { idType, idNumber, fullName, dateOfBirth } = req.body;
    const selfieImage = req.file;
    if (!idType || !idNumber) {
      return res.status(400).json({
        success: false,
        error: "idType and idNumber are required",
      });
    }

    if ((idType === "nin" || idType === "bvn") && !selfieImage) {
      return res.status(400).json({
        success: false,
        error: "Selfie image is required for NIN and BVN verification",
      });
    }

    if (idType === "drivers_license" && (!fullName || !dateOfBirth)) {
      return res.status(400).json({
        success: false,
        error:
          "Full name and date of birth are required for Driver's License verification",
      });
    }

    let selfieBase64 = null;
    if (selfieImage) {
      selfieBase64 = `data:${
        selfieImage.mimetype
      };base64,${selfieImage.buffer.toString("base64")}`;
    }

    const additionalData = {
      fullName,
      dateOfBirth,
    };

    const verificationResult = await dojahService.verifyIdentity(
      idType,
      idNumber,
      selfieBase64,
      additionalData
    );

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        error: verificationResult.error,
        message: verificationResult.message,
      });
    }

    const agentId = req.user.id;
    const agent = await Agent.findOne({ userId: agentId });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: "Agent profile not found",
      });
    }

    agent.verificationStatus = "pending";
    agent.idType = idType;
    agent.idNumber = idNumber;
    agent.verificationData = {
      dojahResponse: verificationResult.data,
      submittedAt: new Date(),
      status: "submitted",
    };

    if (idType === "drivers_license") {
      agent.verificationData.fullName = fullName;
      agent.verificationData.dateOfBirth = dateOfBirth;
    }

    await agent.save();

    return res.status(200).json({
      success: true,
      message: "Verification submitted successfully",
      data: {
        verificationId:
          verificationResult.data.entity?.id ||
          verificationResult.data.request_id,
        status: "submitted",
        idType: idType,
        idNumberMasked: idNumber.replace(/(.{4})$/, "****"),
      },
    });
  } catch (error) {
    console.error("Verification submission error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Failed to submit verification",
    });
  }
};

exports.checkVerificationStatus = async (req, res) => {
  try {
    const agentId = req.user.id;
    const agent = await Agent.findOne({ userId: agentId });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: "Agent profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        verificationStatus: agent.verificationStatus,
        idType: agent.idType,
        submittedAt: agent.verificationData?.submittedAt,
        dojahStatus: agent.verificationData?.status,
        idNMaskumber: agent.idNumber
          ? agent.idNumber.replace(/(.{4})$/, "****")
          : null,
      },
    });
  } catch (error) {
    console.error("Verification status check error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};
