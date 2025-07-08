// models/gameRound.model.js
const mongoose = require("mongoose");

const gameRoundSchema = new mongoose.Schema(
  {
    roundId: {
      type: String,
      required: true,
      unique: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "completed", "cancelled"],
      default: "pending",
    },
    colors: {
      type: [String],
      default: ["red", "green", "blue"],
    },
    resultColor: {
      type: String,
      default: null,
    },
    bets: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        chosenColor: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
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
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    totalPool: {
      type: Number,
      default: 0,
    },
    commission: {
      type: Number,
      default: 0,
    },
    resultSeed: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const GameRound = mongoose.model("GameRound", gameRoundSchema);
module.exports = GameRound;
