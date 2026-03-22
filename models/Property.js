const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    location: { type: String, required: true },
    totalPackagePrice: { type: Number, min: 0 },
    type: {
      type: String,
      required: true,
      enum: [
        "1-bedroom",
        "2-bedroom",
        "3-bedroom",
        "duplex",
        "studio",
        "mini-flat",
        "short-let",
      ],
    },
    listingType: {
      type: String,
      required: true,
      enum: ["rent", "short-let"],
    },
    bedrooms: { type: Number, required: true, min: 0 },
    bathrooms: { type: Number, required: true, min: 0 },
    area: { type: Number, required: true, min: 0 },
    amenities: [{ type: String }],
    images: [{ type: String }],
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    contactUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default() {
        return this.ownerId;
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default() {
        return this.ownerId;
      },
    },
    status: {
      type: String,
      enum: ["available", "rented", "pending"], // Make sure it's exactly this
      default: "available",
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,
    approvalNote: String,

    views: { type: Number, default: 0 },
    likes: {
      type: Number,
      default: 0,
    },
    coordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    availableFrom: Date,
    minimumStay: Number,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Property", propertySchema);
