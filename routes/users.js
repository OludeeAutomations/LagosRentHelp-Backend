const express = require("express");
const {
  getProfile,
  updateProfile,
  addToFavorites,
  removeFromFavorites,
   getFavoriteProperties
} = require("../controllers/userController");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/profile", auth, getProfile);
router.put("/profile", auth, updateProfile);
router.get("/favorites", auth, getFavoriteProperties);
router.post("/favorites", auth, addToFavorites);
router.delete("/favorites/:propertyId", auth, removeFromFavorites);

module.exports = router;
