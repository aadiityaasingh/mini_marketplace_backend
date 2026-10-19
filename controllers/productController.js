import Product from "../models/product.js";

import mongoose from "mongoose";

export const createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      condition,
      listingType,
      location,
    } = req.body;


    if (
      !title?.trim() ||
      !description?.trim() ||
      !category ||
      !condition ||
      !listingType
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Title, description, category, condition, and listing type are required.",
      });
    }


    const images = (req.files || [])
      .map((file) => file.path)
      .filter(Boolean);


    let productPrice = 0;

    if (price !== undefined && price !== "") {
      productPrice = Number(price);

      if (!Number.isFinite(productPrice) || productPrice < 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be a valid non-negative number.",
        });
      }
    }

    const product = await Product.create({
      title: title.trim(),
      description: description.trim(),
      price: productPrice,
      category,
      condition,
      listingType,
      images,
      location,
      seller: req.user._id ?? req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Product listed successfully.",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);

    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create product.",
    });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      listingType,
      condition,
      minPrice,
      maxPrice,
      sort = "newest",
    } = req.query;

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 50.",
      });
    }

    const filter = { status: "active" };

    if (search?.trim()) {
      const escapedSearch = search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        { title: { $regex: escapedSearch, $options: "i" } },
        { description: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    if (category) filter.category = category;
    if (listingType) filter.listingType = listingType;
    if (condition) filter.condition = condition;

    // Validate price filters.
    if (minPrice !== undefined || maxPrice !== undefined) {
      const min = minPrice === undefined ? 0 : Number(minPrice);
      const max = maxPrice === undefined ? Infinity : Number(maxPrice);

      if (
        !Number.isFinite(min) ||
        min < 0 ||
        (maxPrice !== undefined && (!Number.isFinite(max) || max < 0)) ||
        min > max
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid price range.",
        });
      }

      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = min;
      if (maxPrice !== undefined) filter.price.$lte = max;
    }

    // Allow only known sort options.
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_asc: { price: 1, createdAt: -1 },
      price_desc: { price: -1, createdAt: -1 },
    };

    if (!sortOptions[sort]) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid sort option. Use newest, oldest, price_asc, or price_desc.",
      });
    }

    const skip = (page - 1) * limit;

    const [products, totalProducts] = await Promise.all([
      Product.find(filter)
        .populate("seller", "name")
        .sort(sortOptions[sort])
        .skip(skip)
        .limit(limit)
        .lean(),

      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        totalProducts,
        totalPages: Math.ceil(totalProducts / limit),
        hasNextPage: page * limit < totalProducts,
        hasPreviousPage: page > 1,
      },
      products,
    });
  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findOne({
      _id: id,
      status: "active",
    }).populate("seller", "name");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Get product by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};



export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findOne({
      _id: id,
      seller: req.user._id ?? req.user.id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or you do not own this listing.",
      });
    }

    if (product.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Only active listings can be edited.",
      });
    }

    const {
      title,
      description,
      price,
      category,
      condition,
      listingType,
      location,
      existingImages,
    } = req.body;

    if (
      !title?.trim() ||
      !description?.trim() ||
      !category ||
      !condition ||
      !listingType ||
      !location?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required listing fields.",
      });
    }

    let retainedImages;

    try {
      retainedImages =
        existingImages === undefined
          ? product.images
          : JSON.parse(existingImages);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid existing images data.",
      });
    }

    if (
      !Array.isArray(retainedImages) ||
      !retainedImages.every((url) => typeof url === "string") ||
      retainedImages.some((url) => !product.images.includes(url))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid image selection.",
      });
    }

    const newImages = (req.files || [])
      .map((file) => file.path)
      .filter(Boolean);

    if (retainedImages.length + newImages.length > 5) {
      return res.status(400).json({
        success: false,
        message: "A listing can have a maximum of 5 images.",
      });
    }

    const allowedListingTypes = [
      "sale",
      "rent",
      "exchange",
      "donation",
    ];

    const allowedCategories = [
      "books",
      "electronics",
      "hostel-essentials",
      "clothing",
      "furniture",
      "sports",
      "other",
    ];

    const allowedConditions = [
      "new",
      "like-new",
      "good",
      "fair",
    ];

    if (
      !allowedListingTypes.includes(listingType) ||
      !allowedCategories.includes(category) ||
      !allowedConditions.includes(condition)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing type, category, or condition.",
      });
    }

    const productPrice = Number(price);

    if (
      !Number.isFinite(productPrice) ||
      productPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Price must be a valid non-negative number.",
      });
    }

    product.title = title.trim();
    product.description = description.trim();
    product.category = category;
    product.condition = condition;
    product.listingType = listingType;
    product.location = location.trim();
    product.price = productPrice;
    product.images = [...retainedImages, ...newImages];

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error);

    if (
      error.name === "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};



export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }


    const product = await Product.findOne({
      _id: id,
      seller: req.user.id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }


    product.status = "removed";
    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product removed successfully.",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const allowedStatuses = ["active", "sold", "rented", "reserved"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(", ")}.`,
      });
    }

    const product = await Product.findOne({
      _id: id,
      seller: req.user.id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    if (product.status === "removed") {
      return res.status(400).json({
        success: false,
        message: "A removed listing cannot be updated.",
      });
    }

  
    if (["sold", "rented"].includes(product.status)) {
      return res.status(400).json({
        success: false,
        message: "This listing is already completed.",
      });
    }

    if (
      (status === "sold" && product.listingType !== "sale") ||
      (status === "rented" && product.listingType !== "rent")
    ) {
      return res.status(400).json({
        success: false,
        message: "Status does not match the listing type.",
      });
    }

    product.status = status;
    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product status updated successfully.",
      product,
    });
  } catch (error) {
    console.error("Update product status error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const getMyProducts = async (req, res) => {
  try {
    const {
      status,
      page: pageQuery = "1",
      limit: limitQuery = "10",
    } = req.query;

    const page = Number(pageQuery);
    const limit = Number(limitQuery);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 50.",
      });
    }

    const allowedStatuses = ["active", "sold", "rented", "reserved", "removed"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product status.",
      });
    }

    const filter = { seller: req.user.id };

    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;

    const [products, totalProducts] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        totalProducts,
        totalPages: Math.ceil(totalProducts / limit),
      },
      products,
    });
  } catch (error) {
    console.error("Get my products error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};
