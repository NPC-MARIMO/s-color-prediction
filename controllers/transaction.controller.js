const Transaction = require("../models/transaction.model");
const User = require("../models/user.model");
const Wallet = require("../models/wallet.model");

// Get all transactions (admin)
exports.getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, userId } = req.query;

    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (userId) query.userId = userId;

    const transactions = await Transaction.find(query)
      .populate("userId", "email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Transaction.countDocuments(query);

    return res.status(200).json({
      transactions,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasNext: parseInt(page) * parseInt(limit) < total,
        totalRecords: total,
      },
    });
  } catch (error) {
    console.error("Error getting all transactions:", error);
    return res.status(500).json({ message: "Failed to get transactions" });
  }
};

// Get transaction by ID
exports.getTransactionById = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId)
      .populate("userId", "email")
      .populate("betId", "chosenColor amount")
      .populate("gameRoundId", "roundId resultColor");

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    return res.status(200).json({
      transaction,
    });
  } catch (error) {
    console.error("Error getting transaction by ID:", error);
    return res.status(500).json({ message: "Failed to get transaction" });
  }
};

// Update transaction status (admin)
exports.updateTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status, notes } = req.body;

    if (!status || !["pending", "completed", "failed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Valid status is required" });
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    transaction.status = status;
    if (notes) {
      transaction.metadata = { ...transaction.metadata, adminNotes: notes };
    }

    if (status === "completed" && !transaction.completedAt) {
      transaction.completedAt = new Date();
    }

    await transaction.save();

    return res.status(200).json({
      message: "Transaction status updated successfully",
      transaction: {
        _id: transaction._id,
        status: transaction.status,
        completedAt: transaction.completedAt,
      },
    });
  } catch (error) {
    console.error("Error updating transaction status:", error);
    return res.status(500).json({ message: "Failed to update transaction status" });
  }
};

// Get transaction statistics (admin)
exports.getTransactionStats = async (req, res) => {
  try {
    const { period = "30" } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const stats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            type: "$type",
            status: "$status",
          },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalStats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          avgAmount: { $avg: "$amount" },
        },
      },
    ]);

    return res.status(200).json({
      period: `${period} days`,
      stats: stats.reduce((acc, stat) => {
        const key = `${stat._id.type}_${stat._id.status}`;
        acc[key] = {
          type: stat._id.type,
          status: stat._id.status,
          totalAmount: stat.totalAmount,
          count: stat.count,
        };
        return acc;
      }, {}),
      totals: totalStats[0] || {
        totalTransactions: 0,
        totalAmount: 0,
        avgAmount: 0,
      },
    });
  } catch (error) {
    console.error("Error getting transaction stats:", error);
    return res.status(500).json({ message: "Failed to get transaction statistics" });
  }
};

// Refund transaction (admin)
exports.refundTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { reason } = req.body;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.status !== "completed") {
      return res.status(400).json({ message: "Only completed transactions can be refunded" });
    }

    // Create refund transaction
    const refundTransaction = new Transaction({
      userId: transaction.userId,
      type: "refund",
      amount: Math.abs(transaction.amount), // Make it positive
      netAmount: Math.abs(transaction.amount),
      balanceBefore: transaction.balanceAfter,
      balanceAfter: transaction.balanceAfter + Math.abs(transaction.amount),
      description: `Refund for transaction ${transaction._id} - ${reason || "Admin refund"}`,
      status: "completed",
      metadata: {
        originalTransactionId: transaction._id,
        reason: reason,
      },
    });

    await refundTransaction.save();

    // Update user wallet
    const wallet = await Wallet.findOne({ userId: transaction.userId });
    if (wallet) {
      wallet.balance += Math.abs(transaction.amount);
      wallet.lastTransactionAt = new Date();
      await wallet.save();
    }

    // Update user model
    await User.findByIdAndUpdate(transaction.userId, {
      $inc: { walletBalance: Math.abs(transaction.amount) },
    });

    // Mark original transaction as refunded
    transaction.status = "refunded";
    transaction.metadata = { ...transaction.metadata, refundedAt: new Date() };
    await transaction.save();

    return res.status(200).json({
      message: "Transaction refunded successfully",
      refund: {
        _id: refundTransaction._id,
        amount: refundTransaction.amount,
        status: refundTransaction.status,
      },
    });
  } catch (error) {
    console.error("Error refunding transaction:", error);
    return res.status(500).json({ message: "Failed to refund transaction" });
  }
};
