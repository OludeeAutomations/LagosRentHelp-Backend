const { createNotification: insertNotification } = require("../repositories/notifications");

async function createNotification({
  userId,
  type,
  title,
  message,
  link = null,
  priority = "medium",
  actionRequired = false,
}) {
  try {
    if (!userId || !type || !title || !message) {
      throw new Error("userId, type, title and message are required");
    }

    const notification = await insertNotification({
      userId,
      type,
      title,
      message,
      link,
      priority,
      actionRequired,
    });

    return notification;
  } catch (error) {
    console.error("Create Notification Error:", error.message);
    throw error;
  }
}
module.exports = createNotification;
