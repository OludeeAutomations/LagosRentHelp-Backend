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
          ], // Added pending_verification
          default: "pending_verification", // Changed default
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

    // Metrics
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
    responseTime: Number,
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
   
  },
  {
    timestamps: true,
  }
);

// === Hooks & methods ===

// Generate referral code before saving
agentSchema.pre("save", function (next) {
  // Generate referral code if not exists
  if (!this.referralCode) {
    this.referralCode = this.generateReferralCode();
  }

  // Start trial when agent gets verified
  if (
    this.isModified("verificationStatus") &&
    this.verificationStatus === "verified" &&
    this.subscription.status === "pending_verification"
  ) {
    // const now = new Date();
    // const trialEnds = new Date(now);
    // trialEnds.setDate(trialEnds.getDate() + 14); // 2 weeks from now


    const now = new Date();
    const trialEnds = new Date(now);
    trialEnds.setMonth(trialEnds.getMonth() + 6);


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

module.exports = mongoose.model("Agent", agentSchema);
