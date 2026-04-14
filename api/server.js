const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const supabase = require("../config/supabase");

dotenv.config();

const app = express();

const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
];

console.log("=== DEBUG ENV CHECK ===");
requiredEnvVars.forEach((key) =>
  console.log(`${key}: ${process.env[key] ? "SET" : "MISSING"}`),
);
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
}

const allowedOrigins = [
  "http://localhost:5173",
  "https://lagosrenthelp.ng",
  "https://lagosrenthelp.onrender.com",
];
// TEMP DEBUG: Loosened CORS

const corsOptions = {
  origin: true, // TEMP DEBUG: Allow all origins to test if origin check blocking
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

console.log("Applying CORS middleware...");
app.use(cors(corsOptions));
console.log(
  "CORS middleware applied. Allowed origin:",
  typeof corsOptions.origin === "boolean" ? "ALL (debug)" : "specific list",
);
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(cookieParser());

app.use("/api/auth", require("../routes/auth"));
app.use("/api/users", require("../routes/users"));
app.use("/api/properties", require("../routes/properties"));
app.use("/api/leads", require("../routes/leads"));
app.use("/api/notifications", require("../routes/notifications"));
app.use("/api/reviews", require("../routes/reviews"));
app.use("/api/verification", require("../routes/verification"));

app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Resource not found",
  });
});

const PORT = process.env.PORT || 5000;

console.log("Testing Supabase connection...");
supabase
  .from("users")
  .select("id", { head: true, count: "exact" })
  .then(({ error, count }) => {
    if (error) throw error;
    console.log("Supabase connected successfully. Users count:", count);

    console.log("Starting server on port", PORT, "...");
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`API endpoints available at http://localhost:${PORT}/api/`);
    });
  })
  .catch((error) => {
    console.error("❌ Supabase connection error:", error.message);
    process.exit(1);
  });

process.on("SIGINT", () => {
  console.log("\nShutting down server gracefully...");
  process.exit(0);
});
