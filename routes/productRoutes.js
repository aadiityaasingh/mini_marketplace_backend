
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

import {
  uploadProductImages,
} from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/", getAllProducts);

router.get("/my-products", protect, getMyProducts);

router.get("/:id", getProductById);


router.post(
  "/",
  protect,
  uploadProductImages,
  createProduct
);

router.patch("/:id/status", protect, updateProductStatus);
router.patch("/:id", protect, updateProduct);
router.delete("/:id", protect, deleteProduct);

export default router;
