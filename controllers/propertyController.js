const Property = require("../models/Property");
const User = require("../models/User");
const Agent = require("../models/Agent");
const { sendPropertyListingEmail } = require("../services/emailService");

exports.createProperty = async (req, res) => {
  console.log("--- createProperty called ---");
  console.log("req.files:", req.files);
  console.log("req.body:", req.body);

  try {
    // Check if user is an agent
    if (req.user.role !== "agent") {
      return res.status(403).json({
        success: false,
        error: "Only agents can create properties",
      });
    }

    // Find agent and check verification status
    const agent = await Agent.findOne({ userId: req.user.id });

    if (!agent) {
      return res.status(403).json({
        success: false,
        error:
          "Agent profile not found. Please complete your agent profile first.",
      });
    }

    // Check if agent is verified
    if (agent.verificationStatus !== "verified") {
      return res.status(403).json({
        success: false,
        error:
          "Your agent account is not verified yet. Please wait for verification to create listings.",
      });
    }

    // Check subscription status
    if (!agent.canListProperties()) {
      return res.status(403).json({
        success: false,
        error:
          "Your subscription has expired. Please subscribe to continue listing properties.",
      });
    }

    // 1. Extract Cloudinary URLs from req.files
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        imageUrls.push(file.path);
      }
    }

    console.log("Extracted image URLs:", imageUrls);

    // 2. Process the property data
    const normalizedBody = {
      ...req.body,
      images: imageUrls,
      type: req.body.type || req.body.propertyType,
    };

    const property = new Property({
      ...normalizedBody,
      agentId: req.user.id,
    });

    await property.save();

    // Optional: send email to agent
    const user = await User.findById(req.user.id);
    const agentProfile = await Agent.findOne({ userId: req.user.id });

    if (user && agentProfile) {
      await sendPropertyListingEmail(
        { ...user.toObject(), ...agentProfile.toObject() },
        property
      );
    }

    res.status(201).json({ success: true, data: property });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};
exports.getProperties = async (req, res) => {
  try {
    const {
      location,
      type,
      minPrice,
      maxPrice,
      bedrooms,
      amenities,
      sortBy,
      page = 1,
      limit = 10,
    } = req.query;

    let filter = { isActive: true };

    if (location) filter.location = new RegExp(location, "i");
    if (type) filter.type = type;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (bedrooms) filter.bedrooms = Number(bedrooms);
    if (amenities) {
      filter.amenities = { $all: amenities.split(",") };
    }

    // sort logic
    let sort = {};
    switch (sortBy) {
      case "price_asc":
        sort = { price: 1 };
        break;
      case "price_desc":
        sort = { price: -1 };
        break;
      case "newest":
        sort = { createdAt: -1 };
        break;
      case "oldest":
        sort = { createdAt: 1 };
        break;
      case "most_viewed":
        sort = { views: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    const properties = await Property.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("agentId", "name phone");

    const total = await Property.countDocuments(filter);

    res.json({
      success: true,
      data: properties,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// GET single property
exports.getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate(
      "agentId",
      "name phone email avatar"
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    property.views += 1;
    await property.save();

    res.json({
      success: true,
      data: property,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
