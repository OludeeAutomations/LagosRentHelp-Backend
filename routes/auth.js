const express = require("express");
const { register, login,verifyEmail,requestPasswordReset, resetPassword } = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password",requestPasswordReset);
router.post("/reset-password",resetPassword);
router.get("/verify-email/:userId/:token",verifyEmail);

module.exports = router;
