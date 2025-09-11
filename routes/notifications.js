const express = require("express");
const {
  getNotifications,
  markAsRead,
  deleteNotification,
} = require("../controllers/notificationController");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, getNotifications);
router.patch("/:id/read", auth, markAsRead);
router.delete("/:id", auth, deleteNotification);

module.exports = router;
