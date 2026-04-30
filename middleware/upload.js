// middleware/upload.js
const multer = require("multer");

// Use memory storage so file.buffer is available for streamifier → Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
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
