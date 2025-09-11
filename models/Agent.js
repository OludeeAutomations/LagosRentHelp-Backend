const mongoose = require("mongoose");

const agentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    bio: String,
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    governmentId: String,
    address: {
      type: String,
      required: true,
    },
    idPhoto: String,
    address: {
      type: String,
      required: true,
    },

    whatsappNumber: {
      type: String,
      required: true,
    },
    listings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
      },
    ],
    freeListingsUsed: {
      type: Number,
      default: 0,
    },
    referralCode: {
      type: String,
      unique: true,
    },
    referredBy: String,
    referralCount: {
      type: Number,
      default: 0,
    },
    freeListingsFromReferrals: {
      type: Number,
      default: 0,
    },
    totalLeads: {
      type: Number,
      default: 0,
    },
    totalReferralClicks: {
      type: Number,
      default: 0,
    },
    subscriptionPlan: {
      type: String,
      enum: ["basic", "premium"],
      default: "basic",
    },
    subscriptionExpiry: Date,
    status: {
      type: String,
      enum: ["trial", "active", "trial_expired"],
      default: "trial",
    },
    trialExpiresAt: Date,
    verificationCode: String,
    verificationCodeTimestamp: Date,
    rating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    responseRate: {
      type: Number,
      default: 0,
    },
    responseTime: Number,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Agent", agentSchema);
