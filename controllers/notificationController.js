
import mongoose from "mongoose";
import Notification from "../models/notification.js";

const getUserId = (req) => req.user?._id ?? req.user?.id;

// GET /api/notifications
export const getNotifications = async (req, res) => {
  try {
    const userId = getUserId(req);

    const notifications = await Notification.find({
      recipient: userId,
    })
      .populate("sender", "name")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load notifications.",
    });
  }
};

// GET /api/notifications/unread-count
export const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: getUserId(req),
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error("Get unread count error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to get unread notification count.",
    });
  }
};

// PATCH /api/notifications/:notificationId/read
export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    if (!mongoose.isValidObjectId(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID.",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipient: getUserId(req),
      },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      notification,
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to mark notification as read.",
    });
  }
};

// PATCH /api/notifications/read-all
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        recipient: getUserId(req),
        isRead: false,
      },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to mark notifications as read.",
    });
  }
};

// DELETE /api/notifications/:notificationId
export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    if (!mongoose.isValidObjectId(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID.",
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: getUserId(req),
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted.",
    });
  } catch (error) {
    console.error("Delete notification error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete notification.",
    });
  }
};
