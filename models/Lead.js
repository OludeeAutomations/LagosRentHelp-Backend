const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
    },
    type: {
      type: String,
      enum: [
        "listing_view",
        "contact_click",
        "referral_click",
        "whatsapp_contact",
      ],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    source: String,
    message: String,
    status: {
      type: String,
      enum: ["new", "contacted", "viewing", "closed"],
      default: "new",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Lead", leadSchema);
