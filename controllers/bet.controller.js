const mongoose = require("mongoose");
const Bet = require("../models/bet.model");
const GameRound = require("../models/gameRound.model");
const User = require("../models/user.model");

// Place a bet on the current round
exports.placeBetOnCurrentRound = async (req, res) => {
  try {
    const { _id } = req.user;
    const { chosenColor, chosenNumber, chosenSize, amount } = req.body;

    console.log(`[placeBetOnCurrentRound] User: ${_id}, Body:`, req.body);

    if (!amount || amount < 1) {
      console.log(`[placeBetOnCurrentRound] Invalid bet amount: ${amount}`);
      return res.status(400).json({ message: "Invalid bet amount" });
    }

    if (!chosenColor && !chosenNumber && !chosenSize) {
      console.log(`[placeBetOnCurrentRound] No prediction type chosen`);
      return res
        .status(400)
        .json({
          message:
            "You must choose at least one type of prediction (color, number, or size)",
        });
    }

    // Validate each input if present
    const validColors = ["red", "green", "violet"];
    const validNumbers = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    const validSizes = ["big", "small"];

    if (chosenColor && !validColors.includes(chosenColor)) {
      console.log(`[placeBetOnCurrentRound] Invalid color choice: ${chosenColor}`);
      return res.status(400).json({ message: "Invalid color choice" });
    }
    if (chosenNumber && !validNumbers.includes(chosenNumber)) {
      console.log(`[placeBetOnCurrentRound] Invalid number choice: ${chosenNumber}`);
      return res.status(400).json({ message: "Invalid number choice" });
    }
    if (chosenSize && !validSizes.includes(chosenSize)) {
      console.log(`[placeBetOnCurrentRound] Invalid size choice: ${chosenSize}`);
      return res.status(400).json({ message: "Invalid size choice" });
    }

    // Find the current active game round
    const round = await GameRound.findOne({ status: "betting" }).sort({
      startTime: -1,
    });
    if (!round) {
      console.log(`[placeBetOnCurrentRound] No active round for betting`);
      return res.status(400).json({ message: "No active round for betting" });
    }
    console.log(`[placeBetOnCurrentRound] Found round: ${round._id}`);

    // Check if user already placed a bet for this round
    const existingBet = await Bet.findOne({
      userId: _id,
      gameRoundId: round._id,
    });
    if (existingBet) {
      console.log(`[placeBetOnCurrentRound] User ${_id} already placed a bet for round ${round._id}`);
      return res
        .status(400)
        .json({ message: "You have already placed a bet for this round" });
    }

    // Check user wallet balance
    const user = await User.findById(_id);
    if (!user || user.walletBalance < amount) {
      console.log(`[placeBetOnCurrentRound] Insufficient balance for user ${_id}. Wallet: ${user ? user.walletBalance : 'N/A'}, Bet: ${amount}`);
      return res.status(400).json({ message: "Insufficient balance" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const roundExists = await GameRound.findById(round._id).session(session);
      if (!roundExists) {
        console.log(`[placeBetOnCurrentRound] Round ${round._id} no longer exists`);
        await session.abortTransaction();
        return res.status(400).json({ message: "Round no longer exists" });
      }

      // Deduct amount from wallet
      user.walletBalance -= amount;
      await user.save({ session });
      console.log(`[placeBetOnCurrentRound] Deducted ${amount} from user ${_id}. New balance: ${user.walletBalance}`);

      // Update round stats
      const wasFirstBet = round.totalBets === 0;
      round.totalBets += 1;
      round.totalPool += amount;
      if (wasFirstBet) {
        round.endTime = new Date(Date.now() + 30 * 1000); // Start 1-min countdown
        console.log(`[placeBetOnCurrentRound] First bet for round ${round._id}. New endTime: ${round.endTime}`);
      }
      await round.save({ session });
      console.log(`[placeBetOnCurrentRound] Updated round stats. totalBets: ${round.totalBets}, totalPool: ${round.totalPool}`);

      // Create bet
      const bet = new Bet({
        userId: _id,
        gameRoundId: round._id,
        chosenColor,
        chosenNumber,
        chosenSize,
        amount,
        status: "confirmed",
      });
      await bet.save({ session });
      console.log(`[placeBetOnCurrentRound] Created bet: ${bet._id}`);

      await session.commitTransaction();
      session.endSession();
      console.log(`[placeBetOnCurrentRound] Transaction committed for user ${_id}, bet ${bet._id}`);

      // Emit updated round
      if (global.socketEmitters && global.socketEmitters.emitRoundUpdate) {
        const updatedRound = await GameRound.findById(round._id);
        global.socketEmitters.emitRoundUpdate(updatedRound);
        console.log(`[placeBetOnCurrentRound] Emitted round update for round ${round._id}`);
      }

      return res.json({
        message: "Bet placed successfully",
        bet,
        roundStats: {
          totalBets: round.totalBets,
          totalPool: round.totalPool,
          totalWinners: round.totalWinners || 0,
        },
      });
    } catch (err) {
      console.error(`[placeBetOnCurrentRound] Error in transaction:`, err);
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error("Error placing bet:", error);
    res.status(500).json({ message: "Failed to place bet" });
  }
};

// Get all bets (admin)
exports.getAllBets = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, userId, gameRoundId } = req.query;

    const query = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;
    if (gameRoundId) query.gameRoundId = gameRoundId;

    const bets = await Bet.find(query)
      .populate("userId", "email")
      .populate("gameRoundId", "roundId resultColor startTime")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Bet.countDocuments(query);

    return res.status(200).json({
      bets,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasNext: parseInt(page) * parseInt(limit) < total,
        totalRecords: total,
      },
    });
  } catch (error) {
    console.error("Error getting all bets:", error);
    return res.status(500).json({ message: "Failed to get bets" });
  }
};

