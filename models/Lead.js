// models/Lead.js
const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agent",
    required: true,
  },
  userId: {
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
    enum: ["whatsapp", "phone", "message"],
    required: true,
  },
  message: {
    type: String,
    default: "",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Add compound index to prevent duplicates
leadSchema.index({ agentId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Lead", leadSchema);
