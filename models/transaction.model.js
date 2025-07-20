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
    cashfreeOrderId: {
      type: String,
    },
    cashfreePaymentId: {
      type: String,
    },
    cashfreePaymentId: {
      type: String,
    },
    cashfreeOrderId: {
      type: String,
    },
    cashfreeRefundId: {
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
transactionSchema.index({ cashfreePaymentId: 1 });
transactionSchema.index({ cashfreeOrderId: 1 });

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
