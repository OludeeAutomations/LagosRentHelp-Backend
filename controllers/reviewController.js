const Review = require("../models/Review");
const Property = require("../models/Property");
const Agent = require("../models/Agent");


exports.createReview = async (req, res) => {
  try {
    const { propertyId, rating, comment } = req.body;

    const review = new Review({
      propertyId,
      userId: req.user.id,
      agentId: req.body.agentId,
      rating,
      comment,
    });

    await review.save();

    // Update property rating
    const propertyReviews = await Review.find({ propertyId });
    const averageRating =
      propertyReviews.reduce((sum, review) => sum + review.rating, 0) /
      propertyReviews.length;

    await Property.findByIdAndUpdate(propertyId, {
      rating: averageRating,
      reviewCount: propertyReviews.length,
    });

    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getPropertyReviews = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const reviews = await Review.find({ propertyId })
      .populate("userId", "name avatar")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


// POST - Add a new review for an agent
exports.createAgentReview = async (req, res) => {
  try {
    const { rating, comment,agentId } = req.body;
    const reviewerId = req.user.id; // from auth middleware

    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: "Rating and comment are required.",
      });
    }

    const agent = await Agent.findOne({ userId: agentId });
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found.",
      });
    }

    // Check if user already reviewed this agent
    const alreadyReviewed = agent.reviews.find(
      (r) => r.reviewerId.toString() === reviewerId.toString()
    );

    if (alreadyReviewed) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this agent.",
      });
    }

    // Add new review
    const review = {
      reviewerId,
      rating,
      comment,
    };

    agent.reviews.push(review);

    // Update total and average rating
    agent.totalReviews = agent.reviews.length;
    agent.rating =
      agent.reviews.reduce((sum, r) => sum + r.rating, 0) /
      agent.reviews.length;

    await agent.save();

    res.status(201).json({
      success: true,
      message: "Review added successfully.",
      data: review,
    });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET - Fetch all reviews for an agent
exports.getAgentReviews = async (req, res) => {
  try {
    const {agentId} = req.query;

    const agent = await Agent.findOne({userId:agentId})
      .populate("reviews.reviewerId", "name profilePhoto email")
      .select("reviews rating totalReviews");

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        reviews: agent.reviews,
        averageRating: agent.rating,
        totalReviews: agent.totalReviews,
      },
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

