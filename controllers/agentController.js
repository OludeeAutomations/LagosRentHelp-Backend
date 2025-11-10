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

    // ✅ SIMPLE FIX: Clean empty strings from FormData
    const cleanData = (data) => {
      const cleaned = {};
      for (const [key, value] of Object.entries(data)) {
        cleaned[key] = value === "" ? null : value;
      }
      return cleaned;
    };

    const cleanedBody = cleanData(req.body);

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
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
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

    // Validate communication preference
    const validCommunication = ["whatsapp", "email", "phone"];
    if (!validCommunication.includes(preferredCommunication)) {
      return res.status(400).json({
        success: false,
        error: "Invalid communication preference",
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

    // Check referral code
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

    // Must have ID photo
    if (!req.files?.idPhoto) {
      return res.status(400).json({
        success: false,
        error: "Professional photo is required",
      });
    }
    if (!req.files?.proofOfAddress) {
      return res.status(400).json({
        success: false,
        error: "Proof of address photo is required",
      });
    }
    // Upload professional photo to Cloudinary
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

    // Upload proof of address if provided
    let proofOfAddressUrl = "";
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
        return res.status(400).json({
          success: false,
          error: `Failed to upload proof of address: ${uploadError.message}`,
        });
      }
    }

    // Generate unique referral code for the new agent
    const generateReferralCode = () => {
      const prefix = "REF";
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      return prefix + randomNum;
    };

    const referralCodeForAgent = generateReferralCode();

    // Create agent profile with enhanced data
    const agentData = {
      userId: req.user.id,
      fullName: req.user.name,
      email: req.user.email,
      phone: req.user.phone,

      gender: cleanedBody.gender,
      dateOfBirth: new Date(cleanedBody.dateOfBirth),
      residentialAddress: cleanedBody.residentialAddress,
      state: cleanedBody.state,
      city: cleanedBody.city,
      institutionName: cleanedBody.institutionName || null,
      campusCode: cleanedBody.campusCode || null,
      bio: cleanedBody.bio,
      experience: cleanedBody.experience || null,
      motivation: cleanedBody.motivation,
      hearAboutUs: cleanedBody.hearAboutUs,
      preferredCommunication: cleanedBody.preferredCommunication,
      socialMedia: cleanedBody.socialMedia || null,
      whatsappNumber: cleanedBody.whatsappNumber,

      // Files
      idPhoto: idPhotoUrl,
      proofOfAddress: proofOfAddressUrl, // Can be null if not provided

      verificationStatus: "not verified",
      referredBy: referredByAgent ? cleanedBody.referralCode : null,
      referralCode: referralCodeForAgent,
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

    // Reward referral if applicable
    if (referredByAgent) {
      referredByAgent.freeListingWeeks += 1;
      referredByAgent.totalReferrals += 1;
      await referredByAgent.save();

      // Create referral record
      await Referral.create({
        referringAgent: referredByAgent._id,
        newAgent: agent._id,
        referralCode: referralCode,
        rewardGiven: true,
        rewardType: "free_listing_week",
      });
    }

    // Send welcome email to agent
    try {
      await sendWelcomeEmail({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        phone: phone,
        role: "agent_pending",
      });
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail the request if email fails
    }

    // Send notification to admin about new agent application
    try {
      await sendAdminNotification({
        type: "new_agent_application",
        agentName: req.user.name,
        agentEmail: req.user.email,
        agentLocation: `${city}, ${state}`,
        applicationDate: new Date(),
      });
    } catch (notificationError) {
      console.error("Failed to send admin notification:", notificationError);
    }

    // ✅ Send comprehensive response
    res.status(201).json({
      success: true,
      data: {
        agent: {
          _id: agent._id,
          verificationStatus: agent.verificationStatus,
          referralCode: agent.referralCode,
          createdAt: agent.createdAt,
        },

        referral: referredByAgent
          ? {
              rewarded: true,
              freeListingWeeks: 1,
            }
          : null,
      },
      message:
        "Agent application submitted successfully! Your profile is under review and you'll be notified within 24-48 hours.",
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
