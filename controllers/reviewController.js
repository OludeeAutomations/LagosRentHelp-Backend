const Review = require("../models/Review");
const Property = require("../models/Property");

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
