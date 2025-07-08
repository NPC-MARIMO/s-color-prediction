require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const errorMiddleware = require("./middlewares/error.middleware");

// Import routes
const authRoutes = require("./routes/auth.routes");
const gameRoutes = require("./routes/game.routes");
const paymentRoutes = require("./routes/payment.routes");
const walletRoutes = require("./routes/wallet.routes");
const transactionRoutes = require("./routes/transaction.routes");

// Import socket handlers
const http = require("http");
const { Server } = require("socket.io");
const setupSocketHandlers = require("./sockets/sockethandler");
const setupGameSocketHandlers = require("./sockets/game.socket");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Connect to database
connectDB();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Color Prediction Game Server is running",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/transaction", transactionRoutes);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
});

// Setup socket handlers
setupSocketHandlers(io);
setupGameSocketHandlers(io);

// Error handling middleware (should be last)
app.use(errorMiddleware);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Color Prediction Game Server listening on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎮 Socket.IO server ready`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
  });
});
