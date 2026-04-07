const bcrypt = require("bcryptjs");
const {
  countPropertiesLinkedToUser,
  createUser,
  deleteUser,
  findByEmailOrPhone,
  findById,
  listUsers,
  updateUser,
  updateUsersByRole,
} = require("../repositories/users");
const { findPropertyById } = require("../repositories/properties");

const sanitizeUser = (user) => {
  const safeUser = { ...user };
  delete safeUser.password;
  delete safeUser.verification;
  return safeUser;
};

exports.getProfile = async (req, res) => {
  try {
    const user = await findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: sanitizeUser(user),
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
    const user = await updateUser(req.user.id, { name, phone, avatar });

    res.json({
      success: true,
      data: sanitizeUser(user),
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
    const users = await listUsers({
      role: req.query.role,
      search: req.query.search,
    });

    res.json({
      success: true,
      data: users.map(sanitizeUser),
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
    const admins = await listUsers({
      search: req.query.search,
      role: req.query.role,
      adminOnly: true,
    });

    res.json({
      success: true,
      data: admins.map(sanitizeUser),
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

    const existingUser = await findByEmailOrPhone({ email, phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User with this email or phone already exists",
      });
    }

    const admin = await createUser({
      name,
      email,
      phone,
      password: await bcrypt.hash(password, 12),
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
    const admin = await findById(userId);

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

    const linkedProperties = await countPropertiesLinkedToUser(admin._id);
    if (linkedProperties > 0) {
      return res.status(400).json({
        success: false,
        error:
          "This admin is still linked to properties. Reassign or delete those properties first.",
      });
    }

    await deleteUser(userId);

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
    const user = await findById(req.params.userId);

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

    const updatedUser = await updateUser(user._id, { role: "super_admin" });

    res.json({
      success: true,
      message: "Admin upgraded to super admin successfully",
      data: sanitizeUser(updatedUser),
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
    const currentUser = await findById(userId);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const {
      name,
      phone,
      avatar,
      role,
      restricted,
      emailVerified,
      phoneVerified,
    } = req.body;

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

    const updatedUser = await updateUser(userId, {
      name: name !== undefined ? name : currentUser.name,
      phone: phone !== undefined ? phone : currentUser.phone,
      avatar: avatar !== undefined ? avatar : currentUser.avatar,
      role: role !== undefined ? role : currentUser.role,
      restricted: restricted !== undefined ? restricted : currentUser.restricted,
      emailVerified:
        emailVerified !== undefined ? emailVerified : currentUser.emailVerified,
      phoneVerified:
        phoneVerified !== undefined ? phoneVerified : currentUser.phoneVerified,
    });

    res.json({
      success: true,
      message: "User profile updated successfully",
      data: sanitizeUser(updatedUser),
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
    const user = await findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const favorites = [];
    for (const propertyId of user.favorites || []) {
      const property = await findPropertyById(propertyId);
      if (property) favorites.push(property);
    }

    res.json({
      success: true,
      data: favorites,
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
    const user = await findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const property = await findPropertyById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Property not found",
      });
    }

    const favorites = [...(user.favorites || [])];
    const index = favorites.indexOf(propertyId);

    if (index === -1) favorites.push(propertyId);
    else favorites.splice(index, 1);

    await updateUser(user._id, { favorites });

    res.json({
      success: true,
      data: favorites,
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
    const user = await findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const favorites = (user.favorites || []).filter((id) => id !== propertyId);
    await updateUser(user._id, { favorites });

    res.json({
      success: true,
      data: favorites,
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
    const result = await updateUsersByRole("agent", "admin");

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
