const User = require("../models/User");
const Agent = require("../models/Agent");
const jwt = require("jsonwebtoken");
const crypto = require("crypto")

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};
const { sendWelcomeEmail, sendVerificationEmail,sendResetPasswordEmail,sendResetPasswordSuccessEmail} = require("../services/emailService");

const backEndUrl = process.env.BACKEND_URL; 
const frontEndUrl = process.env.FRONTEND_URL; 



// In the register function, after creating the user:

exports.register = async (req, res) => {

  
  try {
    const { name, email, phone, password, role, ...agentData } = req.body;

       if(!name || !email || !password || !phone){
      return res.status(400).json({
        success : false,
        error : "Fill in the required information"
      })
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
      verification : {
        token:verificationToken,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
      }

    });

    await user.save();

    // const verificationUrl=`${backEndUrl}/api/auth/verify-email/${user._id}/${verificationToken}`

    const verificationUrl=`${frontEndUrl}/verify-email/${user._id}/${verificationToken}`


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

      await sendVerificationEmail({
        verificationLink:verificationUrl,
        name: user.name,
        email: user.email,
      });

      console.log(verificationUrl)

    res.status(201).json({
      success:true,
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

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
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

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    let agentData = null;

    // ✅ Only fetch agent data if user role is 'agent'
    if (user.role === "agent") {
      agentData = await Agent.findOne({ userId: user._id }).lean();
    }

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
        ...(agentData && { agentData }), // include only if exists
        token,
        expiresIn: 7 * 24 * 60 * 60, // 7 days
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
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

    if(!userId || !token || !password || !confirmPassword){
      return res.status(400).json({
        success : false,
        error : "Fill in the required information"
      })
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
    })

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

