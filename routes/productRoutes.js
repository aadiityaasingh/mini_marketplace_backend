
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

// Public routes


// router.post(
//   "/",
//   protect,
//   (req, res, next) => {
//     console.log("POST /api/products reached");
//     next();
//   },
//   uploadProductImages,
//   (req, res, next) => {
//     console.log("Multer executed");
//     console.log("Content-Type:", req.headers["content-type"]);
//     console.log("Files:", req.files);
//     next();
//   },
//   createProduct
// );


router.get("/", getAllProducts);

// Keep this before /:id so Express doesn't interpret "my-products" as an ID.
router.get("/my-products", protect, getMyProducts);

// Protected create route: process uploaded images before creating the product.
router.post("/", protect, uploadProductImages, createProduct);

// Other product routes
router.get("/:id", getProductById);
router.patch("/:id/status", protect, updateProductStatus);
router.patch("/:id", protect, updateProduct);
router.delete("/:id", protect, deleteProduct);

export default router;
