const Wallet = require("../models/wallet.model");
const User = require("../models/user.model");
const Transaction = require("../models/transaction.model");

// Get wallet balance
exports.getWalletBalance = async (req, res) => {
  try {
    const { userId } = req.user;

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    return res.status(200).json({
      wallet: {
        balance: wallet.balance,
        lockedBalance: wallet.lockedBalance,
        availableBalance: wallet.availableBalance,
        totalDeposited: wallet.totalDeposited,
        totalWithdrawn: wallet.totalWithdrawn,
        totalWon: wallet.totalWon,
        totalLost: wallet.totalLost,
        currency: wallet.currency,
        lastTransactionAt: wallet.lastTransactionAt,
      },
    });
  } catch (error) {
    console.error("Error getting wallet balance:", error);
    return res.status(500).json({ message: "Failed to get wallet balance" });
  }
};

// Get wallet statistics
exports.getWalletStats = async (req, res) => {
  try {
    const { userId } = req.user;
    const { period = "30" } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const stats = await Transaction.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const wallet = await Wallet.findOne({ userId });
    const user = await User.findById(userId);

    return res.status(200).json({
      stats: stats.reduce((acc, stat) => {
        acc[stat._id] = {
          totalAmount: stat.totalAmount,
          count: stat.count,
        };
        return acc;
      }, {}),
      wallet: {
        balance: wallet?.balance || 0,
        lockedBalance: wallet?.lockedBalance || 0,
        availableBalance: wallet?.availableBalance || 0,
        totalDeposited: wallet?.totalDeposited || 0,
        totalWithdrawn: wallet?.totalWithdrawn || 0,
        totalWon: wallet?.totalWon || 0,
        totalLost: wallet?.totalLost || 0,
      },
      user: {
        walletBalance: user?.walletBalance || 0,
        totalGamesPlayed: user?.totalGamesPlayed || 0,
        totalGamesWon: user?.totalGamesWon || 0,
        totalAmountWon: user?.totalAmountWon || 0,
      },
    });
  } catch (error) {
    console.error("Error getting wallet stats:", error);
    return res.status(500).json({ message: "Failed to get wallet statistics" });
  }
};

// Get recent transactions
exports.getRecentTransactions = async (req, res) => {
  try {
    const { userId } = req.user;
    const { limit = 5 } = req.query;

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select("type amount description createdAt status");

    return res.status(200).json({
      transactions,
    });
  } catch (error) {
    console.error("Error getting recent transactions:", error);
    return res.status(500).json({ message: "Failed to get recent transactions" });
  }
};

// Create wallet for user (admin function)
exports.createWallet = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const existingWallet = await Wallet.findOne({ userId });
    if (existingWallet) {
      return res.status(400).json({ message: "Wallet already exists for this user" });
    }

    const wallet = new Wallet({ userId });
    await wallet.save();

    return res.status(201).json({
      message: "Wallet created successfully",
      wallet: {
        _id: wallet._id,
        userId: wallet.userId,
        balance: wallet.balance,
        currency: wallet.currency,
      },
    });
  } catch (error) {
    console.error("Error creating wallet:", error);
    return res.status(500).json({ message: "Failed to create wallet" });
  }
};
