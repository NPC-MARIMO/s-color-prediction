const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["deposit", "withdrawal", "bet", "payout", "refund", "bonus"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "pending",
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpayOrderId: {
      type: String,
    },
    razorpayRefundId: {
      type: String,
    },
    description: {
      type: String,
      required: true,
    },
    betId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bet",
    },
    gameRoundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameRound",
    },
    fee: {
      type: Number,
      default: 0,
    },
    netAmount: {
      type: Number,
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ razorpayPaymentId: 1 });
transactionSchema.index({ razorpayOrderId: 1 });

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
