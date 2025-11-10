const mongoose = require("mongoose");

const VerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
    },
    idType: {
      type: String,
      enum: ["nin", "driver_license", "voter_id", "passport", "bvn"],
      required: true,
    },
    idNumber: {
      type: String,
      required: true,
    },
    photo: {
      type: String, // URL to Cloudinary
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    verificationIssue: {
      type: String,
      default: null,
    },
    dojahResponse: {
      type: mongoose.Schema.Types.Mixed, // Store full Dojah response for debugging
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
VerificationSchema.index({ userId: 1, createdAt: -1 });
VerificationSchema.index({ agentId: 1, status: 1 });
VerificationSchema.index({ status: 1 });

module.exports = mongoose.model("Verification", VerificationSchema);
