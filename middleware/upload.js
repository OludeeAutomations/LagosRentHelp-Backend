// middleware/upload.js
const multer = require("multer");
const { storage } = require("../config/cloudinary");

// Create Multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log("📁 Processing file:", file.originalname);

    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only images and PDF files are allowed"), false);
    }
  },
});

// Debug log
console.log("✅ Multer upload instance created");

// Export the Multer instance directly
module.exports = upload;
