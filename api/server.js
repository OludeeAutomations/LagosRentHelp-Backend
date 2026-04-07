const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const supabase = require("../config/supabase");

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://lagosrenthelp.ng",
  "https://lagosrenthelp.onrender.com",
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

supabase
  .from("users")
  .select("id", { head: true, count: "exact" })
  .then(({ error }) => {
    if (error) throw error;

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API endpoints available at http://localhost:${PORT}/api/`);
    });
  })
  .catch((error) => {
    console.error("Supabase connection error:", error.message);
    process.exit(1);
  });

process.on("SIGINT", () => {
  console.log("\nShutting down server gracefully...");
  process.exit(0);
});
