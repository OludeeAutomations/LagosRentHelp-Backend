// models/Agent.js
const mongoose = require("mongoose");

const agentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    idPhoto: {
      type: String, // Cloudinary URL
      required: true,
    },
    // Address & Location Details
    residentialAddress: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    institutionName: {
      type: String,
      default: null,
    },
    campusCode: {
      type: String,
      default: null,
    },
    proofOfAddress: {
      type: String, // Cloudinary URL
      default: null,
      required: true,
    },

    // Professional Information
    bio: {
      type: String,
      required: true,
    },
    experience: {
      type: String,
      default: null,
    },
    motivation: {
      type: String,
      required: true,
    },
    hearAboutUs: {
      type: String,
      required: true,
    },
    preferredCommunication: {
      type: String,
      enum: ["whatsapp", "email", "phone"],
      required: true,
    },
    socialMedia: {
      type: String,
      default: null,
    },

    // Verification & Identity
    verificationStatus: {
      type: String,
      enum: ["not verified", "pending", "verified", "rejected"],
      default: "not verified",
    },
    verificationIssue: {
      type: String,
      default: null,
    },

    // Contact Information
    whatsappNumber: {
      type: String,
      required: true,
    },

    // Property Management
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

    // Referral system
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: String,
      default: null,
    },
    freeListingWeeks: {
      type: Number,
      default: 0,
    },
    totalReferrals: {
      type: Number,
      default: 0,
    },
    referralEarnings: {
      type: Number,
      default: 0,
    },

    // Subscription / plan info
    subscription: {
      type: {
        status: {
          type: String,
          enum: [
            "pending_verification",
            "trial",
            "active",
            "expired",
            "cancelled",
          ],
          default: "pending_verification",
        },
        trialStartsAt: Date,
        trialEndsAt: Date,
        currentPeriodEnd: Date,
        plan: {
          type: String,
          enum: ["trial", "basic", "premium"],
          default: "trial",
        },
        stripeCustomerId: String,
        stripeSubscriptionId: String,
      },
      default: {},
    },

    subscriptionPlan: {
      type: String,
      enum: ["basic", "premium"],
      default: "basic",
    },
    subscriptionExpiry: Date,

    // Performance Metrics
    totalLeads: {
      type: Number,
      default: 0,
    },
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
    responseTime: {
      type: Number,
      default: 0,
    },

    // Verification Data (for Dojah/third-party verification)
    verificationData: {
      dojahResponse: mongoose.Schema.Types.Mixed,
      submittedAt: Date,
      verifiedAt: Date,
      status: String,
      confidenceValue: Number,
      match: Boolean,
    },

    // Reviews
    reviews: [
      {
        reviewerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        rating: {
          type: Number,
          required: true,
          min: 1,
          max: 5,
        },
        comment: {
          type: String,
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Additional Fields for Analytics

    // Settings & Preferences
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      leadAlerts: { type: Boolean, default: true },
      messageAlerts: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

// === Indexes for Performance ===

// === Virtual Fields ===
agentSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
});

agentSchema.virtual("isTrialActive").get(function () {
  if (this.subscription.status !== "trial" || !this.subscription.trialEndsAt) {
    return false;
  }
  return new Date() <= new Date(this.subscription.trialEndsAt);
});

agentSchema.virtual("trialDaysLeft").get(function () {
  if (!this.isTrialActive) return 0;
  const today = new Date();
  const trialEnd = new Date(this.subscription.trialEndsAt);
  const diffTime = trialEnd - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// === Hooks & methods ===

// Generate referral code before saving
agentSchema.pre("save", function (next) {
  // Generate referral code if not exists
  if (!this.referralCode) {
    this.referralCode = this.generateReferralCode();
  }

  // Update lastActive timestamp
  if (this.isModified()) {
    this.lastActive = new Date();
  }

  // Start trial when agent gets verified
  if (
    this.isModified("verificationStatus") &&
    this.verificationStatus === "verified" &&
    this.subscription.status === "pending_verification"
  ) {
    const now = new Date();
    const trialEnds = new Date(now);
    trialEnds.setMonth(trialEnds.getMonth() + 6); // 6 months trial

    this.subscription = {
      status: "trial",
      trialStartsAt: now,
      trialEndsAt: trialEnds,
      plan: "trial",
      stripeCustomerId: this.subscription.stripeCustomerId,
      stripeSubscriptionId: this.subscription.stripeSubscriptionId,
    };

    console.log(
      `Started free trial for agent ${
        this._id
      } until ${trialEnds.toLocaleDateString()}`
    );
  }
  next();
});

// Compute average rating & total reviews before saving
agentSchema.pre("save", function (next) {
  if (this.isModified("reviews")) {
    const totalReviews = this.reviews.length;

    if (totalReviews > 0) {
      const avgRating =
        this.reviews.reduce((sum, review) => sum + review.rating, 0) /
        totalReviews;

      this.totalReviews = totalReviews;
      this.rating = Math.round(avgRating * 10) / 10; // round to 1 decimal
    } else {
      // If no reviews, reset stats
      this.totalReviews = 0;
      this.rating = 0;
    }
  }

  next();
});

// Method to generate unique referral code
agentSchema.methods.generateReferralCode = function () {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `REF${result}`;
};

// Method to check if agent can list properties
agentSchema.methods.canListProperties = function () {
  const now = new Date();

  // If not verified, can't list
  if (this.verificationStatus !== "verified") {
    return false;
  }

  // If they have free weeks from referrals
  if (this.freeListingWeeks > 0) {
    return true;
  }

  // If trial period is active
  if (
    this.subscription.status === "trial" &&
    this.subscription.trialStartsAt &&
    this.subscription.trialEndsAt &&
    now >= this.subscription.trialStartsAt &&
    now <= this.subscription.trialEndsAt
  ) {
    return true;
  }

  // If paid subscription is active
  if (
    this.subscription.status === "active" &&
    this.subscription.currentPeriodEnd &&
    now <= this.subscription.currentPeriodEnd
  ) {
    return true;
  }

  return false;
};

// Method to get agent's location information
agentSchema.methods.getLocationInfo = function () {
  return {
    state: this.state,
    city: this.city,
    institution: this.institutionName,
    campusCode: this.campusCode,
    fullAddress: this.residentialAddress,
  };
};

// Method to update response metrics
agentSchema.methods.updateResponseMetrics = function (responseTime) {
  this.responseTime = responseTime;

  // Calculate response rate (simplified - you might want more complex logic)
  if (this.totalLeads > 0) {
    this.responseRate = Math.min(
      100,
      (this.totalLeads / (this.totalLeads + 1)) * 100
    );
  }

  return this.save();
};

// Method to add a review
agentSchema.methods.addReview = function (reviewerId, rating, comment) {
  this.reviews.push({
    reviewerId,
    rating,
    comment,
    createdAt: new Date(),
  });

  return this.save();
};

// Static method to find agents by location
agentSchema.statics.findByLocation = function (state, city) {
  return this.find({
    state: new RegExp(state, "i"),
    city: new RegExp(city, "i"),
    verificationStatus: "verified",
    isActive: true,
  }).sort({ rating: -1, totalReviews: -1 });
};

// Static method to get top performing agents
agentSchema.statics.getTopAgents = function (limit = 10) {
  return this.find({
    verificationStatus: "verified",
    isActive: true,
    totalReviews: { $gte: 5 }, // Only agents with at least 5 reviews
  })
    .sort({ rating: -1, totalReviews: -1 })
    .limit(limit);
};

module.exports = mongoose.model("Agent", agentSchema);
