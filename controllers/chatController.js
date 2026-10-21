import mongoose from "mongoose";
import Conversation from "../models/conversation.js";
import Message from "../models/message.js";
import Product from "../models/product.js";

const getUserId = (req) => req.user?._id ?? req.user?.id;

const isValidId = (id) => mongoose.isValidObjectId(id);

// Start a conversation or return the existing one.
export const startConversation = async (req, res) => {
  try {
    const buyerId = getUserId(req);
    const { productId } = req.params;

    if (!isValidId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      status: "active",
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or no longer available.",
      });
    }

    const sellerId = product.seller;

    if (sellerId.toString() === buyerId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot contact yourself about your own listing.",
      });
    }

    let conversation = await Conversation.findOne({
      product: product._id,
      buyer: buyerId,
      seller: sellerId,
    });

    if (!conversation) {
      try {
        conversation = await Conversation.create({
          product: product._id,
          buyer: buyerId,
          seller: sellerId,
        });
      } catch (error) {
        // Handle simultaneous requests that create the same conversation.
        if (error.code !== 11000) throw error;

        conversation = await Conversation.findOne({
          product: product._id,
          buyer: buyerId,
          seller: sellerId,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Conversation ready.",
      conversation,
    });
  } catch (error) {
    console.error("Start conversation error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to start conversation.",
    });
  }
};

// Get all conversations belonging to the logged-in user.
export const getConversations = async (req, res) => {
  try {
    const userId = getUserId(req);

    const conversations = await Conversation.find({
      $or: [{ buyer: userId }, { seller: userId }],
    })
      .populate("product", "title images price listingType status")
      .populate("buyer", "name")
      .populate("seller", "name")
      .sort({ lastMessageAt: -1 });

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load conversations.",
    });
  }
};

// Get message history for a conversation.
export const getMessages = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { conversationId } = req.params;

    if (!isValidId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      $or: [{ buyer: userId }, { seller: userId }],
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    const messages = await Message.find({
      conversation: conversationId,
    })
      .populate("sender", "name")
      .sort({ createdAt: 1 })
      .limit(200);

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Get messages error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load messages.",
    });
  }
};

// Send a message using the protected REST API.
export const sendMessage = async (req, res) => {
  try {
    const senderId = getUserId(req);
    const { conversationId } = req.params;
    const text = req.body.text?.trim();

    if (!isValidId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
    }

    if (!text || text.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Message must contain 1–2000 characters.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      $or: [{ buyer: senderId }, { seller: senderId }],
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      text,
      readBy: [senderId],
    });

    conversation.lastMessage = text;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    await message.populate("sender", "name");

    const io = req.app.get("io");

    // Deliver the message to participants in the conversation.
    io.to(`conversation:${conversation._id.toString()}`).emit(
      "new-message",
      message,
    );

    // Identify the participant who should receive the notification.
    const recipientId =
      conversation.buyer.toString() === senderId.toString()
        ? conversation.seller
        : conversation.buyer;

    // Save and deliver the notification separately, so a notification
    // failure does not turn an already-saved message into an API error.
    try {
      const notification = await Notification.create({
        recipient: recipientId,
        sender: senderId,
        type: "new_message",
        title: `New message from ${message.sender?.name || "Campus member"}`,
        message: text.length > 100 ? `${text.slice(0, 97)}...` : text,
        link: `/chats/${conversation._id}`,
        relatedConversation: conversation._id,
        relatedMessage: message._id,
      });

      await notification.populate("sender", "name");

      // Only the intended recipient's authenticated sockets receive it.
      io.to(`user:${recipientId.toString()}`).emit(
        "notification:new",
        notification,
      );
    } catch (notificationError) {
      console.error("Create message notification error:", notificationError);
    }

    return res.status(201).json({
      success: true,
      message: "Message sent.",
      data: message,
    });
  } catch (error) {
    console.error("Send message error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to send message.",
    });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const userId = req.user?._id ?? req.user?.id;
    const { conversationId } = req.params;

    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
    }

    // Only participants can mark messages in this conversation as read.
    const conversation = await Conversation.findOne({
      _id: conversationId,
      $or: [{ buyer: userId }, { seller: userId }],
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    // Mark only messages sent by the other participant as read.
    const result = await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        readBy: { $ne: userId },
      },
      {
        $addToSet: { readBy: userId },
      },
    );

    // Notify the other participant if any messages changed to read.
    if (result.modifiedCount > 0) {
      const io = req.app.get("io");

      io.to(`conversation:${conversationId}`).emit("messages-read", {
        conversationId,
        readerId: String(userId),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Messages marked as read.",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark messages as read error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to mark messages as read.",
    });
  }
};
