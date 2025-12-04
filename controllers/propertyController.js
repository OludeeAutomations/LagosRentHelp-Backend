const Property = require("../models/Property");
const User = require("../models/User");
const Agent = require("../models/Agent");
const { sendPropertyListingEmail } = require("../services/emailService");
const { cloudinary } = require("../config/cloudinary");

/**
 * Backend authorization logic for agent listing permissions
 */

exports.createProperty = async (req, res) => {
  try {
    // 1. Check User Auth
    if (!req.user || req.user.role !== "agent") {
      return res.status(403).json({
        success: false,
        error: "Only agents can create properties",
      });
    }

    // 2. Find Agent Profile
    const agent = await Agent.findOne({ userId: req.user.id });

    if (!agent) {
      return res.status(403).json({
        success: false,
        error:
          "Agent profile not found. Please complete your agent profile first.",
      });
    }

    // 3. Check Verification
    if (agent.verificationStatus !== "verified") {
      return res.status(403).json({
        success: false,
        error: "Your agent account is not verified yet.",
      });
    }

    // 4. Check Restrictions (Re-enabled)
    // This uses your model method to check for 6-month trial / referral extensions
    if (!agent.canListProperties()) {
      return res.status(403).json({
        success: false,
        error:
          "Subscription expired. Please subscribe or refer a friend to list properties.",
      });
    }

    // 5. Handle Images
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
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
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        return res.status(400).json({
          success: false,
          error: "Failed to upload images",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: "Please upload at least one property image.",
      });
    }

    // 6. Parse Amenities
    let amenities = [];
    if (req.body.amenities) {
      try {
        amenities =
          typeof req.body.amenities === "string"
            ? JSON.parse(req.body.amenities)
            : req.body.amenities;
      } catch (err) {
        amenities = [];
      }
    }

    // 7. Prepare Data
    const normalizedBody = {
      ...req.body,
      amenities,
      images: imageUrls,
      type: req.body.type || req.body.propertyType,
    };

    // 8. Create Property
    // ✅ This is the line that was crashing. It is now fixed.
    const property = new Property({
      ...normalizedBody,
      agentId: agent._id, // Uses the found agent's ID
    });

    await property.save();

    // 9. Update Agent
    agent.listings.push(property._id);
    await agent.save();

    // 10. Send Email (Async)
    const user = await User.findById(req.user.id);
    if (user && agent) {
      sendPropertyListingEmail(
        { ...user.toObject(), ...agent.toObject() },
        property
      ).catch((err) => console.error("Email sending failed:", err.message));
    }

    res.status(201).json({
      success: true,
      data: property,
      message: "Property listed successfully",
    });
  } catch (error) {
    console.error("Create Property Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
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
    const property = await Property.findById(req.params.id)
      .populate({
        path: "agentId", // 1. Populate the Agent
        select:
          "fullName residentialAddress state city idPhoto whatsappNumber verificationStatus userId",
        populate: {
          path: "userId", // 2. Inside Agent, Populate the User
          select: "name email phone avatar",
          strictPopulate: false, // 👈 Safety flag
        },
      })
      .lean();

    if (!property) {
      return res
        .status(404)
        .json({ success: false, error: "Property not found" });
    }

    // DEBUG: Check what we actually got
    // console.log("Populated Property Agent:", property.agentId);

    const agentProfile = property.agentId;

    if (!agentProfile) {
      return res
        .status(400)
        .json({ success: false, error: "This property has no assigned agent" });
    }

    const loggedInUser = req.user ? req.user._id.toString() : null;

    const agentUserId =
      agentProfile.userId && agentProfile.userId._id
        ? agentProfile.userId._id.toString()
        : agentProfile.userId
        ? agentProfile.userId.toString()
        : null;

    const isOwner = loggedInUser && agentUserId && loggedInUser === agentUserId;

    // 4. Increment views only if it's NOT the owner
    if (!isOwner) {
      await Property.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

      // Update Agent total views
      await Agent.findByIdAndUpdate(agentProfile._id, {
        $inc: { totalViews: 1 },
      });
    }
    // Format the data for the frontend
    const formattedAgent = {
      _id: agentProfile._id,
      // Try to get name from Agent Profile first (fullName), fallback to User (name)
      name:
        agentProfile.fullName ||
        (agentProfile.userId ? agentProfile.userId.name : "Agent"),
      email: agentProfile.userId ? agentProfile.userId.email : "",
      phone: agentProfile.userId ? agentProfile.userId.phone : "",
      whatsapp: agentProfile.whatsappNumber,
      photo: agentProfile.idPhoto,
      verificationStatus: agentProfile.verificationStatus,
      state: agentProfile.state,
      city: agentProfile.city,
    };

    res.json({
      success: true,
      data: {
        ...property,
        agent: formattedAgent,
        agentId: agentProfile._id,
      },
    });
  } catch (error) {
    console.error("Error fetching property:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // Safety check for req.body
    const body = req.body || {};

    console.log("🔄 Starting property update for ID:", id);
    console.log("Request body keys:", Object.keys(body));
    console.log("Files:", req.files ? req.files.length : 0);

    // 1. Find the property
    const property = await Property.findById(id);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    // 2. Find the Agent Profile
    const agent = await Agent.findOne({ userId: req.user.id });
    if (!agent) {
      return res.status(403).json({
        success: false,
        error: "Agent profile not found. You cannot update properties.",
      });
    }

    // 3. Check Authorization
    if (property.agentId.toString() !== agent._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to update this property",
      });
    }

    // 4. Parse amenities safely
    let amenities = Array.isArray(property.amenities) ? property.amenities : [];
    if (body.amenities) {
      try {
        const parsed = JSON.parse(body.amenities);
        if (Array.isArray(parsed)) {
          amenities = parsed;
        }
      } catch {
        amenities = property.amenities;
      }
    }

    // 5. Parse images to remove
    let imagesToRemove = [];
    if (body.imagesToRemove) {
      try {
        imagesToRemove = JSON.parse(body.imagesToRemove);
        if (!Array.isArray(imagesToRemove)) {
          imagesToRemove = [];
        }
      } catch {
        imagesToRemove = [];
      }
    }

    // 6. Handle images to remove from Cloudinary
    if (imagesToRemove.length > 0) {
      try {
        // Extract public IDs from Cloudinary URLs
        const publicIdsToRemove = imagesToRemove.map((url) => {
          const parts = url.split("/");
          const filename = parts[parts.length - 1];
          const publicId = filename.split(".")[0];
          return `lagos-rent-help/agents/properties/${publicId}`;
        });

        // Delete from Cloudinary in batches
        for (const publicId of publicIdsToRemove) {
          try {
            await cloudinary.uploader.destroy(publicId);
            console.log(`✅ Removed image from Cloudinary: ${publicId}`);
          } catch (cloudinaryErr) {
            console.error(
              `Failed to delete image from Cloudinary: ${publicId}`,
              cloudinaryErr
            );
          }
        }

        // Remove from property images array
        property.images = property.images.filter(
          (img) => !imagesToRemove.includes(img)
        );
      } catch (removeErr) {
        console.error("Error removing images:", removeErr);
      }
    }

    // 7. Upload new images if provided
    let newImages = [];
    if (req.files && req.files.length > 0) {
      try {
        const uploadPromises = req.files.map((file) => {
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

        // Clean up temporary files
        req.files.forEach((file) => {
          fs.unlinkSync(file.path);
        });
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: `Failed to upload images: ${err.message}`,
        });
      }
    }

    // 8. Handle totalPackagePrice
    let totalPackagePrice = property.totalPackagePrice || 0;
    if (body.totalPackagePrice) {
      if (Array.isArray(body.totalPackagePrice)) {
        totalPackagePrice = Number(body.totalPackagePrice[0]) || 0;
      } else {
        totalPackagePrice = Number(body.totalPackagePrice) || 0;
      }
    }

    // 9. Prepare updates object
    const updates = {
      title: body.title || property.title,
      description: body.description || property.description,
      price: body.price ? Number(body.price) : property.price,
      totalPackagePrice: totalPackagePrice,
      bedrooms: body.bedrooms ? Number(body.bedrooms) : property.bedrooms,
      bathrooms: body.bathrooms ? Number(body.bathrooms) : property.bathrooms,
      location: body.location || property.location,
      type: body.type || property.type,
      listingType: body.listingType || property.listingType,
      status: body.status || property.status,
      amenities: amenities,
      // Add new images to existing ones (after removing marked ones)
      images: [...property.images, ...newImages],
      updatedAt: new Date(),
    };

    // 10. Apply updates
    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        property[key] = updates[key];
      }
    });

    // 11. Save the updated property
    await property.save();

    // 12. Populate agent details for response (REMOVED reviews.userId population)
    const updatedProperty = await Property.findById(id).populate(
      "agentId",
      "firstName lastName email phone companyName verificationStatus"
    );
    // Removed: .populate('reviews.userId', 'name email'); // This was causing the error

    console.log("✅ Property updated successfully");

    res.json({
      success: true,
      message: "Property updated successfully",
      data: updatedProperty,
    });
  } catch (error) {
    console.error("Update Property Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
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

exports.deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    if (property.agentId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to delete this property",
      });
    }

    if (property.images && property.images.length > 0) {
      const deletePromises = property.images.map((imageUrl) => {
        const publicId = imageUrl.split("/").slice(-2).join("/").split(".")[0]; // extract folder/file without extension

        return cloudinary.uploader.destroy(publicId);
      });

      await Promise.all(deletePromises);
    }

    await Property.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: "Property deleted successfully",
    });
  } catch (error) {
    console.error("Delete Property Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
