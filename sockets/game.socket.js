const GameRound = require("../models/gameRound.model");
const Bet = require("../models/bet.model");
const User = require("../models/user.model");
const Wallet = require("../models/wallet.model");

module.exports = function setupGameSocketHandlers(io) {
  // Store active rounds in memory for real-time updates
  const activeRounds = new Map();

  // Emit round updates to all connected clients
  function emitRoundUpdate(round) {
    io.emit("round:update", {
      roundId: round.roundId,
      status: round.status,
      startTime: round.startTime,
      endTime: round.endTime,
      totalPool: round.totalPool,
      resultColor: round.resultColor,
    });
  }

  // Emit bet updates to all connected clients
  function emitBetUpdate(bet) {
    io.emit("bet:update", {
      roundId: bet.gameRoundId,
      userId: bet.userId,
      chosenColor: bet.chosenColor,
      amount: bet.amount,
      timestamp: bet.createdAt,
    });
  }

  // Emit result to all connected clients
  function emitRoundResult(round) {
    io.emit("round:result", {
      roundId: round.roundId,
      resultColor: round.resultColor,
      totalPool: round.totalPool,
      commission: round.commission,
    });
  }

  // Handle socket connections
  io.on("connection", (socket) => {
    console.log(`🎮 Game socket connected: ${socket.id}`);

    // Join user to their personal room
    socket.on("join:user", async (data) => {
      try {
        const { userId } = data;
        if (!userId) {
          socket.emit("error", { message: "User ID is required" });
          return;
        }

        const user = await User.findById(userId);
        if (!user) {
          socket.emit("error", { message: "User not found" });
          return;
        }

        // Update user's socket ID
        await User.findByIdAndUpdate(userId, {
          socketId: socket.id,
          isOnline: true,
        });

        socket.userId = userId;
        socket.join(`user:${userId}`);
        socket.emit("joined:user", { userId, message: "Joined user room" });

        console.log(`👤 User ${userId} joined game socket`);
      } catch (error) {
        console.error("Error joining user:", error);
        socket.emit("error", { message: "Failed to join user room" });
      }
    });

    // Get current active round
    socket.on("get:current-round", async () => {
      try {
        const currentRound = await GameRound.findOne({ status: "active" })
          .select("-bets")
          .sort({ createdAt: -1 });

        if (currentRound) {
          socket.emit("current:round", { round: currentRound });
        } else {
          socket.emit("current:round", { round: null });
        }
      } catch (error) {
        console.error("Error getting current round:", error);
        socket.emit("error", { message: "Failed to get current round" });
      }
    });

    // Get recent rounds
    socket.on("get:recent-rounds", async (data) => {
      try {
        const { limit = 10 } = data;
        const rounds = await GameRound.find({ status: "completed" })
          .select("roundId resultColor startTime endTime totalPool")
          .sort({ createdAt: -1 })
          .limit(parseInt(limit));

        socket.emit("recent:rounds", { rounds });
      } catch (error) {
        console.error("Error getting recent rounds:", error);
        socket.emit("error", { message: "Failed to get recent rounds" });
      }
    });

    // Place a bet
    socket.on("place:bet", async (data) => {
      try {
        const { userId, roundId, chosenColor, amount } = data;

        if (!userId || !roundId || !chosenColor || !amount) {
          socket.emit("error", { message: "All fields are required" });
          return;
        }

        // Validate color
        if (!["red", "green", "blue"].includes(chosenColor)) {
          socket.emit("error", { message: "Invalid color choice" });
          return;
        }

        // Check if round exists and is active
        const gameRound = await GameRound.findById(roundId);
        if (!gameRound) {
          socket.emit("error", { message: "Game round not found" });
          return;
        }

        if (gameRound.status !== "active") {
          socket.emit("error", { message: "Round is not active for betting" });
          return;
        }

        // Check user wallet balance
        const wallet = await Wallet.findOne({ userId });
        if (!wallet || wallet.availableBalance < amount) {
          socket.emit("error", { message: "Insufficient balance" });
          return;
        }

        // Check if user already placed a bet in this round
        const existingBet = await Bet.findOne({
          userId,
          gameRoundId: roundId,
        });

        if (existingBet) {
          socket.emit("error", { message: "You have already placed a bet in this round" });
          return;
        }

        // Create bet
        const bet = new Bet({
          userId,
          gameRoundId: roundId,
          chosenColor,
          amount,
          status: "confirmed",
        });

        await bet.save();

        // Update wallet balance
        wallet.balance -= amount;
        wallet.lockedBalance += amount;
        await wallet.save();

        // Update game round total pool
        await GameRound.findByIdAndUpdate(roundId, {
          $inc: { totalPool: amount },
        });

        // Emit bet update to all clients
        emitBetUpdate(bet);

        // Emit success to the user
        socket.emit("bet:placed", {
          message: "Bet placed successfully",
          bet: {
            _id: bet._id,
            chosenColor: bet.chosenColor,
            amount: bet.amount,
            status: bet.status,
          },
        });

        console.log(`💰 Bet placed: ${userId} bet ${amount} on ${chosenColor} in round ${roundId}`);
      } catch (error) {
        console.error("Error placing bet:", error);
        socket.emit("error", { message: "Failed to place bet" });
      }
    });

    // Get user's bet history
    socket.on("get:bet-history", async (data) => {
      try {
        const { userId, page = 1, limit = 10 } = data;

        if (!userId) {
          socket.emit("error", { message: "User ID is required" });
          return;
        }

        const bets = await Bet.find({ userId })
          .populate("gameRoundId", "roundId resultColor startTime")
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Bet.countDocuments({ userId });

        socket.emit("bet:history", {
          bets,
          pagination: {
            current: parseInt(page),
            total: Math.ceil(total / parseInt(limit)),
            hasNext: parseInt(page) * parseInt(limit) < total,
          },
        });
      } catch (error) {
        console.error("Error getting bet history:", error);
        socket.emit("error", { message: "Failed to get bet history" });
      }
    });

    // Get wallet balance
    socket.on("get:wallet-balance", async (data) => {
      try {
        const { userId } = data;

        if (!userId) {
          socket.emit("error", { message: "User ID is required" });
          return;
        }

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) {
          socket.emit("error", { message: "Wallet not found" });
          return;
        }

        socket.emit("wallet:balance", {
          wallet: {
            balance: wallet.balance,
            lockedBalance: wallet.lockedBalance,
            availableBalance: wallet.availableBalance,
            totalDeposited: wallet.totalDeposited,
            totalWithdrawn: wallet.totalWithdrawn,
            totalWon: wallet.totalWon,
            totalLost: wallet.totalLost,
          },
        });
      } catch (error) {
        console.error("Error getting wallet balance:", error);
        socket.emit("error", { message: "Failed to get wallet balance" });
      }
    });

    // Handle disconnect
    socket.on("disconnect", async () => {
      try {
        if (socket.userId) {
          await User.findByIdAndUpdate(socket.userId, {
            isOnline: false,
            socketId: null,
          });
          console.log(`👤 User ${socket.userId} disconnected from game socket`);
        }
      } catch (error) {
        console.error("Error handling disconnect:", error);
      }
    });
  });

  // Monitor active rounds and emit updates
  setInterval(async () => {
    try {
      const activeRound = await GameRound.findOne({ status: "active" });
      
      if (activeRound) {
        const now = new Date();
        const timeLeft = Math.max(0, activeRound.endTime.getTime() - now.getTime());
        
        if (timeLeft <= 0) {
          // Round should be completed
          const resultColor = ["red", "green", "blue"][Math.floor(Math.random() * 3)];
          
          await GameRound.findByIdAndUpdate(activeRound._id, {
            status: "completed",
            resultColor,
            resultSeed: Math.random().toString(),
          });

          const updatedRound = await GameRound.findById(activeRound._id);
          emitRoundResult(updatedRound);
          
          console.log(`🎯 Round ${activeRound.roundId} completed with result: ${resultColor}`);
        } else {
          // Emit time update
          io.emit("round:time-update", {
            roundId: activeRound.roundId,
            timeLeft: Math.ceil(timeLeft / 1000), // seconds
          });
        }
      }
    } catch (error) {
      console.error("Error monitoring active rounds:", error);
    }
  }, 1000); // Check every second

  return {
    emitRoundUpdate,
    emitBetUpdate,
    emitRoundResult,
  };
};
