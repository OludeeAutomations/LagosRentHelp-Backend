const Agent = require("../models/Agent");
const User = require("../models/User");
const Property = require("../models/Property");
const { cloudinary } = require("../config/cloudinary");

exports.getAgentProfile = async (req, res) => {
  try {
    // Find the agent and populate full user details
    const agent = await Agent.findOne({ userId: req.params.id }).populate(
      "userId"
    ); // Get all user fields

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: "Agent not found",
      });
    }

    // Fetch all properties linked to this agent
    const properties = await Property.find({
      agentId: req.params.id,
    });

    // Compute stats
    const stats = {
      totalListings: properties.length,
      activeListings: properties.filter((p) => p.status === "available").length,
      rentedListings: properties.filter((p) => p.status === "rented").length,
    };

    // Respond with everything
    res.json({
      success: true,
      data: {
        agent: agent.toObject(),
        user: agent.userId, // full user details
        properties, // full properties list
        stats, // computed stats
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.updateAgentProfile = async (req, res) => {
  try {
    const { bio, address, whatsappNumber } = req.body;
    const agent = await Agent.findOneAndUpdate(
      { userId: req.user.id },
      { bio, address, whatsappNumber },
      { new: true, runValidators: true }
    ).populate("userId", "name email phone avatar");

    res.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
// Add this function to your agentController

// Add this function to your agentController
exports.submitAgentApplication = async (req, res) => {
  try {
    const { bio, address, whatsappNumber, referralCode } = req.body;

    console.log("Request files:", req.files); // Debug log
    console.log("Request body:", req.body); // Debug log
    let referredByAgent = null;
    if (referralCode) {
      referredByAgent = await Agent.findOne({
        referralCode,
        verificationStatus: "verified",
      });

      if (!referredByAgent) {
        return res.status(400).json({
          success: false,
          error: "Invalid referral code",
        });
      }
    }
    // Check if files were uploaded
    if (!req.files || !req.files.governmentId || !req.files.idPhoto) {
      return res.status(400).json({
        success: false,
        error: "Both government ID and ID photo are required",
      });
    }

    // Check if user already has an agent profile
    const existingAgent = await Agent.findOne({ userId: req.user.id });
    if (existingAgent) {
      return res.status(400).json({
        success: false,
        error: "You already have an agent profile",
      });
    }

    // Upload files to Cloudinary
    let governmentIdUrl = "";
    let idPhotoUrl = "";

    try {
      // Upload government ID
      const governmentIdResult = await cloudinary.uploader.upload(
        req.files.governmentId[0].path,
        {
          folder: "lagos-rent-help/agents/documents",
          resource_type: "auto",
        }
      );
      governmentIdUrl = governmentIdResult.secure_url;

      // Upload ID photo
      const idPhotoResult = await cloudinary.uploader.upload(
        req.files.idPhoto[0].path,
        {
          folder: "lagos-rent-help/agents/photos",
          transformation: [
            { width: 400, height: 400, crop: "fill" },
            { quality: "auto" },
          ],
        }
      );
      idPhotoUrl = idPhotoResult.secure_url;
    } catch (uploadError) {
      console.error("File upload error:", uploadError);
      return res.status(400).json({
        success: false,
        error: "Failed to upload files. Please try again.",
      });
    }

    // Create agent profile
    const agent = await Agent.create({
      userId: req.user.id,
      bio,
      address,
      whatsappNumber,
      governmentId: governmentIdUrl,
      idPhoto: idPhotoUrl,
      verificationStatus: "pending",
      referredBy: referredByAgent ? referralCode : null,
    });

    // Update user role to agent
    await User.findByIdAndUpdate(req.user.id, {
      role: "agent",
      agentProfile: agent._id,
    });
    if (referredByAgent) {
      referredByAgent.freeListingWeeks += 1;
      referredByAgent.totalReferrals += 1;
      await referredByAgent.save();
    }

    res.status(201).json({
      success: true,
      data: agent,
      message:
        "Application submitted successfully. Please wait for verification.",
    });
  } catch (error) {
    console.error("Agent application error:", error);

    // Clean up uploaded files if there was an error
    if (req.files) {
      const files = [
        ...(req.files.governmentId || []),
        ...(req.files.idPhoto || []),
      ];
      for (const file of files) {
        try {
          // Extract public_id from path or URL if needed
          await cloudinary.uploader.destroy(file.filename);
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
};
exports.validateReferralCode = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      console.log("Referral code missing in query");
      return res.status(400).json({
        success: false,
        error: "Referral code is required",
      });
    }

    // log the incoming code
    console.log("Validating referral code:", code);

    const agent = await Agent.findOne({
      referralCode: code,
      verificationStatus: "verified",
    }).populate("userId", "name");

    if (!agent) {
      console.log("No verified agent found with this referralCode:", code);
      return res.status(404).json({
        success: false,
        error: "Invalid referral code",
      });
    }

    res.json({
      success: true,
      data: {
        agentName: agent.userId?.name,
      },
    });
  } catch (error) {
    console.error("Error validating referral code:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
