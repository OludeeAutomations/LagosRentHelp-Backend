const express = require("express");
const {
  register,
  login,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  refresh,
  validateToken,
} = require("../controllers/authController");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.get("/verify-email/:userId/:token", verifyEmail);
router.post("/refresh", refresh);
router.get("/validate", auth, validateToken);

module.exports = router;
