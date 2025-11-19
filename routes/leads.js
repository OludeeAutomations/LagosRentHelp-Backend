const express = require("express");
const {
  createLead,
  checkLead,
  getLeads,
  getAgentLeads,
} = require("../controllers/leadController");
const auth = require("../middleware/auth");

const router = express.Router();

// POST /api/leads - Create a new lead
router.post("/", auth, createLead);

// GET /api/leads/check/:agentId - Check if user has contacted an agent
router.get("/check/:agentId", auth, checkLead);

// GET /api/leads - Get leads with optional filters (supports query params)
router.get("/", auth, getLeads);

// GET /api/leads/agent/:agentId - Get leads for a specific agent
router.get("/agent/:agentId", auth, getAgentLeads);

module.exports = router;
