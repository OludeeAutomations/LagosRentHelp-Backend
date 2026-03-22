const express = require("express");
const {
  createLead,
  checkLead,
  getLeads,
} = require("../controllers/leadController");
const auth = require("../middleware/auth");

const router = express.Router();

// POST /api/leads - Create a new lead
router.post("/", auth, createLead);

// GET /api/leads/check/:propertyId - Check if user has contacted a property
router.get("/check/:propertyId", auth, checkLead);

// GET /api/leads - Get leads with optional filters (supports query params)
router.get("/", auth, getLeads);

module.exports = router;
