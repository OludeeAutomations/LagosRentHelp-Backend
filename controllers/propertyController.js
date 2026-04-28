const { cloudinary } = require("../config/cloudinary");
const { sendPropertyListingEmail } = require("../services/emailService");
const { findById: findUserById } = require("../repositories/users");
const propertyRepo = require("../repositories/properties");
const { uploadPropertyImages } = require("../utils/uploadToCloudinary");

const parseAmenities = (amenities, fallback = []) => {
  if (!amenities) return fallback;
  if (Array.isArray(amenities)) return amenities;
  if (typeof amenities === "string") return JSON.parse(amenities);
  return fallback;
};

const hydrateLegacyPropertyMetadata = (property, userId) => {
  if (!property.contactUserId) property.contactUserId = property.ownerId;
  if (!property.createdBy) property.createdBy = userId || property.ownerId;
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

exports.createProperty = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one image is required",
      });
    }

    const coordinates = req.body.coordinates
      ? JSON.parse(req.body.coordinates)
      : null;

    const ownerId =
      req.body.ownerId || req.body.assignedToUserId || req.body.userId;

    if (!ownerId) {
      return res.status(400).json({
        success: false,
        error: "A valid assigned user is required",
      });
    }

    const assignedUser = await findUserById(ownerId);
    if (!assignedUser) {
      return res.status(404).json({
        success: false,
        error: "Assigned user not found",
      });
    }

    const isSuperAdmin = req.user.role === "super_admin";
    const property = await propertyRepo.createProperty({
      title: req.body.title,
      description: req.body.description,
      price: Number(req.body.price),
      location: req.body.location,
      totalPackagePrice: req.body.totalPackagePrice
        ? Number(req.body.totalPackagePrice)
        : null,
      type: req.body.type || req.body.propertyType,
      listingType: req.body.listingType,
      bedrooms: Number(req.body.bedrooms),
      bathrooms: Number(req.body.bathrooms),
      area: Number(req.body.area),
      amenities: parseAmenities(req.body.amenities, []),
      images: await uploadPropertyImages(req.files),
      ownerId,
      contactUserId: req.user.id,
      createdBy: req.user.id,
      status: req.body.status || "available",
      approvalStatus: isSuperAdmin ? "approved" : "pending",
      approvedBy: isSuperAdmin ? req.user.id : null,
      approvedAt: isSuperAdmin ? new Date() : null,
      approvalNote: req.body.approvalNote,
      coordinates,
      availableFrom: req.body.availableFrom,
      minimumStay: req.body.minimumStay ? Number(req.body.minimumStay) : null,
    });

    if (isSuperAdmin) {
      sendPropertyListingEmail(req.user, property).catch((err) =>
        console.error("Email sending failed:", err.message),
      );
    }

    res.status(201).json({
      success: true,
      data: property,
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

    let resolvedStatus = "available";
    if (status) {
      if (Array.isArray(status)) resolvedStatus = status;
      else if (typeof status === "string" && status.includes(",")) {
        resolvedStatus = status.split(",");
      } else {
        resolvedStatus = status;
      }
    }

    let sort = { column: "created_at", ascending: false };
    switch (sortBy) {
      case "price_asc":
        sort = { column: "price", ascending: true };
        break;
      case "price_desc":
        sort = { column: "price", ascending: false };
        break;
      case "oldest":
        sort = { column: "created_at", ascending: true };
        break;
      case "most_viewed":
        sort = { column: "views", ascending: false };
        break;
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { data, total } = await propertyRepo.listProperties({
      filters: {
        publicApprovalOnly: true,
        status: resolvedStatus,
        location,
        type,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        amenities: amenities ? amenities.split(",") : undefined,
      },
      page: pageNum,
      limit: limitNum,
      sort,
    });

    res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      filters: {
        status: resolvedStatus,
        approvalStatus: "approved",
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getManagedProperties = async (req, res) => {
  try {
    const filters = {};
    if (req.user.role === "admin") filters.orManagedByUserId = req.user.id;
    if (req.query.approvalStatus)
      filters.approvalStatus = req.query.approvalStatus;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.ownerId) filters.ownerId = req.query.ownerId;
    if (req.query.contactUserId)
      filters.contactUserId = req.query.contactUserId;
    if (req.query.createdBy && req.user.role === "super_admin") {
      filters.createdBy = req.query.createdBy;
    }

    const pageNum = Number(req.query.page || 1);
    const limitNum = Number(req.query.limit || 20);
    const { data, total } = await propertyRepo.listProperties({
      filters,
      page: pageNum,
      limit: limitNum,
      sort: { column: "created_at", ascending: false },
    });

    res.json({
      success: true,
      data,
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
    const property = await propertyRepo.findPropertyById(req.params.id);

    if (!property) {
      return res
        .status(404)
        .json({ success: false, error: "Property not found" });
    }

    if (property.approvalStatus && property.approvalStatus !== "approved") {
      return res
        .status(404)
        .json({ success: false, error: "Property not found" });
    }

    const ownerId = String(property.ownerId?._id || property.ownerId);
    if (!req.user || req.user.id !== ownerId) {
      await propertyRepo.incrementPropertyViews(
        req.params.id,
        (property.views || 0) + 1,
      );
    }

    res.json({ success: true, data: property });
  } catch (error) {
    console.error("Error fetching property:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getManagedPropertyById = async (req, res) => {
  try {
    const property = await propertyRepo.findPropertyById(req.params.id);

    if (!property) {
      return res
        .status(404)
        .json({ success: false, error: "Property not found" });
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
    const property = await propertyRepo.findPropertyById(req.params.id);

    if (!property) {
      return res
        .status(404)
        .json({ success: false, error: "Property not found" });
    }

    hydrateLegacyPropertyMetadata(property, req.user.id);
    if (!isManagedByUser(property, req.user)) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to update this property",
      });
    }

    let nextOwnerId = String(property.ownerId?._id || property.ownerId);
    if (req.body.ownerId || req.body.assignedToUserId || req.body.userId) {
      nextOwnerId =
        req.body.ownerId || req.body.assignedToUserId || req.body.userId;
      const assignedUser = await findUserById(nextOwnerId);
      if (!assignedUser) {
        return res.status(404).json({
          success: false,
          error: "Assigned user not found",
        });
      }
    }

    let images = property.images || [];
    if (req.files?.length) {
      images = [...images, ...(await uploadPropertyImages(req.files))];
    }

    const updatedProperty = await propertyRepo.updateProperty(req.params.id, {
      title: req.body.title || property.title,
      description: req.body.description || property.description,
      price: req.body.price ? Number(req.body.price) : property.price,
      totalPackagePrice:
        req.body.totalPackagePrice !== undefined
          ? Number(req.body.totalPackagePrice)
          : property.totalPackagePrice,
      bedrooms: req.body.bedrooms
        ? Number(req.body.bedrooms)
        : property.bedrooms,
      bathrooms: req.body.bathrooms
        ? Number(req.body.bathrooms)
        : property.bathrooms,
      location: req.body.location || property.location,
      type: req.body.type || property.type,
      listingType: req.body.listingType || property.listingType,
      status: req.body.status || property.status,
      amenities: parseAmenities(req.body.amenities, property.amenities),
      images,
      ownerId: nextOwnerId,
      availableFrom: req.body.availableFrom || property.availableFrom,
      minimumStay: req.body.minimumStay
        ? Number(req.body.minimumStay)
        : property.minimumStay,
      coordinates: req.body.coordinates
        ? JSON.parse(req.body.coordinates)
        : property.coordinates,
      approvalStatus:
        req.user.role === "admin" ? "pending" : property.approvalStatus,
      approvedBy:
        req.user.role === "admin"
          ? null
          : property.approvedBy?._id || property.approvedBy,
      approvedAt: req.user.role === "admin" ? null : property.approvedAt,
    });

    res.json({
      success: true,
      message:
        req.user.role === "super_admin"
          ? "Property updated successfully"
          : "Property updated successfully and sent for re-approval",
      data: updatedProperty,
    });
  } catch (error) {
    console.error("Update Property Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deactivateProperty = async (req, res) => {
  try {
    const property = await propertyRepo.findPropertyById(req.params.id);

    if (!property) {
      return res
        .status(404)
        .json({ success: false, error: "Property not found" });
    }

    hydrateLegacyPropertyMetadata(property, req.user.id);
    if (!isManagedByUser(property, req.user)) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to deactivate this property",
      });
    }

    const updatedProperty = await propertyRepo.updateProperty(req.params.id, {
      status: "rented",
    });

    res.json({
      success: true,
      message: "Property has been marked as rented",
      data: updatedProperty,
    });
  } catch (error) {
    console.error("Deactivate Property Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.approveProperty = async (req, res) => {
  try {
    const property = await propertyRepo.findPropertyById(req.params.id);

    if (!property) {
      return res
        .status(404)
        .json({ success: false, error: "Property not found" });
    }

    const approvalStatus = req.body.approvalStatus || "approved";
    if (!["approved", "rejected"].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        error: "approvalStatus must be approved or rejected",
      });
    }

    const updatedProperty = await propertyRepo.updateProperty(req.params.id, {
      approvalStatus,
      approvedBy: req.user.id,
      approvedAt: new Date(),
      approvalNote: req.body.approvalNote || property.approvalNote,
    });

    res.json({
      success: true,
      message:
        approvalStatus === "approved"
          ? "Property approved successfully"
          : "Property rejected successfully",
      data: updatedProperty,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteProperty = async (req, res) => {
  try {
    const property = await propertyRepo.findPropertyById(req.params.id);

    if (!property) {
      return res
        .status(404)
        .json({ success: false, error: "Property not found" });
    }

    if (property.images?.length) {
      const deletePromises = property.images.map((imageUrl) => {
        const publicId = imageUrl.split("/").slice(-2).join("/").split(".")[0];
        return cloudinary.uploader.destroy(publicId);
      });

      await Promise.all(deletePromises);
    }

    await propertyRepo.deleteProperty(req.params.id);
    res.json({ success: true, message: "Property deleted successfully" });
  } catch (error) {
    console.error("Delete Property Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
