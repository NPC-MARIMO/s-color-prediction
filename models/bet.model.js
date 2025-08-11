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

    // Optional fields (user may bet on any of these)
    chosenColor: {
      type: String,
      enum: ["red", "green", "purple"],
    },
    chosenNumber: {
      type: Number,
      enum: [...Array(10).keys()], // 0 to 9 as integers
    },
    chosenSize: {
      type: String,
      enum: ["big", "small"],
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
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "refunded", "settled"],
      default: "pending",
    },
    payoutRatio: {
      type: Number,
      default: 2, // 2x default payout
    },
    settledAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // gives createdAt and updatedAt automatically
  }
);

// Indexes for fast queries
betSchema.index({ userId: 1, gameRoundId: 1 });
betSchema.index({ status: 1 });
betSchema.index({ createdAt: -1 });

const Bet = mongoose.model("Bet", betSchema);
module.exports = Bet;
