
import "dotenv/config";


import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Conversation from "./models/conversation.js";

import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { Server } from "socket.io";

import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

const app = express();

// Create one HTTP server for Express and Socket.IO.
const httpServer = http.createServer(app);

// Initialize Socket.IO.
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

// Make Socket.IO accessible inside Express controllers via req.app.get("io").
app.set("io", io);


/* Authenticate Socket.IO connections using the existing JWT. */
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required."));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "mit-mini-market",
      audience: "mit-mini-market-users",
    });

    if (!decoded.userId) {
      return next(new Error("Invalid authentication token."));
    }

    socket.data.user = {
      id: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    next(new Error("Invalid or expired authentication token."));
  }
});

/* Allow authenticated users to join only their own conversations. */
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("join-conversation", async (conversationId, callback) => {
    const reply = typeof callback === "function" ? callback : () => {};

    try {
      if (!mongoose.isValidObjectId(conversationId)) {
        return reply({
          success: false,
          message: "Invalid conversation ID.",
        });
      }

      const userId = socket.data.user.id;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        $or: [{ buyer: userId }, { seller: userId }],
      }).select("_id");

      if (!conversation) {
        return reply({
          success: false,
          message: "You are not a participant in this conversation.",
        });
      }

      const room = `conversation:${conversation._id.toString()}`;

      await socket.join(room);

      reply({
        success: true,
        message: "Joined conversation.",
      });
    } catch (error) {
      console.error("Join conversation error:", error);

      reply({
        success: false,
        message: "Unable to join conversation.",
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});


// Middleware
app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));
app.use(morgan("dev"));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/chats", chatRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MIT Mini Market API is running",
  });
});

// Start the server after connecting to MongoDB.
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log("Socket.IO is initialized.");
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
