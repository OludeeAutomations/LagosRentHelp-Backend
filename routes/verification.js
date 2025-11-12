// routes/verificationRoutes.js
const express = require("express");
const router = express.Router();
const verificationController = require("../controllers/verificationController");
const authMiddleware = require("../middleware/auth");
const {
  validateVerification,
} = require("../middleware/verificationValidation");
const multer = require("multer");

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Submit verification
router.post(
  "/submit",
  authMiddleware,
  upload.single("selfie"),
  validateVerification,
  verificationController.submitVerification
);

// Check verification status
router.get(
  "/status",
  authMiddleware,
  verificationController.checkVerificationStatus
);
router.post("/webhook/dojah", verificationController.dojahWebhook);

module.exports = router;
