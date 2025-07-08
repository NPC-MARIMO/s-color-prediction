const GameRound = require("../models/gameRound.model");
const Bet = require("../models/bet.model");
const User = require("../models/user.model");
const Wallet = require("../models/wallet.model");
const Transaction = require("../models/transaction.model");

// Generate random color result
function generateResult() {
  const colors = ["red", "green", "blue"];
  const randomIndex = Math.floor(Math.random() * colors.length);
  return colors[randomIndex];
}

// Create a new game round
exports.createRound = async (req, res) => {
  try {
    const { duration = 60 } = req.body; // Duration in seconds
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 1000);
    const roundId = `ROUND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const gameRound = new GameRound({
      roundId,
      startTime,
      endTime,
      status: "pending",
    });

    await gameRound.save();

    // Schedule round activation
    setTimeout(async () => {
      try {
        await GameRound.findByIdAndUpdate(gameRound._id, { status: "active" });
        console.log(`Round ${roundId} is now active`);
      } catch (error) {
        console.error("Error activating round:", error);
      }
    }, 1000);

    // Schedule round completion
    setTimeout(async () => {
      try {
        const resultColor = generateResult();
        await GameRound.findByIdAndUpdate(gameRound._id, {
          status: "completed",
          resultColor,
          resultSeed: Math.random().toString(),
        });
        console.log(`Round ${roundId} completed with result: ${resultColor}`);
        
        // Process payouts
        await processPayouts(gameRound._id, resultColor);
      } catch (error) {
        console.error("Error completing round:", error);
      }
    }, (duration + 1) * 1000);

    return res.status(201).json({
      message: "Game round created successfully",
      round: {
        _id: gameRound._id,
        roundId: gameRound.roundId,
        startTime: gameRound.startTime,
        endTime: gameRound.endTime,
        status: gameRound.status,
      },
    });
  } catch (error) {
    console.error("Error creating round:", error);
    return res.status(500).json({ message: "Failed to create game round" });
  }
};

// Get current active round
exports.getCurrentRound = async (req, res) => {
  try {
    const currentRound = await GameRound.findOne({ status: "active" })
      .select("-bets")
      .sort({ createdAt: -1 });

    if (!currentRound) {
      return res.status(404).json({ message: "No active round found" });
    }

    return res.status(200).json({
      round: currentRound,
    });
  } catch (error) {
    console.error("Error getting current round:", error);
    return res.status(500).json({ message: "Failed to get current round" });
  }
};

// Get recent rounds
exports.getRecentRounds = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const rounds = await GameRound.find({ status: "completed" })
      .select("roundId resultColor startTime endTime totalPool")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    return res.status(200).json({
      rounds,
    });
  } catch (error) {
    console.error("Error getting recent rounds:", error);
    return res.status(500).json({ message: "Failed to get recent rounds" });
  }
};

// Place a bet
exports.placeBet = async (req, res) => {
  try {
    const { userId } = req.user;
    const { roundId, chosenColor, amount } = req.body;

    if (!roundId || !chosenColor || !amount) {
      return res.status(400).json({
        message: "Round ID, chosen color, and amount are required",
      });
    }

    if (!["red", "green", "blue"].includes(chosenColor)) {
      return res.status(400).json({
        message: "Invalid color. Choose from red, green, or blue",
      });
    }

    if (amount < 1) {
      return res.status(400).json({
        message: "Minimum bet amount is 1",
      });
    }

    // Check if round exists and is active
    const gameRound = await GameRound.findById(roundId);
    if (!gameRound) {
      return res.status(404).json({ message: "Game round not found" });
    }

    if (gameRound.status !== "active") {
      return res.status(400).json({ message: "Round is not active for betting" });
    }

    // Check user wallet balance
    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.availableBalance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Check if user already placed a bet in this round
    const existingBet = await Bet.findOne({
      userId,
      gameRoundId: roundId,
    });

    if (existingBet) {
      return res.status(400).json({ message: "You have already placed a bet in this round" });
    }

    // Create bet
    const bet = new Bet({
      userId,
      gameRoundId: roundId,
      chosenColor,
      amount,
      status: "confirmed",
    });

    await bet.save();

    // Update wallet balance
    wallet.balance -= amount;
    wallet.lockedBalance += amount;
    await wallet.save();

    // Create transaction record
    const transaction = new Transaction({
      userId,
      type: "bet",
      amount: -amount,
      netAmount: -amount,
      balanceBefore: wallet.balance + amount,
      balanceAfter: wallet.balance,
      description: `Bet placed on ${chosenColor} in round ${gameRound.roundId}`,
      betId: bet._id,
      gameRoundId: roundId,
      status: "completed",
    });

    await transaction.save();

    // Update game round total pool
    await GameRound.findByIdAndUpdate(roundId, {
      $inc: { totalPool: amount },
    });

    return res.status(201).json({
      message: "Bet placed successfully",
      bet: {
        _id: bet._id,
        chosenColor: bet.chosenColor,
        amount: bet.amount,
        status: bet.status,
      },
    });
  } catch (error) {
    console.error("Error placing bet:", error);
    return res.status(500).json({ message: "Failed to place bet" });
  }
};

// Get user's bet history
exports.getBetHistory = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10 } = req.query;

    const bets = await Bet.find({ userId })
      .populate("gameRoundId", "roundId resultColor startTime")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Bet.countDocuments({ userId });

    return res.status(200).json({
      bets,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasNext: parseInt(page) * parseInt(limit) < total,
      },
    });
  } catch (error) {
    console.error("Error getting bet history:", error);
    return res.status(500).json({ message: "Failed to get bet history" });
  }
};

// Process payouts for completed round
async function processPayouts(roundId, resultColor) {
  try {
    const gameRound = await GameRound.findById(roundId);
    if (!gameRound) return;

    const winningBets = await Bet.find({
      gameRoundId: roundId,
      chosenColor: resultColor,
      status: "confirmed",
    });

    for (const bet of winningBets) {
      const payoutAmount = bet.amount * bet.payoutRatio;
      
      // Update bet
      bet.isWinner = true;
      bet.payoutAmount = payoutAmount;
      bet.settledAt = new Date();
      await bet.save();

      // Update user wallet
      const wallet = await Wallet.findOne({ userId: bet.userId });
      if (wallet) {
        wallet.balance += payoutAmount;
        wallet.lockedBalance -= bet.amount;
        wallet.totalWon += payoutAmount;
        await wallet.save();

        // Create payout transaction
        const transaction = new Transaction({
          userId: bet.userId,
          type: "payout",
          amount: payoutAmount,
          netAmount: payoutAmount,
          balanceBefore: wallet.balance - payoutAmount,
          balanceAfter: wallet.balance,
          description: `Won ${payoutAmount} on bet in round ${gameRound.roundId}`,
          betId: bet._id,
          gameRoundId: roundId,
          status: "completed",
        });

        await transaction.save();
      }
    }

    // Process losing bets
    const losingBets = await Bet.find({
      gameRoundId: roundId,
      chosenColor: { $ne: resultColor },
      status: "confirmed",
    });

    for (const bet of losingBets) {
      // Update bet
      bet.isWinner = false;
      bet.payoutAmount = 0;
      bet.settledAt = new Date();
      await bet.save();

      // Update user wallet (unlock the amount)
      const wallet = await Wallet.findOne({ userId: bet.userId });
      if (wallet) {
        wallet.lockedBalance -= bet.amount;
        wallet.totalLost += bet.amount;
        await wallet.save();

        // Create loss transaction
        const transaction = new Transaction({
          userId: bet.userId,
          type: "bet",
          amount: -bet.amount,
          netAmount: -bet.amount,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance,
          description: `Lost ${bet.amount} on bet in round ${gameRound.roundId}`,
          betId: bet._id,
          gameRoundId: roundId,
          status: "completed",
        });

        await transaction.save();
      }
    }

    console.log(`Payouts processed for round ${gameRound.roundId}`);
  } catch (error) {
    console.error("Error processing payouts:", error);
  }
}
