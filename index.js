require("dotenv").config();
const express = require("express");
const cors = require("cors");
// const helmet = require("helmet");
// const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
// const errorMiddleware = require("./middlewares/error.middleware");

// Import routes
const authRoutes = require("./routes/auth.routes");
const gameRoutes = require("./routes/game.routes");
const walletRoutes = require("./routes/wallet.routes");
// const paymentRoutes = require("./routes/payment.routes");
// const transactionRoutes = require("./routes/transaction.routes");

// // Import socket handlers
const http = require("http");
const { Server } = require("socket.io");
// const setupSocketHandlers = require("./sockets/sockethandler");
const setupGameSocketHandlers = require("./sockets/game.socket");
const GameRound = require('./models/gameRound.model');
const gameController = require('./controllers/game.controller');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Connect to database
connectDB();

// Security middleware
// app.use(helmet());

// Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: "Too many requests from this IP, please try again later.",
// });
// app.use(limiter);

// CORS
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true}) );

// Health check endpoint
// app.get("/health", (req, res) => {
//   res.status(200).json({
//     status: "OK",
//     message: "Color Prediction Game Server is running",
//     timestamp: new Date().toISOString(),
//   });
// });

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);
// app.use("/api/payment", paymentRoutes);
app.use("/api/wallet", walletRoutes);
// app.use("/api/transaction", transactionRoutes);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
});

// Setup socket handlers
// setupSocketHandlers(io);
const socketEmitters = setupGameSocketHandlers(io);

// Make socket emitters available globally
global.socketEmitters = socketEmitters;

// Scheduler: Automatically complete and start new rounds every second
setInterval(async () => {
  try {
    // Find the current round
    const round = await GameRound.findOne({ status: { $in: ['betting', 'spinning'] } }).sort({ startTime: -1 });
    const now = new Date();
    if (round) {
      if (now > round.endTime && round.status !== 'completed') {
        // Complete the round if its endTime has passed
        await gameController.completeCurrentRound({}, { json: () => {}, status: () => ({ json: () => {} }) });
        // Start a new round immediately after completion
        await gameController.startNewRound({}, { json: () => {}, status: () => ({ json: () => {} }) });
      }
    } else {
      // No active round, start a new one
      await gameController.startNewRound({}, { json: () => {}, status: () => ({ json: () => {} }) });
    }
  } catch (err) {
    console.error('Error in round scheduler:', err);
  }
}, 1000); // check every 1 second for continuous monitoring

// Error handling middleware (should be last)
// app.use(errorMiddleware);

// 404 handler
// app.use("*", (req, res) => {
//   res.status(404).json({
//     message: "Route not found",
//     path: req.originalUrl,
//   });
// });

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Color Prediction Game Server listening on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎮 Socket.IO server ready`);
});

// Graceful shutdown
// process.on("SIGTERM", () => {
//   console.log("SIGTERM received, shutting down gracefully");
//   server.close(() => {
//     console.log("Process terminated");
//   });
// });

// process.on("SIGINT", () => {
//   console.log("SIGINT received, shutting down gracefully");
//   server.close(() => {
//     console.log("Process terminated");
//   });
// });
