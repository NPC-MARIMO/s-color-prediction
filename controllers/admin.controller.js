const User = require("../models/user.model");
const Transaction = require("../models/transaction.model");
const Bet = require("../models/bet.model");
const GameRound = require("../models/gameRound.model");

// ==================== USER MANAGEMENT ====================

// Get all users (admin)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, isBlocked, search } = req.query;

    const query = {};
    if (role) query.role = role;
    if (isBlocked !== undefined) query.isBlocked = isBlocked === 'true';
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { _id: search }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(query);

    return res.status(200).json({
      users,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasNext: parseInt(page) * parseInt(limit) < total,
        totalRecords: total,
      },
    });
  } catch (error) {
    console.error("Error getting all users:", error);
    return res.status(500).json({ message: "Failed to get users" });
  }
};

// Get user by ID (admin)
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user's recent transactions
    const recentTransactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Get user's recent bets
    const recentBets = await Bet.find({ userId })
      .populate('gameRoundId', 'roundId resultColor')
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json({
      user,
      recentTransactions,
      recentBets,
    });
  } catch (error) {
    console.error("Error getting user by ID:", error);
    return res.status(500).json({ message: "Failed to get user" });
  }
};

// Block/Unblock user (admin)
exports.toggleUserBlock = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    return res.status(200).json({
      message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`,
      user: {
        _id: user._id,
        email: user.email,
        isBlocked: user.isBlocked,
        role: user.role,
      },
      reason: reason || null,
    });
  } catch (error) {
    console.error("Error toggling user block:", error);
    return res.status(500).json({ message: "Failed to toggle user block" });
  }
};

// Update user role (admin)
exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be 'user' or 'admin'" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.role = role;
    await user.save();

    return res.status(200).json({
      message: "User role updated successfully",
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    return res.status(500).json({ message: "Failed to update user role" });
  }
};

// ==================== GAME SETTINGS ====================

// Get game settings (admin)
exports.getGameSettings = async (req, res) => {
  try {
    // Get current round to show settings
    const currentRound = await GameRound.findOne({ status: { $in: ['betting', 'spinning'] } })
      .sort({ startTime: -1 });

    const settings = {
      defaultGameDuration: 60, // seconds
      defaultBettingDuration: 30, // seconds
      defaultCommission: 0.05, // 5%
      minBetAmount: 1,
      maxBetAmount: 10000,
      colors: ['red', 'green', 'blue'],
      currentRound: currentRound ? {
        roundId: currentRound.roundId,
        status: currentRound.status,
        startTime: currentRound.startTime,
        endTime: currentRound.endTime,
      } : null,
    };

    return res.status(200).json({ settings });
  } catch (error) {
    console.error("Error getting game settings:", error);
    return res.status(500).json({ message: "Failed to get game settings" });
  }
};

// Update game settings (admin)
exports.updateGameSettings = async (req, res) => {
  try {
    const { gameDuration, bettingDuration, commission, minBetAmount, maxBetAmount } = req.body;

    // Validate settings
    if (gameDuration && (gameDuration < 30 || gameDuration > 300)) {
      return res.status(400).json({ message: "Game duration must be between 30 and 300 seconds" });
    }

    if (bettingDuration && (bettingDuration < 10 || bettingDuration > 120)) {
      return res.status(400).json({ message: "Betting duration must be between 10 and 120 seconds" });
    }

    if (commission && (commission < 0 || commission > 0.2)) {
      return res.status(400).json({ message: "Commission must be between 0 and 20%" });
    }

    // For now, we'll store settings in environment or config
    // In a real app, you'd store these in a database
    const updatedSettings = {
      gameDuration: gameDuration || 60,
      bettingDuration: bettingDuration || 30,
      commission: commission || 0.05,
      minBetAmount: minBetAmount || 1,
      maxBetAmount: maxBetAmount || 10000,
    };

    return res.status(200).json({
      message: "Game settings updated successfully",
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("Error updating game settings:", error);
    return res.status(500).json({ message: "Failed to update game settings" });
  }
};

// ==================== SYSTEM STATISTICS ====================

// Get system statistics (admin)
exports.getSystemStats = async (req, res) => {
  try {
    const { period = "30" } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // User statistics
    const totalUsers = await User.countDocuments();
    const newUsers = await User.countDocuments({ createdAt: { $gte: startDate } });
    const blockedUsers = await User.countDocuments({ isBlocked: true });
    const onlineUsers = await User.countDocuments({ isOnline: true });

    // Transaction statistics
    const totalTransactions = await Transaction.countDocuments({ createdAt: { $gte: startDate } });
    const totalDeposits = await Transaction.aggregate([
      { $match: { type: 'deposit', status: 'completed', createdAt: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalWithdrawals = await Transaction.aggregate([
      { $match: { type: 'withdrawal', status: 'completed', createdAt: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);

    // Game statistics
    const totalRounds = await GameRound.countDocuments({ createdAt: { $gte: startDate } });
    const totalBets = await Bet.countDocuments({ createdAt: { $gte: startDate } });
    const totalBetAmount = await Bet.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Revenue calculation
    const totalPayouts = await Bet.aggregate([
      { $match: { isWinner: true, createdAt: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: '$payoutAmount' } } }
    ]);

    const stats = {
      period: `${period} days`,
      users: {
        total: totalUsers,
        new: newUsers,
        blocked: blockedUsers,
        online: onlineUsers,
      },
      transactions: {
        total: totalTransactions,
        deposits: totalDeposits[0]?.total || 0,
        withdrawals: totalWithdrawals[0]?.total || 0,
      },
      games: {
        totalRounds,
        totalBets,
        totalBetAmount: totalBetAmount[0]?.total || 0,
        totalPayouts: totalPayouts[0]?.total || 0,
        revenue: (totalBetAmount[0]?.total || 0) - (totalPayouts[0]?.total || 0),
      },
    };

    return res.status(200).json({ stats });
  } catch (error) {
    console.error("Error getting system stats:", error);
    return res.status(500).json({ message: "Failed to get system statistics" });
  }
};

// ==================== MANUAL PAYOUTS ====================

// Get pending withdrawal requests (admin)
exports.getPendingWithdrawals = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const withdrawals = await Transaction.find({ 
      type: 'withdrawal', 
      status: 'pending' 
    })
      .populate('userId', 'email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Transaction.countDocuments({ 
      type: 'withdrawal', 
      status: 'pending' 
    });

    return res.status(200).json({
      withdrawals,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasNext: parseInt(page) * parseInt(limit) < total,
        totalRecords: total,
      },
    });
  } catch (error) {
    console.error("Error getting pending withdrawals:", error);
    return res.status(500).json({ message: "Failed to get pending withdrawals" });
  }
};

// Approve withdrawal request (admin)
exports.approveWithdrawal = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { notes } = req.body;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.type !== 'withdrawal') {
      return res.status(400).json({ message: "Transaction is not a withdrawal" });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ message: "Withdrawal is not pending" });
    }

    // Update transaction status
    transaction.status = 'completed';
    transaction.completedAt = new Date();
    transaction.metadata = { 
      ...transaction.metadata, 
      approvedBy: req.user._id,
      approvedAt: new Date(),
      notes: notes || 'Approved by admin'
    };
    await transaction.save();

    return res.status(200).json({
      message: "Withdrawal approved successfully",
      transaction: {
        _id: transaction._id,
        amount: Math.abs(transaction.amount),
        status: transaction.status,
        approvedAt: transaction.completedAt,
      },
    });
  } catch (error) {
    console.error("Error approving withdrawal:", error);
    return res.status(500).json({ message: "Failed to approve withdrawal" });
  }
};

// Reject withdrawal request (admin)
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.type !== 'withdrawal') {
      return res.status(400).json({ message: "Transaction is not a withdrawal" });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ message: "Withdrawal is not pending" });
    }

    // Refund the amount to user wallet
    const user = await User.findById(transaction.userId);
    if (user) {
      user.walletBalance += Math.abs(transaction.amount);
      await user.save();
    }

    // Update transaction status
    transaction.status = 'cancelled';
    transaction.metadata = { 
      ...transaction.metadata, 
      rejectedBy: req.user._id,
      rejectedAt: new Date(),
      reason: reason
    };
    await transaction.save();

    return res.status(200).json({
      message: "Withdrawal rejected successfully",
      transaction: {
        _id: transaction._id,
        amount: Math.abs(transaction.amount),
        status: transaction.status,
        reason: reason,
      },
    });
  } catch (error) {
    console.error("Error rejecting withdrawal:", error);
    return res.status(500).json({ message: "Failed to reject withdrawal" });
  }
};

// ==================== ADMIN DASHBOARD ====================

// Get admin dashboard data (admin)
exports.getDashboardData = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Today's statistics
    const todayUsers = await User.countDocuments({ createdAt: { $gte: today } });
    const todayTransactions = await Transaction.countDocuments({ createdAt: { $gte: today } });
    const todayBets = await Bet.countDocuments({ createdAt: { $gte: today } });
    const todayRevenue = await Transaction.aggregate([
      { $match: { type: 'deposit', status: 'completed', createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Recent activities
    const recentTransactions = await Transaction.find()
      .populate('userId', 'email')
      .sort({ createdAt: -1 })
      .limit(10);

    const recentBets = await Bet.find()
      .populate('userId', 'email')
      .populate('gameRoundId', 'roundId')
      .sort({ createdAt: -1 })
      .limit(10);

    const recentUsers = await User.find()
      .select('email createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    // Alerts (pending withdrawals, blocked users, etc.)
    const pendingWithdrawals = await Transaction.countDocuments({ 
      type: 'withdrawal', 
      status: 'pending' 
    });
    const blockedUsers = await User.countDocuments({ isBlocked: true });

    const dashboard = {
      today: {
        newUsers: todayUsers,
        transactions: todayTransactions,
        bets: todayBets,
        revenue: todayRevenue[0]?.total || 0,
      },
      recent: {
        transactions: recentTransactions,
        bets: recentBets,
        users: recentUsers,
      },
      alerts: {
        pendingWithdrawals,
        blockedUsers,
      },
    };

    return res.status(200).json({ dashboard });
  } catch (error) {
    console.error("Error getting dashboard data:", error);
    return res.status(500).json({ message: "Failed to get dashboard data" });
  }
};

module.exports = exports; 