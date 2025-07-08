const Bet = require("../models/bet.model");
const GameRound = require("../models/gameRound.model");
const User = require("../models/user.model");

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
    const User = require("../models/user.model");
    const Wallet = require("../models/wallet.model");

    const wallet = await Wallet.findOne({ userId: bet.userId });
    if (wallet) {
      wallet.balance += bet.amount;
      wallet.lockedBalance -= bet.amount;
      await wallet.save();
    }

    // Update user model
    await User.findByIdAndUpdate(bet.userId, {
      $inc: { walletBalance: bet.amount },
    });

    // Create refund transaction
    const Transaction = require("../models/transaction.model");
    const transaction = new Transaction({
      userId: bet.userId,
      type: "refund",
      amount: bet.amount,
      netAmount: bet.amount,
      balanceBefore: wallet.balance - bet.amount,
      balanceAfter: wallet.balance,
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
