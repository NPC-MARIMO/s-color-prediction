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
      enum: ["betting", "spinning", "completed", "cancelled"],
      default: "betting",
    },
    colors: {
      type: [String],
      default: ["red", "green", "blue", "purple", "yellow"],
    },
    resultColor: {
      type: String,
      default: null,
    },
    totalPool: {
      type: Number,
      default: 0,
    },
    commission: {
      type: Number,
      default: 0.05, // 5% commission
    },
    resultSeed: {
      type: String,
      default: null,
    },
    gameDuration: {
      type: Number,
      default: 60, // seconds
    },
    bettingDuration: {
      type: Number,
      default: 30, // seconds for betting phase
    },
    totalBets: {
      type: Number,
      default: 0,
    },
    totalWinners: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
gameRoundSchema.index({ status: 1, createdAt: -1 });
gameRoundSchema.index({ roundId: 1 });

const GameRound = mongoose.model("GameRound", gameRoundSchema);
module.exports = GameRound;
