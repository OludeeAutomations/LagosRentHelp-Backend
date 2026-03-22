const mongoose = require("mongoose");
const Property = require("../models/Property");
const User = require("../models/User");
const { sendPropertyListingEmail } = require("../services/emailService");
const { cloudinary } = require("../config/cloudinary");

const PROPERTY_POPULATION = [
  { path: "ownerId", select: "name email phone avatar role" },
  { path: "contactUserId", select: "name email phone avatar role" },
  { path: "createdBy", select: "name email phone avatar role" },
  { path: "approvedBy", select: "name email phone avatar role" },
];

const applyPopulation = (query) => {
  PROPERTY_POPULATION.forEach((option) => query.populate(option));
  return query;
};

const parseAmenities = (amenities, fallback = []) => {
  if (!amenities) return fallback;
  if (Array.isArray(amenities)) return amenities;
  if (typeof amenities === "string") return JSON.parse(amenities);
  return fallback;
};

const parseCoordinates = (body) => {
  const rawCoordinates = body.coordinates || body.locationCoordinates;

  if (rawCoordinates) {
    const parsed =
      typeof rawCoordinates === "string"
        ? JSON.parse(rawCoordinates)
        : rawCoordinates;

    const lat = Number(parsed.lat ?? parsed.latitude);
    const lng = Number(parsed.lng ?? parsed.longitude);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  const lat = Number(body.lat ?? body.latitude);
  const lng = Number(body.lng ?? body.longitude);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return null;
};

const getPublicApprovalFilter = () => ({
  $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
});

const hydrateLegacyPropertyMetadata = (property, userId) => {
  if (!property.contactUserId) {
    property.contactUserId = property.ownerId;
  }

  if (!property.createdBy) {
    property.createdBy = userId || property.ownerId;
  }

  return property;
};

const isManagedByUser = (property, user) => {
  if (!user) return false;
  if (user.role === "super_admin") return true;

  const createdBy = String(property.createdBy?._id || property.createdBy);
  const contactUserId = String(
    property.contactUserId?._id || property.contactUserId,
  );

  return createdBy === String(user._id) || contactUserId === String(user._id);
};

const uploadPropertyImages = async (files = []) => {
  if (!files.length) return [];

  const uploadResults = await Promise.all(
    files.map((file) =>
      cloudinary.uploader.upload(file.path, {
        folder: "lagos-rent-help/properties",
        transformation: [
          { width: 1500, height: 1024, crop: "fill" },
          { quality: "auto" },
        ],
      }),
    ),
  );

  return uploadResults.map((result) => result.secure_url);
};

exports.createProperty = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one image is required",
      });
    }

    const coordinates = parseCoordinates(req.body);
    if (!coordinates) {
      return res.status(400).json({
        success: false,
        error: "Valid property coordinates are required",
      });
    }

    const ownerId =
      req.body.ownerId || req.body.assignedToUserId || req.body.userId;

    if (!ownerId || !mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({
        success: false,
        error: "A valid assigned user is required",
      });
    }

    const assignedUser = await User.findById(ownerId);
    if (!assignedUser) {
      return res.status(404).json({
        success: false,
        error: "Assigned user not found",
      });
    }

    const imageUrls = await uploadPropertyImages(req.files);
    const amenities = parseAmenities(req.body.amenities, []);
    const isSuperAdmin = req.user.role === "super_admin";

    const property = await Property.create({
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      location: req.body.location,
      totalPackagePrice: req.body.totalPackagePrice,
      type: req.body.type || req.body.propertyType,
      listingType: req.body.listingType,
      bedrooms: req.body.bedrooms,
      bathrooms: req.body.bathrooms,
      area: req.body.area,
      amenities,
      images: imageUrls,
      ownerId,
      contactUserId: req.user.id,
      createdBy: req.user.id,
      status: req.body.status || "available",
      approvalStatus: isSuperAdmin ? "approved" : "pending",
      approvedBy: isSuperAdmin ? req.user.id : undefined,
      approvedAt: isSuperAdmin ? new Date() : undefined,
      approvalNote: req.body.approvalNote,
      coordinates,
      availableFrom: req.body.availableFrom,
      minimumStay: req.body.minimumStay,
    });

    if (isSuperAdmin) {
      sendPropertyListingEmail(req.user, property).catch((err) =>
        console.error("Email sending failed:", err.message),
      );
    }

    const populatedProperty = await applyPopulation(
      Property.findById(property._id),
    );

    res.status(201).json({
      success: true,
      data: await populatedProperty,
      message: isSuperAdmin
        ? "Property uploaded and approved successfully"
        : "Property uploaded successfully and is awaiting approval",
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

    const filter = getPublicApprovalFilter();

    if (status) {
      if (Array.isArray(status)) filter.status = { $in: status };
      else if (typeof status === "string" && status.includes(",")) {
        filter.status = { $in: status.split(",") };
      } else {
        filter.status = status;
      }
    } else {
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
    if (amenities) filter.amenities = { $all: amenities.split(",") };

    let sort = { createdAt: -1 };
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
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const properties = await applyPopulation(
      Property.find(filter)
        .sort(sort)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
    );

    const total = await Property.countDocuments(filter);

    res.json({
      success: true,
      data: await properties,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      filters: {
        status: filter.status,
        approvalStatus: "approved",
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getManagedProperties = async (req, res) => {
  try {
    const {
      approvalStatus,
      status,
      ownerId,
      contactUserId,
      createdBy,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (req.user.role === "admin") {
      filter.$or = [
        { createdBy: req.user.id },
        { contactUserId: req.user.id },
        { ownerId: req.user.id },
      ];
    }

    if (approvalStatus) filter.approvalStatus = approvalStatus;
    if (status) filter.status = status;
    if (ownerId) filter.ownerId = ownerId;
    if (contactUserId) filter.contactUserId = contactUserId;
    if (createdBy && req.user.role === "super_admin") filter.createdBy = createdBy;

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const properties = await applyPopulation(
      Property.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
    );

    const total = await Property.countDocuments(filter);

    res.json({
      success: true,
      data: await properties,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getPropertyById = async (req, res) => {
  try {
    const property = await applyPopulation(
      Property.findById(req.params.id),
    ).lean();

    if (!property) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    if (
      property.approvalStatus &&
      property.approvalStatus !== "approved"
    ) {
      return res
        .status(404)
        .json({ success: false, error: "Property not found" });
    }

    const ownerId = String(property.ownerId?._id || property.ownerId);
    if (!req.user || req.user.id !== ownerId) {
      await Property.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    }

    res.json({ success: true, data: property });
  } catch (error) {
    console.error("Error fetching property:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getManagedPropertyById = async (req, res) => {
  try {
    const property = await applyPopulation(
      Property.findById(req.params.id),
    );

    if (!property) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    hydrateLegacyPropertyMetadata(property, req.user.id);

    if (!isManagedByUser(property, req.user)) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to view this property",
      });
    }

    res.json({ success: true, data: property });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    hydrateLegacyPropertyMetadata(property, req.user.id);

    if (!isManagedByUser(property, req.user)) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to update this property",
      });
    }

    const amenities = parseAmenities(req.body.amenities, property.amenities);
    const parsedCoordinates = parseCoordinates(req.body);

    let images = property.images || [];
    if (req.files && req.files.length > 0) {
      const uploadedImages = await uploadPropertyImages(req.files);
      images = [...images, ...uploadedImages];
    }

    if (req.body.ownerId || req.body.assignedToUserId || req.body.userId) {
      const nextOwnerId =
        req.body.ownerId || req.body.assignedToUserId || req.body.userId;

      if (!mongoose.Types.ObjectId.isValid(nextOwnerId)) {
        return res.status(400).json({
          success: false,
          error: "Assigned user is invalid",
        });
      }

      const assignedUser = await User.findById(nextOwnerId);
      if (!assignedUser) {
        return res.status(404).json({
          success: false,
          error: "Assigned user not found",
        });
      }

      property.ownerId = nextOwnerId;
    }

    property.title = req.body.title || property.title;
    property.description = req.body.description || property.description;
    property.price = req.body.price ? Number(req.body.price) : property.price;
    property.totalPackagePrice =
      req.body.totalPackagePrice || property.totalPackagePrice;
    property.bedrooms = req.body.bedrooms || property.bedrooms;
    property.bathrooms = req.body.bathrooms || property.bathrooms;
    property.location = req.body.location || property.location;
    property.type = req.body.type || property.type;
    property.listingType = req.body.listingType || property.listingType;
    property.status = req.body.status || property.status;
    property.amenities = amenities;
    property.images = images;
    property.availableFrom = req.body.availableFrom || property.availableFrom;
    property.minimumStay = req.body.minimumStay || property.minimumStay;

    if (parsedCoordinates) {
      property.coordinates = parsedCoordinates;
    }

    if (req.user.role === "admin") {
      property.approvalStatus = "pending";
      property.approvedBy = undefined;
      property.approvedAt = undefined;
    }

    await property.save();

    const populatedProperty = await applyPopulation(
      Property.findById(property._id),
    );

    res.json({
      success: true,
      message:
        req.user.role === "super_admin"
          ? "Property updated successfully"
          : "Property updated successfully and sent for re-approval",
      data: await populatedProperty,
    });
  } catch (error) {
    console.error("Update Property Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deactivateProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    hydrateLegacyPropertyMetadata(property, req.user.id);

    if (!isManagedByUser(property, req.user)) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to deactivate this property",
      });
    }

    property.status = "rented";
    await property.save();

    res.json({
      success: true,
      message: "Property has been marked as rented",
      data: property,
    });
  } catch (error) {
    console.error("Deactivate Property Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.approveProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    const approvalStatus = req.body.approvalStatus || "approved";

    if (!["approved", "rejected"].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        error: "approvalStatus must be approved or rejected",
      });
    }

    property.approvalStatus = approvalStatus;
    property.approvedBy = req.user.id;
    property.approvedAt = new Date();
    property.approvalNote = req.body.approvalNote || property.approvalNote;

    await property.save();

    const populatedProperty = await applyPopulation(
      Property.findById(property._id),
    );

    res.json({
      success: true,
      message:
        approvalStatus === "approved"
          ? "Property approved successfully"
          : "Property rejected successfully",
      data: await populatedProperty,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    if (property.images?.length) {
      const deletePromises = property.images.map((imageUrl) => {
        const publicId = imageUrl
          .split("/")
          .slice(-2)
          .join("/")
          .split(".")[0];
        return cloudinary.uploader.destroy(publicId);
      });

      await Promise.all(deletePromises);
    }

    await Property.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Property deleted successfully" });
  } catch (error) {
    console.error("Delete Property Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
