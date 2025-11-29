const express = require("express");
const auth = require("../middleware/auth");
const {
  getProperties,
  getPropertyById,
  createProperty,
  deactivateProperty,
  updateProperty,
} = require("../controllers/propertyController");
const upload = require("../middleware/upload");
const checkSubscription = require("../middleware/checkSubscription");

const router = express.Router();

router.get("/", getProperties);
router.get("/:id", getPropertyById);
router.post("/", auth, upload.array("images", 10), createProperty);

router.put("/:id/deactivate", auth, deactivateProperty);

router.put(
  "/:id",
  auth, // specific to your auth middleware
  upload.array("images"), // This is REQUIRED to parse req.body from FormData
  updateProperty
);
module.exports = router;
