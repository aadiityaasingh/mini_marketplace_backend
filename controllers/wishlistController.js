
import mongoose from "mongoose";
import Wishlist from "../models/wishlist.js";
import Product from "../models/product.js";

// @desc    Get the logged-in user's wishlist
// @route   GET /api/wishlist
// @access  Private
export const getWishlist = async (req, res) => {
  try {
    const userId = req.user._id ?? req.user.id;

    const wishlist = await Wishlist.find({ user: userId })
      .populate({
        path: "product",
        match: { status: "active" },
        populate: {
          path: "seller",
          select: "name",
        },
      })
      .sort({ createdAt: -1 });

    // Exclude products that are no longer active.
    const products = wishlist
      .filter((item) => item.product)
      .map((item) => ({
        wishlistId: item._id,
        addedAt: item.createdAt,
        product: item.product,
      }));

    return res.status(200).json({
      success: true,
      count: products.length,
      wishlist: products,
    });
  } catch (error) {
    console.error("Get wishlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch wishlist.",
    });
  }
};

// @desc    Add a product to the wishlist
// @route   POST /api/wishlist/:productId
// @access  Private
export const addToWishlist = async (req, res) => {
  try {
    const userId = req.user._id ?? req.user.id;
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findById(productId);

    if (!product || product.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Product is not available.",
      });
    }

    // Prevent users from saving their own listing.
    if (product.seller.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot add your own listing to your wishlist.",
      });
    }

    const existingItem = await Wishlist.findOne({
      user: userId,
      product: productId,
    });

    if (existingItem) {
      return res.status(409).json({
        success: false,
        message: "This product is already in your wishlist.",
      });
    }

    const wishlistItem = await Wishlist.create({
      user: userId,
      product: productId,
    });

    return res.status(201).json({
      success: true,
      message: "Product added to wishlist.",
      wishlistItem,
    });
  } catch (error) {
    // Handle duplicate requests safely, including concurrent requests.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This product is already in your wishlist.",
      });
    }

    console.error("Add to wishlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add product to wishlist.",
    });
  }
};

// @desc    Remove a product from the wishlist
// @route   DELETE /api/wishlist/:productId
// @access  Private
export const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user._id ?? req.user.id;
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const deletedItem = await Wishlist.findOneAndDelete({
      user: userId,
      product: productId,
    });

    if (!deletedItem) {
      return res.status(404).json({
        success: false,
        message: "Product was not found in your wishlist.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist.",
    });
  } catch (error) {
    console.error("Remove from wishlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove product from wishlist.",
    });
  }
};
