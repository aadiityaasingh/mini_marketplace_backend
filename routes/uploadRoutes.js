
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { uploadProductImages } from "../middleware/uploadMiddleware.js";
import {
  uploadProductImages as uploadImagesController,
} from "../controllers/uploadController.js";

const router = express.Router();

router.post(
  "/products",
  protect,
  uploadProductImages,
  uploadImagesController
);

export default router;
