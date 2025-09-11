const User = require("../models/User");
const Agent = require("../models/Agent");
const jwt = require("jsonwebtoken");

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};
const { sendWelcomeEmail } = require("../services/emailService");

// In the register function, after creating the user:

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, role, ...agentData } = req.body;

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

    // Create user
    const user = new User({
      name,
      email,
      phone,
      password,
      role: role || "user",
    });

    await user.save();
    await sendWelcomeEmail({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });
    // If user is agent, create agent profile
    if (role === "agent") {
      const agent = new Agent({
        userId: user._id,
        address: agentData.address,
        whatsappNumber: agentData.whatsappNumber,
        referralCode: Math.random().toString(36).substr(2, 9).toUpperCase(),
        trialExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
      });
      await agent.save();
    }

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        token,
        expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      },
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

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        token,
        expiresIn: 7 * 24 * 60 * 60,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
