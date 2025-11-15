const express = require("express");
const auth = require("../middleware/auth");
const {
  getProperties,
  getPropertyById,
  createProperty,
  deactivateProperty,
  updateProperty
} = require("../controllers/propertyController");
const upload = require("../middleware/upload");
const checkSubscription = require("../middleware/checkSubscription");

const router = express.Router();

router.get("/", getProperties);
router.get("/:id", getPropertyById);
router.post("/properties", auth, upload.array("images", 10), createProperty);

router.put("/:id/deactivate", auth, deactivateProperty);

router.put(
  "/update/:id",
  auth, 
  upload.array("images", 10),
  updateProperty
);

module.exports = router;
