const express = require("express");
const {
  getAgentProfile,
  updateAgentProfile,
  submitAgentApplication,
  validateReferralCode,
} = require("../controllers/agentController");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const {
  applyReferral,
  getReferralStats,
} = require("../controllers/referralController");
const {
  getSubscriptionStatus,
  createSubscription,
} = require("../controllers/subscriptionController");

const router = express.Router();

router.get("/:id", getAgentProfile);
router.put("/profile", auth, updateAgentProfile);
router.post(
  "/apply",
  auth,
  upload.fields([
    { name: "governmentId", maxCount: 1 },
    { name: "idPhoto", maxCount: 1 },
  ]),
  submitAgentApplication
);

// Referral routes
router.post("/referral/apply", auth, applyReferral);
router.get("/referral/stats", auth, getReferralStats);

// Subscription routes
router.get("/subscription/status", auth, getSubscriptionStatus);
router.post("/subscription/create", auth, createSubscription);
// Add to your agent routes
router.get("/referral/validate", validateReferralCode);
module.exports = router;
