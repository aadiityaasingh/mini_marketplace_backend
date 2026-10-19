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

    io.to(`conversation:${conversation._id.toString()}`).emit(
      "new-message",
      message,
    );

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
