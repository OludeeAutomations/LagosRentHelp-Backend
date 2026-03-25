const express = require("express");
const {
  getProfile,
  updateProfile,
  listManageableUsers,
  listAdminAccounts,
  createAdminAccount,
  deleteAdminAccount,
  promoteAdminToSuperAdmin,
  updateUserProfileByAdmin,
  updateAgentRolesToAdmin,
  addToFavorites,
  removeFromFavorites,
  getFavoriteProperties,
} = require("../controllers/userController");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

const router = express.Router();

router.get("/profile", auth, getProfile);
router.put("/profile", auth, updateProfile);
router.get(
  "/manageable",
  auth,
  requireRole("admin", "super_admin"),
  listManageableUsers,
);
router.get("/admins", auth, requireRole("super_admin"), listAdminAccounts);
router.post("/admins", auth, requireRole("super_admin"), createAdminAccount);
router.delete(
  "/admins/:userId",
  auth,
  requireRole("super_admin"),
  deleteAdminAccount,
);
router.patch(
  "/admins/:userId/promote",
  auth,
  requireRole("super_admin"),
  promoteAdminToSuperAdmin,
);
router.put(
  "/:userId/profile",
  auth,
  requireRole("super_admin"),
  updateUserProfileByAdmin,
);
router.get("/favorites", auth, getFavoriteProperties);
router.post("/favorites", auth, addToFavorites);
router.delete("/favorites/:propertyId", auth, removeFromFavorites);

router.post(
  "/agents-to-admins",
  auth,
  requireRole("super_admin"),
  updateAgentRolesToAdmin,
);

module.exports = router;
