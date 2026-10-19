
import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// A user can save a particular product only once.
wishlistSchema.index(
  { user: 1, product: 1 },
  { unique: true }
);

const wishlist = mongoose.model("Wishlist", wishlistSchema);

export default wishlist;
