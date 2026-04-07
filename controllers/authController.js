const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const {
  createUser,
  findByEmail,
  findByEmailOrPhone,
  findById,
  updateUser,
} = require("../repositories/users");
const {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendResetPasswordSuccessEmail,
} = require("../services/emailService");

const client = new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID);

const createAccessToken = (user) =>
  jwt.sign(
    { userId: user._id, tokenVersion: user.tokenVersion },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" },
  );

const createRefreshToken = (user) =>
  jwt.sign(
    { userId: user._id, tokenVersion: user.tokenVersion },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" },
  );

const frontEndUrl = process.env.FRONTEND_URL;

const sanitizeUser = (user) => {
  const safeUser = { ...user };
  delete safeUser.password;
  delete safeUser.verification;
  return safeUser;
};

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        error: "Fill in the required information",
      });
    }

    const existingUser = await findByEmailOrPhone({ email, phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User with this email or phone already exists",
      });
    }

    const verificationToken = crypto.randomBytes(16).toString("hex");
    const user = await createUser({
      name,
      email,
      phone,
      password: await bcrypt.hash(password, 12),
      role: "user",
      verification: {
        token: verificationToken,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const verificationUrl = `${frontEndUrl}/verify-email/${user._id}/${verificationToken}`;
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    await sendVerificationEmail({
      verificationLink: verificationUrl,
      name: user.name,
      email: user.email,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/api/auth/refresh",
    });

    res.status(201).json({
      success: true,
      user: sanitizeUser(user),
      accessToken,
      expiresIn: 7 * 24 * 60 * 60,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    const user = await findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    if (user.emailVerified === false) {
      return res.status(403).json({
        success: false,
        error: "Email not verified",
      });
    }

    const updatedUser = await updateUser(user._id, { lastLogin: new Date() });
    const accessToken = createAccessToken(updatedUser);
    const refreshToken = createRefreshToken(updatedUser);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      path: "/api/auth/refresh",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      accessToken,
      expiresIn: 7 * 24 * 60 * 60,
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
};

exports.loginWithGoogle = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: "Google ID token is required",
      });
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture: avatar, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Invalid Google token",
      });
    }

    let user = await findByEmail(email);

    if (!user) {
      user = await createUser({
        name,
        email,
        googleId,
        avatar,
        role: "user",
        emailVerified: true,
      });
    }

    user = await updateUser(user._id, { lastLogin: new Date() });

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      path: "/api/auth/refresh",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      accessToken,
      expiresIn: 7 * 24 * 60 * 60,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Google login error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { userId, token } = req.params;
    const user = await findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(409).json({
        success: false,
        error: "Email is already verified.",
      });
    }

    if (
      !user.verification ||
      user.verification.token !== token ||
      new Date(user.verification.expiresAt).getTime() < Date.now()
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired verification token.",
      });
    }

    await updateUser(user._id, {
      emailVerified: true,
      verification: null,
    });

    await sendWelcomeEmail({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.resendVerificationEmail = async (req, res) => {
  try {
    const { userId, email } = req.body;

    let user;
    if (userId) user = await findById(userId);
    else if (email) user = await findByEmail(email);
    else {
      return res.status(400).json({
        success: false,
        error: "User ID or Email is required",
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        error: "This account is already verified. Please login.",
      });
    }

    const verificationToken = crypto.randomBytes(16).toString("hex");
    const verification = {
      token: verificationToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    };

    await updateUser(user._id, { verification });

    const verificationUrl = `${frontEndUrl}/verify-email/${user._id}/${verificationToken}`;
    await sendVerificationEmail({
      verificationLink: verificationUrl,
      name: user.name,
      email: user.email,
    });

    return res.status(200).json({
      success: true,
      message: "Verification link sent successfully. Please check your email.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to resend verification email",
    });
  }
};

exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await findByEmail(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "No account found with this email",
      });
    }

    const resetToken = crypto.randomBytes(16).toString("hex");
    const verification = {
      ...(user.verification || {}),
      token: resetToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    await updateUser(user._id, { verification });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${user._id}/${resetToken}`;

    await sendResetPasswordEmail({
      email: user.email,
      name: user.name,
      resetLink: resetUrl,
    });

    res.status(200).json({
      success: true,
      message: "Password reset email sent",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { userId, token, password, confirmPassword } = req.body;

    if (!userId || !token || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "Fill in the required information",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "Passwords do not match",
      });
    }

    const user = await findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (
      !user.verification?.token ||
      user.verification.token !== token ||
      new Date(user.verification.expiresAt).getTime() < Date.now()
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or expired token" });
    }

    const verification = { ...(user.verification || {}) };
    delete verification.token;
    delete verification.expiresAt;

    await updateUser(user._id, {
      password: await bcrypt.hash(password, 12),
      verification,
    });

    sendResetPasswordSuccessEmail({
      email: user.email,
      name: user.name,
    });

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "All fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "New passwords do not match",
      });
    }

    const user = await findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password || "");
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Old password is incorrect",
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password || "");
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        error: "New password cannot be the same as old password",
      });
    }

    await updateUser(user._id, {
      password: await bcrypt.hash(newPassword, 12),
      tokenVersion: (user.tokenVersion || 0) + 1,
    });

    await sendResetPasswordSuccessEmail(user);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      success: false,
      error: "Something went wrong",
    });
  }
};

exports.refresh = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await findById(decoded.userId);

    if (!user) return res.status(403).json({ message: "User not found" });
    if (user.tokenVersion !== decoded.tokenVersion) {
      return res.status(403).json({ message: "Token invalidated" });
    }

    const accessToken = createAccessToken(user);
    res.json({ accessToken });
  } catch (err) {
    res.status(403).json({ message: "Invalid token" });
  }
};

exports.logout = (req, res) => {
  res.clearCookie("refreshToken", { path: "/api/auth/refresh" });
  res.json({ message: "Logged out" });
};

exports.validateToken = async (req, res) => {
  try {
    const currentUser = await findById(req.user._id);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      user: sanitizeUser(currentUser),
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }
};
