import express from "express";
import { protect } from "../middleware/authMiddleware.js";

import {
  startConversation,
  getConversations,
  getMessages,
  sendMessage,
  markMessagesAsRead
} from "../controllers/chatController.js";

const router = express.Router();

router.use(protect);

router.get("/", getConversations);

router.post("/product/:productId", startConversation);

router.get("/:conversationId/messages", getMessages);

router.post("/:conversationId/messages", sendMessage);
router.patch(
  "/:conversationId/read",
  markMessagesAsRead
);

export default router;