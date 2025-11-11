const User = require("../models/User");
const Agent = require("../models/Agent");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendResetPasswordSuccessEmail,
} = require("../services/emailService");

const createAccessToken = (user) => {
  return jwt.sign(
    { userId: user._id, tokenVersion: user.tokenVersion },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );
};

const createRefreshToken = (user) => {
  return jwt.sign(
    { userId: user._id, tokenVersion: user.tokenVersion },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
};

const backEndUrl = process.env.BACKEND_URL;
const frontEndUrl = process.env.FRONTEND_URL;
/*exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, role, ...agentData } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        error: "Fill in the required information",
      });
    }

    // Check for existing user
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "User with this email or phone already exists",
      });
    }

    const verificationToken = crypto.randomBytes(16).toString("hex");

    const user = new User({
      name,
      email,
      phone,
      password,
      role: role || "user",
      verification: {
        token: verificationToken,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      ...agentData,
    });

    // Generate tokens before saving
    const verificationUrl = `${frontEndUrl}/verify-email/${user._id}/${verificationToken}`;
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    // Send verification email FIRST
    await sendVerificationEmail({
      verificationLink: verificationUrl,
      name: user.name,
      email: user.email,
    });

    // Only save user if email sent successfully
    await user.save();

    console.log(verificationUrl);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/api/auth/refresh",
    });

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.verification;

    res.status(201).json({
      success: true,
      accessToken,
      user: userResponse,
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (user && user._id) {
      try {
        await User.findByIdAndDelete(user._id);
        console.log(`Rolled back user creation for: ${user.email}`);
      } catch (deleteError) {
        console.error("Failed to rollback user creation:", deleteError);
      }
    }
    res.status(500).json({
      success: false,
      error: "Server error, please try again later",
    });
  }
};*/

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, role, ...agentData } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        error: "Fill in the required information",
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User with this email or phone already exists",
      });
    }

    const verificationToken = await crypto.randomBytes(16).toString("hex");

    // Create user
    const user = new User({
      name,
      email,
      phone,
      password,
      role: role || "user",
      verification: {
        token: verificationToken,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      },
    });

    // const verificationUrl=`${backEndUrl}/api/auth/verify-email/${user._id}/${verificationToken}`

    const verificationUrl = `${frontEndUrl}/verify-email/${user._id}/${verificationToken}`;
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    await sendVerificationEmail({
      verificationLink: verificationUrl,
      name: user.name,
      email: user.email,
    });
    await user.save();
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/api/auth/refresh",
    });
    console.log(verificationUrl);
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.verification;

    res.status(201).json({
      success: true,

      user: userResponse,

      accessToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
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

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    // Find user by email and include password field
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // Compare passwords manually

    // Check if user email is verified
    if (user.emailVerified === false) {
      return res.status(403).json({
        success: false,
        error: "Email not verified",
      });
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save();

    // Fetch agent info if the user is an agent
    let agentData = null;
    if (user.role === "agent") {
      agentData = await Agent.findOne({ userId: user._id });
    }

    // Generate access and refresh tokens
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    // Store refresh token in a secure HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // ⚠️ set to false if testing locally (localhost)
      sameSite: "strict",
      path: "/api/auth/refresh",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Prepare safe user response
    const safeUser = user.toObject();
    delete safeUser.password;
    delete safeUser.verification;

    // Send final success response
    return res.status(200).json({
      success: true,
      accessToken,
      expiresIn: 7 * 24 * 60 * 60,
      user: safeUser,
      ...(agentData && { agentData }),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { userId, token } = req.params; // use params, not body

    //  Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.status(409).json({
        success: false,
        error: "Email is already verified.",
      });
    }

    //Validate token
    if (
      !user.verification ||
      user.verification.token != token ||
      user.verification.expiresAt < Date.now()
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired verification token.",
      });
    }

    //  Mark verified
    user.emailVerified = true;
    user.verification = undefined; // clear token
    await user.save();

    //  Send welcome email
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

exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "No account found with this email",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(16).toString("hex");

    user.verification.token = resetToken;
    user.verification.expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await user.save();

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

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { userId, token, password, confirmPassword } = req.body;

    if (!userId || !token || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "Fill in the required information",
      });
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "Password and confirm password are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "Passwords do not match",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Check if token matches & not expired
    if (
      !user.verification?.token ||
      user.verification.token !== token ||
      user.verification.expiresAt < Date.now()
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or expired token" });
    }

    // Hash and update password
    user.password = password;

    // Clear verification token
    user.verification.token = undefined;
    user.verification.expiresAt = undefined;

    await user.save();

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

exports.refresh = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.userId);

    // ✅ check if user exists
    if (!user) return res.status(403).json({ message: "User not found" });

    // ✅ check if token version is still valid
    if (user.tokenVersion !== decoded.tokenVersion)
      return res.status(403).json({ message: "Token invalidated" });

    const accessToken = createAccessToken(user);
    res.json({ accessToken });
  } catch (err) {
    res.status(403).json({ message: "Invalid token" });
  }
};

// Logout
exports.logout = (req, res) => {
  res.clearCookie("refreshToken", { path: "/api/auth/refresh" });
  res.json({ message: "Logged out" });
};

exports.validateToken = async (req, res) => {
  try {
    console.log("🔍 Validating token for user:", req.user?._id);

    // Check if user exists in database
    const currentUser = await User.findById(req.user._id);

    if (!currentUser) {
      console.log("❌ User not found in database");
      return res.status(401).json({
        success: false,
        error: "User not found",
      });
    }

    console.log("✅ User found:", currentUser.email);

    // Return fresh user data
    const safeUser = currentUser.toObject();
    delete safeUser.password;

    res.json({
      success: true,
      user: safeUser,
    });
  } catch (error) {
    console.log("❌ Validation error:", error.message);
    res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }
};
