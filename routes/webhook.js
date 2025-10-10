const express = require("express");
const {
handleDojahWebhook
} = require("../controllers/webhookController");


const router = express.Router();

router.post("/dojah", handleDojahWebhook);

module.exports = router;
