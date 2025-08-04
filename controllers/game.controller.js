const GameRound = require("../models/gameRound.model");
const Bet = require("../models/bet.model");
const User = require("../models/user.model");
const setupGameSocketHandlers = require("../sockets/game.socket");
const server = require("../index");

// Helper: Generate random color result
function generateResult(colors) {
  const randomIndex = Math.floor(Math.random() * colors.length);
  return colors[randomIndex];
}

// Get the socket emitters
let socketEmitters = null;
function refreshSocketEmitters() {
  socketEmitters = global.socketEmitters || null;
}

// Get the current active/betting round
exports.getCurrentRound = async (req, res) => {
  try {
    const round = await GameRound.findOne({
      status: { $in: ["betting", "spinning"] },
    }).sort({ startTime: -1 });
    if (!round) {
      return res.status(404).json({ message: "No active round" });
    }
    res.json({ round });
  } catch (error) {
    res.status(500).json({ message: "Failed to get current round" });
  }
};

// Get result for a round
exports.getRoundResult = async (req, res) => {
  try {
    const { roundId } = req.params;
    const round = await GameRound.findById(roundId);
    if (!round) return res.status(404).json({ message: "Round not found" });
    
    res.json({ resultColor: round.resultColor, status: round.status });
  } catch (error) {
    console.error("Error getting round result:", error);
    res.status(500).json({ message: "Failed to get round result" });
  }
};

// Get round history
exports.getRoundHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const rounds = await GameRound.find({ status: "completed" })
      .sort({ endTime: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    res.json({ rounds });
  } catch (error) {
    res.status(500).json({ message: "Failed to get round history" });
  }
};

// Admin/cron: Start a new round
exports.startNewRound = async (req, res) => {
  try {
    // Only delete rounds with 0 totalBets and status completed or cancelled
    const roundsToDelete = await GameRound.find({ totalBets: 0, status: { $in: ["completed", "cancelled"] } });
    const roundIdsToDelete = roundsToDelete.map(r => r._id);
    // Delete orphaned bets first (bets that reference rounds we're about to delete)
    const orphanedBetsResult = await Bet.deleteMany({
      gameRoundId: { $in: roundIdsToDelete }
    });
    console.log(`Deleted ${orphanedBetsResult.deletedCount} orphaned bets`);
    // Now delete the rounds with 0 totalBets and completed/cancelled status
    const deleteResult = await GameRound.deleteMany({ totalBets: 0, status: { $in: ["completed", "cancelled"] } });
    console.log(`Deleted ${deleteResult.deletedCount} rounds with 0 totalBets`);
    // End any previous round if still open
    await GameRound.updateMany(
      { status: { $in: ["betting", "spinning"] } },
      { $set: { status: "cancelled" } }
    );
    
    // Create new round
    const now = new Date();
    const roundId = `ROUND_${now.getTime()}_${Math.random().toString(36).substr(2, 6)}`;
    const gameDuration = 60; // seconds
    const bettingDuration = 30; // seconds
    const colors = ["red", "green", "blue", "purple", "yellow"];
    const round = new GameRound({
      roundId,
      startTime: now,
      endTime: new Date(now.getTime() + gameDuration * 1000),
      status: "betting",
      colors,
      gameDuration,
      bettingDuration,
    });
    await round.save();
    res.json({ 
      message: "New round started", 
      round,
      cleanup: {
        deletedRounds: deleteResult.deletedCount,
        deletedOrphanedBets: orphanedBetsResult.deletedCount
      }
    });
  } catch (error) {
    console.error("Error starting new round:", error);
    res.status(500).json({ message: "Failed to start new round" });
  }
};

// Admin/cron: Complete the current round, spin the wheel, resolve bets
exports.completeCurrentRound = async (req, res) => {
  try {
    refreshSocketEmitters();
    const round = await GameRound.findOne({ status: { $in: ["betting", "spinning"] } }).sort({ startTime: -1 });
    if (!round) return res.status(404).json({ message: "No active round to complete" });
    if (round.status === "betting") {
      // Set to spinning phase and emit update
      round.status = "spinning";
      await round.save();
      refreshSocketEmitters();
      console.log("🔄 Round status changed to spinning, emitting update...");
      if (socketEmitters && socketEmitters.emitRoundUpdate) {
        socketEmitters.emitRoundUpdate(round);
        console.log("✅ Round update emitted successfully");
      } else {
        console.log("❌ Socket emitters not available");
      }
      // Wait for spinning duration (30 seconds)
      setTimeout(async () => {
        try {
          // Check if the round still exists before processing
          const roundStillExists = await GameRound.findById(round._id);
          if (!roundStillExists) {
            console.log("Round was deleted during processing, skipping completion");
            return;
          }
          // Generate result
          const resultColor = generateResult(round.colors);
          round.resultColor = resultColor;
          round.status = "completed";
          round.resultSeed = Math.random().toString();
          // Get all bets for this round
          const bets = await Bet.find({ gameRoundId: round._id });
          let totalPool = 0;
          let winners = [];
          for (const bet of bets) {
            totalPool += bet.amount;
            if (bet.chosenColor === resultColor) {
              bet.isWinner = true;
              winners.push(bet);
            }
            bet.status = "confirmed";
            await bet.save();
          }
          round.totalPool = totalPool;
          round.totalBets = bets.length; // Update totalBets from actual bets
          round.totalWinners = winners.length;
          // Payout
          const commission = round.commission || 0.05;
          const prizePool = totalPool - totalPool * commission;
          const prizePerWinner = winners.length > 0 ? prizePool / winners.length : 0;
          for (const bet of winners) {
            bet.payoutAmount = prizePerWinner;
            await bet.save();
            // Update user wallet
            const user = await User.findById(bet.userId);
            if (user) {
              user.walletBalance += prizePerWinner;
              await user.save();
            }
          }
          await round.save();
          refreshSocketEmitters();
          // Emit round result to all clients
          if (socketEmitters && socketEmitters.emitRoundResult) {
            socketEmitters.emitRoundResult(round);
          }
          // Wait for completed duration (30 seconds) before starting new round
          setTimeout(async () => {
            try {
              await exports.startNewRound({},{json:()=>{},status:()=>({json:()=>{}})});
            } catch (startError) {
              console.error("Error starting new round after completion phase:", startError);
            }
          }, 30000); // 30 seconds for completed phase
        } catch (error) {
          console.error("Error in round completion timeout:", error);
        }
      }, 30000); // 30 seconds for spinning phase
      res.json({ message: "Round is spinning, result will be sent after 30 seconds." });
    } else if (round.status === "spinning") {
      // If already spinning, do nothing or handle as needed
      res.json({ message: "Round is already spinning." });
    } else {
      res.json({ message: "Round is not in a state to be completed." });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to complete round" });
  }
};
