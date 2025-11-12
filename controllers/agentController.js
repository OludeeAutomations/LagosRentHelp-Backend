const Agent = require("../models/Agent");
const User = require("../models/User");
const Property = require("../models/Property");
const { cloudinary } = require("../config/cloudinary");

exports.submitAgentApplication = async (req, res) => {
  try {
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
      referralCode,
    } = req.body;

    console.log("Request body:", req.body);
    console.log("Request files:", req.files);
    console.log("Referred by code:", referredBy);

    // ✅ STEP 1: VALIDATE ALL DATA FIRST (BEFORE any database operations)
    console.log("=== VALIDATING REQUEST DATA ===");

    // Validate required fields
    const requiredFields = {
      gender: cleanedBody.gender,
      dateOfBirth: cleanedBody.dateOfBirth,
      residentialAddress: cleanedBody.residentialAddress,
      state: cleanedBody.state,
      city: cleanedBody.city,
      bio: cleanedBody.bio,
      motivation: cleanedBody.motivation,
      hearAboutUs: cleanedBody.hearAboutUs,
      preferredCommunication: cleanedBody.preferredCommunication,
      whatsappNumber: cleanedBody.whatsappNumber,
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

    // Validate gender enum
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

    // ✅ STEP 2: CHECK REFERRAL CODE AND FIND REFERRING AGENT
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

    // ✅ STEP 3: PROCESS FILES (still before database commit)
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

    // ✅ STEP 4: CREATE AGENT PROFILE WITH ENHANCED DATA
    const agentData = {
      userId: req.user.id,
      fullName: req.user.name,
      email: req.user.email,
      phone: req.user.phone,

      // Personal Information
      gender,
      dateOfBirth: new Date(dateOfBirth),

      // Address & Location
      residentialAddress,
      state,
      city,
      institutionName: institutionName || null,
      campusCode: campusCode || null,
      proofOfAddress: proofOfAddressUrl,

      // Professional Information
      bio,
      experience: experience || null,
      motivation,
      hearAboutUs,
      preferredCommunication,
      socialMedia: socialMedia || null,

      // Contact & Verification
      whatsappNumber,
      idPhoto: idPhotoUrl,
      proofOfAddress: proofOfAddressUrl, // Can be null if not provided

      verificationStatus: "not verified",

      referredBy: referredBy || null, // Store the referral code that was used to refer this agent
      referralCode: referralCodeForAgent, // This agent's own unique referral code
      freeListingWeeks: 0,
      totalReferrals: 0,
    };

    // ✅ Remove any undefined values to avoid schema issues
    Object.keys(agentData).forEach((key) => {
      if (agentData[key] === undefined) {
        delete agentData[key];
      }
    });

    const agent = await Agent.create(agentData);

    await User.findByIdAndUpdate(req.user.id, {
      role: "agent",
      agentProfile: agent._id,
    });

    if (referredByAgent) {
      console.log("🎁 Rewarding referring agent:", referredByAgent._id);

      // Give the referring agent 1 free listing week
      referredByAgent.freeListingWeeks += 1;
      console.log(
        "referredByAgent.freeListingWeeks: ",
        referredByAgent.freeListingWeeks
      );
      referredByAgent.totalReferrals += 1;
      console.log(
        "referredByAgent.totalReferrals: ",
        referredByAgent.totalReferrals
      );
      console.log("referredByAgent: ", referredByAgent);
      await Agent.findOneAndUpdate(
        { referralCode: referredBy },
        {
          $inc: {
            totalReferrals: 1,
            freeListingWeeks: 1,
          },
        }
      );

      console.log(
        "✅ Referral reward given successfully. Referring agent now has:",
        referredByAgent.freeListingWeeks,
        "free weeks"
      );
    }

    try {
      console.log(4);
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

exports.getLoggedInAgentProfile = async (req, res) => {
  try {
    const agent = await Agent.findOne({ userId: req.user.id })
      .populate("userId", "name email phone avatar role")
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
