
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Product title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [100, "Title cannot exceed 100 characters"],
    },

    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },

    price: {
      type: Number,
      required: function () {
        return this.listingType === "sale" || this.listingType === "rent";
      },
      min: [0, "Price cannot be negative"],
      default: 0,
    },

    category: {
      type: String,
      required: [true, "Product category is required"],
      enum: [
        "books",
        "electronics",
        "hostel-essentials",
        "clothing",
        "furniture",
        "sports",
        "other",
      ],
    },

    condition: {
      type: String,
      required: [true, "Product condition is required"],
      enum: ["new", "like-new", "good", "fair"],
    },

    listingType: {
      type: String,
      required: [true, "Listing type is required"],
      enum: ["sale", "rent", "exchange", "donation"],
    },

    images: {
      type: [String],
      default: [],
      validate: {
        validator: (images) => images.length <= 5,
        message: "A product can have at most 5 images",
      },
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "sold", "rented", "reserved", "removed"],
      default: "active",
      index: true,
    },

    location: {
      type: String,
      trim: true,
      maxlength: [100, "Location cannot exceed 100 characters"],
    },
  },
  {
    timestamps: true,
  }
);

// Helps with common marketplace queries.
productSchema.index({ status: 1, category: 1, createdAt: -1 });

const Product = mongoose.model("Product", productSchema);

export default Product;
