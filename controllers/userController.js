const User = require("../models/User");
const Property = require("../models/Property");

const sanitizeUser = (user) => {
  const safeUser = user.toObject ? user.toObject() : { ...user };
  delete safeUser.password;
  delete safeUser.verification;
  return safeUser;
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, avatar },
      { new: true, runValidators: true },
    ).select("-password");

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.listManageableUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    const filter = {};

    if (role) {
      filter.role = role;
    }

    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") },
      ];
    }

    const users = await User.find(filter)
      .select("name email phone avatar role emailVerified phoneVerified")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.listAdminAccounts = async (req, res) => {
  try {
    const { search, role } = req.query;
    const filter = {
      role:
        role && ["admin", "super_admin"].includes(role)
          ? role
          : { $in: ["admin", "super_admin"] },
    };

    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") },
      ];
    }

    const admins = await User.find(filter)
      .select(
        "name email phone avatar role emailVerified phoneVerified restricted lastLogin createdAt",
      )
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: admins,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.createAdminAccount = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: "name, email, phone and password are required",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User with this email or phone already exists",
      });
    }

    const admin = await User.create({
      name,
      email,
      phone,
      password,
      role: "admin",
      emailVerified: true,
    });

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      data: sanitizeUser(admin),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.deleteAdminAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    const admin = await User.findById(userId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Admin account not found",
      });
    }

    if (admin.role !== "admin") {
      return res.status(400).json({
        success: false,
        error: "Only admin accounts can be deleted from this endpoint",
      });
    }

    const linkedProperties = await Property.countDocuments({
      $or: [{ contactUserId: admin._id }, { createdBy: admin._id }],
    });

    if (linkedProperties > 0) {
      return res.status(400).json({
        success: false,
        error:
          "This admin is still linked to properties. Reassign or delete those properties first.",
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: "Admin account deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.promoteAdminToSuperAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (user.role !== "admin") {
      return res.status(400).json({
        success: false,
        error: "Only admin accounts can be upgraded to super admin",
      });
    }

    user.role = "super_admin";
    await user.save();

    res.json({
      success: true,
      message: "Admin upgraded to super admin successfully",
      data: sanitizeUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.updateUserProfileByAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      name,
      phone,
      avatar,
      role,
      restricted,
      emailVerified,
      phoneVerified,
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (role && !["user", "admin", "super_admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role supplied",
      });
    }

    if (role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        error: "Only a super admin can assign the super admin role",
      });
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (avatar !== undefined) user.avatar = avatar;
    if (role !== undefined) user.role = role;
    if (restricted !== undefined) user.restricted = restricted;
    if (emailVerified !== undefined) user.emailVerified = emailVerified;
    if (phoneVerified !== undefined) user.phoneVerified = phoneVerified;

    await user.save();

    res.json({
      success: true,
      message: "User profile updated successfully",
      data: sanitizeUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getFavoriteProperties = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("favorites");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const favoriteProperties = await Property.find({
      _id: { $in: user.favorites },
    });

    res.json({
      success: true,
      data: favoriteProperties,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.addToFavorites = async (req, res) => {
  try {
    const { propertyId } = req.body;
    const user = await User.findById(req.user.id);

    const index = user.favorites.indexOf(propertyId);

    if (index === -1) {
      user.favorites.push(propertyId);
    } else {
      user.favorites.splice(index, 1);
    }

    await user.save();

    res.json({
      success: true,
      data: user.favorites,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.removeFromFavorites = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const user = await User.findById(req.user.id);

    user.favorites = user.favorites.filter(
      (id) => id.toString() !== propertyId,
    );
    await user.save();

    res.json({
      success: true,
      data: user.favorites,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.updateAgentRolesToAdmin = async (req, res) => {
  try {
    const result = await User.updateMany(
      { role: "agent" },
      { $set: { role: "admin" } },
    );

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} users from agent to admin role`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
