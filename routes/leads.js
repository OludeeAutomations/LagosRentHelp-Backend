const express = require("express");
const { createLead } = require("../controllers/leadController");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/", auth, createLead);

module.exports = router;
