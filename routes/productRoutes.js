
import express from "express";
import { protect } from "../middleware/authMiddleware.js";

import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  updateProductStatus,
  getMyProducts,
} from "../controllers/productController.js";

import { uploadProductImages } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Get all active products
router.get("/", getAllProducts);

// Get the logged-in user's listings
router.get("/my-products", protect, getMyProducts);

// Get a single product by ID
router.get("/:id", getProductById);

// Create a product with images
router.post(
  "/",
  protect,
  uploadProductImages,
  createProduct
);

// Update listing status
router.patch("/:id/status", protect, updateProductStatus);

// Edit a listing, including adding new images
router.patch(
  "/:id",
  protect,
  uploadProductImages,
  updateProduct
);

// Delete a listing
router.delete("/:id", protect, deleteProduct);

export default router;
