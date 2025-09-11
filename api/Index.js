const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes with console.log to show which routes are being loaded
console.log("Loading routes...");
app.use("/api/auth", require("../routes/auth"));
console.log("✓ Auth routes loaded: /api/auth");

app.use("/api/users", require("../routes/users"));
console.log("✓ User routes loaded: /api/users");

app.use("/api/properties", require("../routes/properties"));
console.log("✓ Property routes loaded: /api/properties");

app.use("/api/agents", require("../routes/agents"));
console.log("✓ Agent routes loaded: /api/agents");

app.use("/api/leads", require("../routes/leads"));
console.log("✓ Lead routes loaded: /api/leads");

app.use("/api/notifications", require("../routes/notifications"));
console.log("✓ Notification routes loaded: /api/notifications");

app.use("/api/reviews", require("../routes/reviews"));
console.log("✓ Review routes loaded: /api/reviews");

console.log("All routes loaded successfully!");

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

console.log(`Starting server on port ${PORT}...`);
console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/realestate")
  .then(() => {
    console.log("✅ Connected to MongoDB successfully");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(
        `📝 API endpoints available at http://localhost:${PORT}/api/`
      );
    });
  })
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1); // Exit the process if MongoDB connection fails
  });

// Graceful shutdown handling
process.on("SIGINT", () => {
  console.log("\n🔻 Shutting down server gracefully...");
  mongoose.connection.close(() => {
    console.log("✅ MongoDB connection closed");
    process.exit(0);
  });
});
