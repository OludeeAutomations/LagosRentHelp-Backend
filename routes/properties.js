const express = require("express");
const auth = require("../middleware/auth");
const {
  getProperties,
  getPropertyById,
  createProperty,
} = require("../controllers/propertyController");
const upload = require("../middleware/upload");
const checkSubscription = require("../middleware/checkSubscription");

const router = express.Router();

router.get("/", getProperties);
router.get("/:id", getPropertyById);
router.post(
  "/",
  auth,
  upload.array("images", 10),
  checkSubscription,
  createProperty
);

module.exports = router;
