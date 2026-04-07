const {
  deleteNotification,
  listNotifications,
  markNotificationAsRead,
} = require("../repositories/notifications");

exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.id;
    const { data, total } = await listNotifications({
      userId,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await markNotificationAsRead({
      id: req.params.id,
      userId: req.user.id,
    });

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    await deleteNotification({ id: req.params.id, userId: req.user.id });
    res.json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
