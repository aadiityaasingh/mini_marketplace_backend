
export const uploadProductImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one image.",
      });
    }

    const images = req.files.map((file) => ({
      url: file.path,
      publicId: file.filename,
    }));

    return res.status(200).json({
      success: true,
      message: "Images uploaded successfully.",
      images,
    });
  } catch (error) {
    console.error("Image upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Image upload failed.",
    });
  }
};
