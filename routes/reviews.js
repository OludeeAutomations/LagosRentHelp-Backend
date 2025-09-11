const express = require("express");
const {
  createReview,
  getPropertyReviews,
} = require("../controllers/reviewController");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/", auth, createReview);
router.get("/property/:propertyId", getPropertyReviews);

module.exports = router;
