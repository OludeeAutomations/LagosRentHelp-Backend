const express = require("express");
const {
  createReview,
  getPropertyReviews,
  createAgentReview,
  getAgentReviews
} = require("../controllers/reviewController");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/", auth, createReview);
router.get("/property/:propertyId", getPropertyReviews);

router.post("/agent",auth,createAgentReview)
router.get("/agent",getAgentReviews)
module.exports = router;
