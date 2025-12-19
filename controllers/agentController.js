const Agent = require("../models/Agent");
const User = require("../models/User");
const Property = require("../models/Property");
const { cloudinary } = require("../config/cloudinary");

exports.submitAgentApplication = async (req, res) => {
  try {
    // Extract all fields from the enhanced form
    const {
      gender,
      dateOfBirth,
      residentialAddress,
      state,
      city,
      institutionName,
      campusCode,
      bio,
      experience,
      motivation,
      hearAboutUs,
      preferredCommunication,
      socialMedia,
      whatsappNumber,
      referredBy, // The referral code from the person who referred them
    } = req.body;

    console.log("Request body:", req.body);
    console.log("Request files:", req.files);
    console.log("Referred by code:", referredBy);

    const requiredFields = {
      gender,
      dateOfBirth,
      residentialAddress,
      state,
      city,
      bio,
      motivation,
      hearAboutUs,
      preferredCommunication,
      whatsappNumber,
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value || value.toString().trim() === "")
      .map(([key]) => key);

    if (missingFields.length > 0) {
      console.log("❌ Validation failed - missing fields:", missingFields);
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(", ")}`,
        missingFields,
      });
    }

    const validGenders = ["male", "female", "other"];
    if (!validGenders.includes(gender)) {
      return res.status(400).json({
        success: false,
        error: "Invalid gender value",
      });
    }
    const validCommunication = ["whatsapp", "email", "phone"];
    if (!validCommunication.includes(preferredCommunication)) {
      return res.status(400).json({
        success: false,
        error: "Invalid communication preference",
      });
    }

    const existingAgent = await Agent.findOne({ userId: req.user.id });
    if (existingAgent) {
      return res.status(400).json({
        success: false,
        error: "You already have an agent profile",
      });
    }

    if (!req.files?.idPhoto) {
      return res.status(400).json({
        success: false,
        error: "Professional photo is required",
      });
    }

    let referredByAgent = null;
    if (referredBy && referredBy.trim() !== "") {
      console.log("🔄 Validating referral code:", referredBy);

      referredByAgent = await Agent.findOne({
        referralCode: referredBy.trim(),
        verificationStatus: "verified", // Only verified agents can refer others
      });

      console.log("Found referring agent:", referredByAgent?._id);

      if (!referredByAgent) {
        console.log("❌ Invalid referral code or agent not verified");
        return res.status(400).json({
          success: false,
          error: "Invalid referral code or referring agent is not verified",
        });
      }

      console.log(
        "✅ Valid referral code. Referring agent:",
        referredByAgent._id
      );
    } else {
      console.log("ℹ️ No referral code provided");
    }

    console.log("✅ All validations passed");

    let idPhotoUrl = "";
    try {
      console.log("Uploading professional photo to Cloudinary...");
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
      console.log("Professional photo uploaded to Cloudinary:", idPhotoUrl);
    } catch (uploadError) {
      console.error("Professional photo upload error:", uploadError);
      return res.status(400).json({
        success: false,
        error: `Failed to upload professional photo: ${uploadError.message}`,
      });
    }

    let proofOfAddressUrl = null;
    if (req.files?.proofOfAddress) {
      try {
        console.log("Uploading proof of address to Cloudinary...");
        const proofResult = await cloudinary.uploader.upload(
          req.files.proofOfAddress[0].path,
          {
            folder: "lagos-rent-help/agents/address-proof",
            transformation: [{ quality: "auto" }],
          }
        );
        proofOfAddressUrl = proofResult.secure_url;
        console.log(
          "Proof of address uploaded to Cloudinary:",
          proofOfAddressUrl
        );
      } catch (uploadError) {
        console.error("Proof of address upload error:", uploadError);
        console.log("Continuing without proof of address...");
      }
    }

    const generateReferralCode = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let result = "";
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return `REF${result}`;
    };

    const referralCodeForAgent = generateReferralCode();

    const agentData = {
      userId: req.user.id,
      fullName: req.user.name,
      email: req.user.email,
      phone: req.user.phone,

      gender,
      dateOfBirth: new Date(dateOfBirth),

      residentialAddress,
      state,
      city,
      institutionName: institutionName || null,
      campusCode: campusCode || null,
      proofOfAddress: proofOfAddressUrl,

      bio,
      experience: experience || null,
      motivation,
      hearAboutUs,
      preferredCommunication,
      socialMedia: socialMedia || null,

      whatsappNumber,
      idPhoto: idPhotoUrl,
      verificationStatus: "not verified",

      referredBy: referredBy || null,
      referralCode: referralCodeForAgent,
      freeListingWeeks: 0,
      totalReferrals: 0,
    };

    console.log("✅ Saving to database...");
    const agent = await Agent.create(agentData);

    await User.findByIdAndUpdate(req.user.id, {
      role: "agent",
      agentProfile: agent._id,
    });

    if (referredByAgent) {
      console.log("🎁 Rewarding referring agent:", referredByAgent._id);

      // 1. Calculate the new date
      const OneWeekInMs = 7 * 24 * 60 * 60 * 1000;
      let currentEndDate = referredByAgent.subscription.trialEndsAt
        ? new Date(referredByAgent.subscription.trialEndsAt)
        : new Date(); // If no date exists, assume 'now'

      // Check if their trial has already expired
      if (currentEndDate < new Date()) {
        // If expired, restart it from NOW + 1 week
        currentEndDate = new Date(new Date().getTime() + OneWeekInMs);
      } else {
        // If still active, extend the existing date by 1 week
        currentEndDate = new Date(currentEndDate.getTime() + OneWeekInMs);
      }

      // 2. Update the Referring Agent
      await Agent.findByIdAndUpdate(referredByAgent._id, {
        $inc: { totalReferrals: 1 }, // Keep track of count for stats
        $set: {
          "subscription.trialEndsAt": currentEndDate, // ✅ Extend the actual access time
          "subscription.status": "trial", // Ensure status is active
          // Optional: You can still increment this number just for display purposes
          // freeListingWeeks: (referredByAgent.freeListingWeeks || 0) + 1
        },
      });

      console.log(
        "✅ Referral reward applied. Agent access extended until:",
        currentEndDate
      );
    }

    try {
      await sendWelcomeEmail({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        role: "agent",
      });
      console.log(5);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    try {
      await sendAdminNotification({
        type: "new_agent_application",
        agentName: req.user.name,
        agentEmail: req.user.email,
        agentLocation: `${city}, ${state}`,
        applicationDate: new Date(),
        hasReferral: !!referredByAgent,
        referringAgent: referredByAgent ? referredByAgent._id : null,
      });
      console.log(8);
    } catch (notificationError) {
      console.error("Failed to send admin notification:", notificationError);
    }

    console.log("✅ Application submitted successfully");
    res.status(201).json({
      success: true,
      data: {
        agent: {
          _id: agent._id,
          verificationStatus: agent.verificationStatus,
          referralCode: agent.referralCode, // This agent's new referral code
          createdAt: agent.createdAt,
        },
        referral: referredByAgent
          ? {
              rewarded: true,
              freeListingWeeks: 1,
              referringAgentId: referredByAgent._id,
              referringAgentName: referredByAgent.fullName,
            }
          : null,
      },
      message: referredByAgent
        ? "Agent application submitted successfully! Your referrer has been rewarded with 1 free listing week."
        : "Agent application submitted successfully! Your profile is under review and you'll be notified within 24-48 hours.",
    });
  } catch (error) {
    console.error("Agent application error:", error);

    // Handle specific errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        error:
          "Validation error: " +
          Object.values(error.errors)
            .map((e) => e.message)
            .join(", "),
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Duplicate entry found. Please check your information.",
      });
    }

    res.status(500).json({
      success: false,
      error: "Internal server error. Please try again later.",
    });
  }
};
exports.getTopAgents = async (req, res) => {
  try {
    // You can pass ?limit=5 or ?limit=10 to control how many agents to fetch
    const limit = parseInt(req.query.limit) || 5;

    // Fetch only verified agents, sorted by rating, and limited by the query
    const agents = await Agent.find({ verificationStatus: "verified" })
      .sort({ rating: -1, totalReviews: -1 }) // highest rated + more reviews first
      .limit(limit)
      .populate("userId", "name email phone avatar") // show agent user info
      .lean();

    // Optionally compute average ratings from review array if you rely on reviews instead of `rating` field
    // (uncomment if you don't store rating in DB)
    // agents.forEach(agent => {
    //   if (agent.reviews && agent.reviews.length > 0) {
    //     const avg = agent.reviews.reduce((acc, r) => acc + r.rating, 0) / agent.reviews.length;
    //     agent.rating = Math.round(avg * 10) / 10;
    //   }
    // });

    res.json({
      success: true,
      count: agents.length,
      data: agents,
    });
  } catch (error) {
    console.error("Error fetching top agents:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};
const mongoose = require("mongoose");

exports.getAgentProfile = async (req, res) => {
  try {
    const { id } = req.params;
    let agent;

    // 1. Try to find by Agent Document ID (Most common for public profiles)
    // We populate 'userId' to get the name, email, etc.
    if (mongoose.Types.ObjectId.isValid(id)) {
      agent = await Agent.findById(id).populate("userId", "-password");
    }

    // 2. If not found, try to find by User ID (Common for dashboard/me routes)
    if (!agent && mongoose.Types.ObjectId.isValid(id)) {
      agent = await Agent.findOne({ userId: id }).populate(
        "userId",
        "-password"
      );
    }

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: "Agent not found",
      });
    }

    // 3. Fetch all properties linked to this agent
    // IMPORTANT: Property.agentId stores the AGENT Profile ID, not the User ID
    const properties = await Property.find({
      agentId: agent._id,
    }).sort({ createdAt: -1 }); // Newest first

    // 4. Compute stats
    const stats = {
      totalListings: properties.length,
      activeListings: properties.filter((p) => p.status === "available").length,
      rentedListings: properties.filter((p) => p.status === "rented").length,
    };

    // 5. Respond
    res.json({
      success: true,
      data: {
        agent: agent.toObject(),
        user: agent.userId, // This is the populated User object
        properties,
        stats,
      },
    });
  } catch (error) {
    console.error("Get Agent Profile Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
exports.getLoggedInAgentProfile = async (req, res) => {
  try {
    const agent = await Agent.findOne({ userId: req.user.id })
      .populate("agentId", "name email phone avatar role")
      .lean();

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent profile not found",
      });
    }

    res.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    console.error("Error fetching logged-in agent profile:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
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
