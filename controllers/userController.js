const User = require("../models/User");
const Agent = require("../models/Agent")
const Property = require("../models/Property")


exports.getProfile = async (req, res) => {
  try {
    // Find user (exclude password)
    const user = await User.findById(req.user.id).select("-password");
    var agent = null;

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }


    // ✅ If user is an agent, fetch the agent profile and include it
    if (user.role === "agent") {
      agent = await Agent.findOne({ userId: user._id }).lean();
    }
    res.status(200).json({
      success: true,
      data: user,
      agentData:agent
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
      { new: true, runValidators: true }
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
exports.getFavoriteProperties = async (req, res) => {
  try {
    // Find the user by ID
    const user = await User.findById(req.user.id).populate("favorites");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Populate favorites with full property details
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

    // Check if already in favorites
    const index = user.favorites.indexOf(propertyId);

    if (index === -1) {
      // Not in favorites → Add it
      user.favorites.push(propertyId);
    } else {
      // Already in favorites → Remove it
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
      (id) => id.toString() !== propertyId
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
