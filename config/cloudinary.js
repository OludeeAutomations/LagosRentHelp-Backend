const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create storage engine for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "lagos-rent-help/agents",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
    transformation: [
      { width: 800, height: 600, crop: "limit" }, // For images
      { quality: "auto" }, // Auto optimize quality
    ],
  },
});

module.exports = { cloudinary, storage };