// Get bet by ID
exports.getBetById = async (req, res) => {
  try {
    const { betId } = req.params;

    const bet = await Bet.findById(betId)
      .populate("userId", "email")
      .populate("gameRoundId", "roundId resultColor startTime endTime status");

    if (!bet) {
      return res.status(404).json({ message: "Bet not found" });
    }

    return res.status(200).json({
      bet,
    });
  } catch (error) {
    console.error("Error getting bet by ID:", error);
    return res.status(500).json({ message: "Failed to get bet" });
  }
};

// Get bet statistics
exports.getBetStats = async (req, res) => {
  try {
    const { period = "30" } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const stats = await Bet.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            status: "$status",
            isWinner: "$isWinner",
          },
          totalAmount: { $sum: "$amount" },
          totalPayout: { $sum: "$payoutAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const colorStats = await Bet.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$chosenColor",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          wins: {
            $sum: {
              $cond: [{ $eq: ["$isWinner", true] }, 1, 0],
            },
          },
        },
      },
    ]);

    const totalStats = await Bet.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalBets: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          totalPayout: { $sum: "$payoutAmount" },
          avgAmount: { $avg: "$amount" },
        },
      },
    ]);

    return res.status(200).json({
      period: `${period} days`,
      stats: stats.reduce((acc, stat) => {
        const key = `${stat._id.status}_${stat._id.isWinner}`;
        acc[key] = {
          status: stat._id.status,
          isWinner: stat._id.isWinner,
          totalAmount: stat.totalAmount,
          totalPayout: stat.totalPayout,
          count: stat.count,
        };
        return acc;
      }, {}),
      colorStats: colorStats.reduce((acc, stat) => {
        acc[stat._id] = {
          color: stat._id,
          totalAmount: stat.totalAmount,
          count: stat.count,
          wins: stat.wins,
          winRate: stat.count > 0 ? (stat.wins / stat.count) * 100 : 0,
        };
        return acc;
      }, {}),
      totals: totalStats[0] || {
        totalBets: 0,
        totalAmount: 0,
        totalPayout: 0,
        avgAmount: 0,
      },
    });
  } catch (error) {
    console.error("Error getting bet stats:", error);
    return res.status(500).json({ message: "Failed to get bet statistics" });
  }
};

// Cancel bet (admin)
exports.cancelBet = async (req, res) => {
  try {
    const { betId } = req.params;
    const { reason } = req.body;

    const bet = await Bet.findById(betId);
    if (!bet) {
      return res.status(404).json({ message: "Bet not found" });
    }

    if (bet.status !== "confirmed") {
      return res.status(400).json({ message: "Only confirmed bets can be cancelled" });
    }

    // Update bet status
    bet.status = "cancelled";
    bet.metadata = { ...bet.metadata, cancelledAt: new Date(), reason: reason };
    await bet.save();

    // Refund the amount to user wallet
    const user = await User.findById(bet.userId);
    if (user) {
      user.walletBalance += bet.amount;
      await user.save();
    }

    // Create refund transaction
    const Transaction = require("../models/transaction.model");
    const transaction = new Transaction({
      userId: bet.userId,
      type: "refund",
      amount: bet.amount,
      netAmount: bet.amount,
      balanceBefore: user.walletBalance - bet.amount,
      balanceAfter: user.walletBalance,
      description: `Bet cancelled - ${reason || "Admin cancellation"}`,
      betId: bet._id,
      gameRoundId: bet.gameRoundId,
      status: "completed",
      metadata: {
        reason: reason,
        betId: bet._id,
      },
    });

    await transaction.save();

    return res.status(200).json({
      message: "Bet cancelled successfully",
      bet: {
        _id: bet._id,
        status: bet.status,
        refundedAmount: bet.amount,
      },
    });
  } catch (error) {
    console.error("Error cancelling bet:", error);
    return res.status(500).json({ message: "Failed to cancel bet" });
  }
};

// Get bets for a specific round
exports.getBetsByRound = async (req, res) => {
  try {
    const { roundId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const bets = await Bet.find({ gameRoundId: roundId })
      .populate("userId", "email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Bet.countDocuments({ gameRoundId: roundId });

    const roundStats = await Bet.aggregate([
      {
        $match: { gameRoundId: roundId },
      },
      {
        $group: {
          _id: "$chosenColor",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    return res.status(200).json({
      bets,
      roundStats: roundStats.reduce((acc, stat) => {
        acc[stat._id] = {
          color: stat._id,
          totalAmount: stat.totalAmount,
          count: stat.count,
        };
        return acc;
      }, {}),
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasNext: parseInt(page) * parseInt(limit) < total,
        totalRecords: total,
      },
    });
  } catch (error) {
    console.error("Error getting bets by round:", error);
    return res.status(500).json({ message: "Failed to get bets for round" });
  }
};
