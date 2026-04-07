const jwt = require("jsonwebtoken");
const { findById } = require("../repositories/users");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Token is not valid",
      });
    }

    delete user.password;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: "Token is not valid",
    });
  }
};

module.exports = auth;
