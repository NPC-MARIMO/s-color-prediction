const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },

  password: {
    type: String,
    required: true,
  },    

  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },

  isBlocked: {
    type: Boolean,
    default: false,
  },

  isKYCVerified: {
    type: Boolean,
    default: false,
  },

  walletBalance: {
    type: Number,
    default: 151,
  },

  lockedBalance: {
    type: Number,
    default: 0,
  },

  totalDeposited: {
    type: Number,
    default: 0,
  },

  totalWithdrawn: {
    type: Number,
    default: 0,
  },

  cashfreeCustomerId: {
    type: String,
  },

  totalGamesPlayed: {
    type: Number,
    default: 0,
  },

  totalGamesWon: {
    type: Number,
    default: 0,
  },

  totalAmountWon: {
    type: Number,
    default: 0,
  },

  bankDetails: {
    accountHolderName: String,
    accountNumber: String,
    ifsc: String,
    upiId: String,
  },

  isOnline: {
    type: Boolean,
    default: false,
  },

  socketId: {
    type: String,
    default: null,
  },

  // 🕐 Metadata
  createdAt: {
    type: Date,
    default: Date.now,
  },

  lastLogin: {
    type: Date,
  },
});
const User = mongoose.model("User", userSchema);
module.exports = User;