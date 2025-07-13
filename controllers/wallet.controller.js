const User = require("../models/user.model");
const Transaction = require("../models/transaction.model");

// Get wallet balance
exports.getWalletBalance = async (req, res) => {
  try {
    const { _id } = req.user;
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({
      wallet: {
        balance: user.walletBalance,
        // Optionally add other fields if you want
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
    const { _id } = req.user;
    const { period = "30" } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const stats = await Transaction.aggregate([
      {
        $match: {
          _id: _id,
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

    const user = await User.findById(_id);

    return res.status(200).json({
      stats: stats.reduce((acc, stat) => {
        acc[stat._id] = {
          totalAmount: stat.totalAmount,
          count: stat.count,
        };
        return acc;
      }, {}),
      wallet: {
        balance: user?.walletBalance || 0,
        lockedBalance: user?.lockedBalance || 0,
        availableBalance: user?.availableBalance || 0,
        totalDeposited: user?.totalDeposited || 0,
        totalWithdrawn: user?.totalWithdrawn || 0,
        totalWon: user?.totalWon || 0,
        totalLost: user?.totalLost || 0,
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
    const { _id } = req.user;
    const { limit = 5 } = req.query;

    const transactions = await Transaction.find({ _id })
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
    const { _id } = req.body;

    if (!_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // The Wallet model is removed, so we directly update the user's walletBalance
    user.walletBalance = 0; // Initialize wallet balance
    user.lockedBalance = 0;
    user.availableBalance = 0;
    user.totalDeposited = 0;
    user.totalWithdrawn = 0;
    user.totalWon = 0;
    user.totalLost = 0;

    await user.save();

    return res.status(201).json({
      message: "Wallet created successfully",
      wallet: {
        _id: user._id,
        _id: user.id,
        balance: user.walletBalance,
        currency: "USD", // Assuming a default currency
      },
    });
  } catch (error) {
    console.error("Error creating wallet:", error);
    return res.status(500).json({ message: "Failed to create wallet" });
  }
};
