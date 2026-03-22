const express = require("express");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const {
  getProperties,
  getPropertyById,
  getManagedProperties,
  getManagedPropertyById,
  createProperty,
  deactivateProperty,
  updateProperty,
  approveProperty,
  deleteProperty,
} = require("../controllers/propertyController");
const upload = require("../middleware/upload");

const router = express.Router();

router.get("/manage", auth, requireRole("admin", "super_admin"), getManagedProperties);
router.get("/manage/:id", auth, requireRole("admin", "super_admin"), getManagedPropertyById);
router.get("/", getProperties);
router.get("/:id", getPropertyById);
router.post("/", auth, requireRole("admin", "super_admin"), upload.array("images", 10), createProperty);

router.put("/:id/deactivate", auth, requireRole("admin", "super_admin"), deactivateProperty);

router.put("/:id", auth, requireRole("admin", "super_admin"), upload.array("images", 10), updateProperty);
router.patch("/:id/approval", auth, requireRole("super_admin"), approveProperty);

router.delete("/:id", auth, requireRole("super_admin"), deleteProperty);

module.exports = router;
