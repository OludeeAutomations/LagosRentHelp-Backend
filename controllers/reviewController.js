const { findPropertyById, updateProperty } = require("../repositories/properties");
const { createReview, listReviewsByProperty } = require("../repositories/reviews");

exports.createReview = async (req, res) => {
  try {
    const { propertyId, rating, comment } = req.body;

    if (!propertyId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        error: "propertyId, rating and comment are required",
      });
    }

    const property = await findPropertyById(propertyId);
    if (!property) {
      return res.status(404).json({ success: false, error: "Property not found" });
    }

    const review = await createReview({
      propertyId,
      userId: req.user.id,
      rating,
      comment,
    });

    const propertyReviews = await listReviewsByProperty(propertyId);
    const averageRating =
      propertyReviews.reduce((sum, item) => sum + item.rating, 0) /
      propertyReviews.length;

    await updateProperty(propertyId, {
      rating: averageRating,
      reviewCount: propertyReviews.length,
    });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getPropertyReviews = async (req, res) => {
  try {
    const reviews = await listReviewsByProperty(req.params.propertyId);
    res.json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
