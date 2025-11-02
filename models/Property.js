const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    location: { type: String, required: true },
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
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    likes: {
      type: Number,
      default: 0,
    },
    coordinates: {
      lat: Number,
      lng: Number,
    },
    availableFrom: Date,
    minimumStay: Number,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Property", propertySchema);
