const Property = require("../models/Property");
const User = require("../models/User");
const Agent = require("../models/Agent");
const { sendPropertyListingEmail } = require("../services/emailService");
/**
 * Backend authorization logic for agent listing permissions
 */

const canAgentListPropertiesBackend = async (agent) => {
  const now = new Date();

  // 1. Check free listing weeks
  if (agent.freeListingWeeks > 0) {
    return true;
  }

  // 2. Check subscription status
  if (
    agent.subscription?.status === "active" &&
    agent.subscription.currentPeriodEnd
  ) {
    const periodEnd = new Date(agent.subscription.currentPeriodEnd);
    return now <= periodEnd;
  }

  // 3. Check trial period
  if (
    agent.subscription?.status === "trial" &&
    agent.subscription.trialEndsAt
  ) {
    const trialEnds = new Date(agent.subscription.trialEndsAt);
    return now <= trialEnds;
  }

  // 4. Check grace period (7 days from verification)
  const verifiedAt = agent.verifiedAt || agent.verificationData?.verifiedAt;
  if (verifiedAt) {
    const verifiedDate = new Date(verifiedAt);
    const sevenDaysLater = new Date(
      verifiedDate.getTime() + 7 * 24 * 60 * 60 * 1000
    );
    return now <= sevenDaysLater;
  }

  return false;
};

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

    // ✅ FIXED: Find agent by userId (not agentId)
    const agent = await Agent.findOne({ userId: req.agent.id });

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

    // Check subscription status using backend authorization logic
    const canList = await canAgentListPropertiesBackend(agent);
    if (!canList) {
      return res.status(403).json({
        success: false,
        error:
          "You don't have active listing credits. Please subscribe or use referral credits to list properties.",
      });
    }

    // ✅ FIXED: Handle file uploads safely
    let imageUrls = [];

    // Check multiple files
    if (req.files && req.files.length > 0) {
      console.log(`📸 Found ${req.files.length} files in req.files`);
      try {
        const uploadPromises = req.files.map((file) =>
          cloudinary.uploader.upload(file.path, {
            folder: "lagos-rent-help/agents/properties",
            transformation: [
              { width: 1500, height: 1024, crop: "fill" },
              { quality: "auto" },
            ],
          })
        );

        const uploadResults = await Promise.all(uploadPromises);
        imageUrls = uploadResults.map((result) => result.secure_url);
        console.log("✅ Property photos uploaded to Cloudinary:", imageUrls);
      } catch (uploadError) {
        console.error("❌ Property photo upload error:", uploadError);
        return res.status(400).json({
          success: false,
          error: `Failed to upload property photos: ${uploadError.message}`,
        });
      }
    }
    // Check single file
    else if (req.file) {
      console.log("📸 Found single file in req.file");
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "lagos-rent-help/agents/properties",
          transformation: [
            { width: 1500, height: 1024, crop: "fill" },
            { quality: "auto" },
          ],
        });
        imageUrls = [result.secure_url];
        console.log("✅ Single property photo uploaded:", imageUrls[0]);
      } catch (uploadError) {
        console.error("❌ Single photo upload error:", uploadError);
        return res.status(400).json({
          success: false,
          error: `Failed to upload property photo: ${uploadError.message}`,
        });
      }
    }
    // No files
    else {
      console.log("❌ No files found in req.files or req.file");
      console.log("🔍 Available request properties:", Object.keys(req));
      return res.status(400).json({
        success: false,
        error: "No images uploaded. Please upload at least one property image.",
      });
    }

    // ... rest of your code ...

    // Parse amenities if it comes as JSON string
    let amenities = [];
    if (req.body.amenities) {
      try {
        amenities = JSON.parse(req.body.amenities);
      } catch (err) {
        console.warn("Invalid amenities JSON:", err.message);
        amenities = [];
      }
    }

    // Normalize property data
    const normalizedBody = {
      ...req.body,
      amenities, // ensure it's stored as array
      images: imageUrls,
      type: req.body.type || req.body.propertyType,
    };

    const property = new Property({
      ...normalizedBody,
      agentId: req.agent.id,
    });

    await property.save();

    // ✅ UPDATE AGENT'S LISTINGS ARRAY
    agent.listings.push(property._id);
    await agent.save();

    // Send email to agent
    const user = await User.findById(req.user.id);

    // We already have the agent, no need to find it again
    if (user && agent) {
      await sendPropertyListingEmail(
        { ...user.toObject(), ...agent.toObject() },
        property
      );
    }

    res.status(201).json({
      success: true,
      data: property,
      message: "Property listed successfully and added to your listings",
    });
  } catch (error) {
    console.error("Create Property Error:", error);
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
      status,
      sortBy,
      page = 1,
      limit = 10,
    } = req.query;

    let filter = {};

    // ✅ Handle status filter - support multiple statuses with default
    if (status) {
      if (Array.isArray(status)) {
        // If status is an array (e.g., ?status=available&status=pending)
        filter.status = { $in: status };
      } else if (typeof status === "string" && status.includes(",")) {
        // If status is a comma-separated string (e.g., ?status=available,pending)
        filter.status = { $in: status.split(",") };
      } else {
        // If status is a single value
        filter.status = status;
      }
    } else {
      // ✅ DEFAULT: Show only available properties when no status is provided
      filter.status = "available";
    }

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
      filters: {
        status: filter.status, // Return the applied status filter for clarity
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
    // Your Property model has agentId, not userId
    const property = await Property.findById(req.params.id)
      .populate("agentId", "name phone email") // Populate agentId (which references User model)
      .lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    // Check if property has an agent assigned
    if (!property.agentId) {
      return res.status(400).json({
        success: false,
        error: "This property has no assigned agent",
      });
    }

    // FIXED: Find agent profile using the agentId (which is actually the user ID)
    const agent = await Agent.findOne({ userId: property.agentId._id })
      .select(
        "idPhoto verificationStatus whatsappNumber totalViews bio experience rating totalReviews"
      )
      .lean();

    // Increment views
    await Property.findByIdAndUpdate(req.params.id, {
      $inc: { views: 1 },
    });

    if (agent) {
      await Agent.findByIdAndUpdate(agent._id, {
        $inc: { totalViews: 1 },
      });
    }

    const responseData = {
      ...property,
      agent: agent
        ? {
            ...property.agent,
            agentId: agent._id, // Include the agent document ID
            verificationStatus: agent.verificationStatus,
          }
        : null,
    };
    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching property:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
const { cloudinary } = require("../config/cloudinary");

exports.updateProperty = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("🔄 Starting property update for ID:", id);
    console.log("Request body:", req.body);
    console.log("Files:", req.files ? req.files.length : 0);

    // 1. Find the property
    const property = await Property.findById(id);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    console.log("📋 Found property:", {
      id: property._id,
      title: property.title,
      amenities: property.amenities,
      amenitiesType: typeof property.amenities,
      isArray: Array.isArray(property.amenities),
    });

    // 2. Check authorization
    if (property.agentId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to update this property",
      });
    }

    // 3. Upload new images if provided
    let newImages = [];
    if (req.files && req.files.length > 0) {
      try {
        console.log(`📁 Processing ${req.files.length} files for upload...`);

        const uploadPromises = req.files.map((file) => {
          console.log(`📁 Processing file: ${file.originalname}`);
          return cloudinary.uploader.upload(file.path, {
            folder: "lagos-rent-help/agents/properties",
            transformation: [
              { width: 1500, height: 1024, crop: "fill" },
              { quality: "auto" },
            ],
          });
        });

        const uploaded = await Promise.all(uploadPromises);
        newImages = uploaded.map((img) => img.secure_url);
        console.log(`✅ Successfully uploaded ${newImages.length} images`);
      } catch (err) {
        console.error("Image upload error:", err);
        return res.status(400).json({
          success: false,
          error: `Failed to upload images: ${err.message}`,
        });
      }
    }

    // 4. Handle amenities safely with proper fallbacks
    let amenities = Array.isArray(property.amenities) ? property.amenities : [];
    if (req.body.amenities) {
      try {
        const parsed = JSON.parse(req.body.amenities);
        if (Array.isArray(parsed)) {
          amenities = parsed;
        }      
      } catch {
        amenities = property.amenities;
      }
    }

    console.log("🏠 Final amenities to save:", amenities);

    // 5. Handle totalPackagePrice - ensure it's a number, not an array
    let totalPackagePrice = property.totalPackagePrice || 0;
    if (req.body.totalPackagePrice) {
      // If it's an array, take the first value
      if (Array.isArray(req.body.totalPackagePrice)) {
        totalPackagePrice = Number(req.body.totalPackagePrice[0]) || 0;
      } else {
        totalPackagePrice = Number(req.body.totalPackagePrice) || 0;
      }
    }

    // 6. Build updated fields safely with proper type conversion and fallbacks
    const updates = {
      title: req.body.title ?? property.title,
      description: req.body.description ?? property.description,
      price: req.body.price ? Number(req.body.price) : property.price,
      totalPackagePrice: totalPackagePrice,
      bedrooms: req.body.bedrooms
        ? Number(req.body.bedrooms)
        : property.bedrooms || 0,
      bathrooms: req.body.bathrooms
        ? Number(req.body.bathrooms)
        : property.bathrooms || 0,
      location: req.body.location ?? property.location,
      type: req.body.type ?? property.type,
      status: req.body.status ?? property.status,
      amenities,
      images: newImages.length > 0 ? newImages : property.images || [],
    };

    // 7. Remove undefined values to avoid overwriting with undefined
    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    });

    console.log("🔄 Applying updates:", updates);

    // 8. Apply changes directly to the Mongoose document
    Object.keys(updates).forEach((key) => {
      property[key] = updates[key];
    });

    // 9. Validate and save
    await property.validate(); // This will trigger Mongoose validation
    await property.save();

    console.log("✅ Property updated successfully");

    res.json({
      success: true,
      message: "Property updated successfully",
      data: property,
    });
  } catch (error) {
    console.error("Update Property Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
// Optional: Keep deactivateProperty as a convenience function
exports.deactivateProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // Find property by ID
    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    // Ensure only the agent who created the property can deactivate it
    if (property.agentId.toString() !== req.agent.id) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to deactivate this property",
      });
    }

    // ✅ FIXED: Update status instead of isActive
    property.status = "rented";
    await property.save();

    res.json({
      success: true,
      message: "Property has been marked as rented",
      data: property,
    });
  } catch (error) {
    console.error("Deactivate Property Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
