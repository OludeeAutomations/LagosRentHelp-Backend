const express = require("express");
const {
  getAgentProfile,
  updateAgentProfile,
  submitAgentApplication,
} = require("../controllers/agentController");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

router.get("/:id", getAgentProfile);
router.put("/profile", auth, updateAgentProfile);
router.post(
  "/apply",
  auth,
  upload.fields([
    { name: "governmentId", maxCount: 1 },
    { name: "idPhoto", maxCount: 1 },
  ]),
  submitAgentApplication
);

module.exports = router;
