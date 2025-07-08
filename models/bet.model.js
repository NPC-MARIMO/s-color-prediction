const mongoose = require("mongoose");

const betSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    gameRoundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameRound",
      required: true,
    },
    chosenColor: {
      type: String,
      required: true,
      enum: ["red", "green", "blue"],
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    isWinner: {
      type: Boolean,
      default: false,
    },
    payoutAmount: {
      type: Number,
      default: 0,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpayOrderId: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "refunded"],
      default: "pending",
    },
    payoutRatio: {
      type: Number,
      default: 2, // 2x for correct prediction
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    settledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
betSchema.index({ userId: 1, gameRoundId: 1 });
betSchema.index({ status: 1 });
betSchema.index({ createdAt: -1 });

const Bet = mongoose.model("Bet", betSchema);
module.exports = Bet;
