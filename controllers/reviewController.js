const Review = require("../models/Review");
const Property = require("../models/Property");

exports.createReview = async (req, res) => {
  try {
    const { propertyId, rating, comment } = req.body;

    if (!propertyId || !rating || !comment) {
      return res.status(400).json({ success: false, error: "propertyId, rating and comment are required" });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    const review = new Review({
      propertyId,
      userId: req.user.id,
      rating,
      comment,
    });

    await review.save();

    const propertyReviews = await Review.find({ propertyId });
    const averageRating = propertyReviews.reduce((sum, r) => sum + r.rating, 0) / propertyReviews.length;

    await Property.findByIdAndUpdate(propertyId, { rating: averageRating, reviewCount: propertyReviews.length });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getPropertyReviews = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const reviews = await Review.find({ propertyId }).populate("userId", "name avatar").sort({ createdAt: -1 });

    res.json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
