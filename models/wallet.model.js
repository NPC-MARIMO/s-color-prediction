const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockedBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDeposited: {
      type: Number,
      default: 0,
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
    },
    totalWon: {
      type: Number,
      default: 0,
    },
    totalLost: {
      type: Number,
      default: 0,
    },
    lastTransactionAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for available balance
walletSchema.virtual("availableBalance").get(function () {
  return this.balance - this.lockedBalance;
});

// Ensure virtual fields are serialized
walletSchema.set("toJSON", { virtuals: true });
walletSchema.set("toObject", { virtuals: true });

// Index for better query performance
walletSchema.index({ userId: 1 });
walletSchema.index({ balance: -1 });

const Wallet = mongoose.model("Wallet", walletSchema);
module.exports = Wallet;
