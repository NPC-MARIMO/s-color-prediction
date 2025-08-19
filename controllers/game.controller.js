const GameRound = require("../models/gameRound.model");
const Bet = require("../models/bet.model");
const User = require("../models/user.model");
const setupGameSocketHandlers = require("../sockets/game.socket");
const server = require("../index");

// Helper: Generate random color result
function generateResult(colors) {
  const randomIndex = Math.floor(Math.random() * colors.length);
  return colors[randomIndex];
}

function generateRandomNumber() {
  const randomNumber = Math.floor(Math.random() * 10)
  return randomNumber
}

// Get the socket emitters
let socketEmitters = null;
function refreshSocketEmitters() {
  socketEmitters = global.socketEmitters || null;
}

// Get the current active/betting round
exports.getCurrentRound = async (req, res) => {
  try {
    const round = await GameRound.findOne({
      status: { $in: ["betting", "spinning"] },
    }).sort({ startTime: -1 });
    if (!round) {
      return res.status(404).json({ message: "No active round" });
    }
    res.json({ round });
  } catch (error) {
    res.status(500).json({ message: "Failed to get current round" });
  }
};

// Get result for a round
exports.getRoundResult = async (req, res) => {
  try {
    const { roundId } = req.params;
    const round = await GameRound.findById(roundId);
    if (!round) return res.status(404).json({ message: "Round not found" });

    res.json({ resultColor: round.resultColor, resultNumber : round.resultNumber, resultSize : round.resultSize , status: round.status });
  } catch (error) {
    console.error("Error getting round result:", error);
    res.status(500).json({ message: "Failed to get round result" });
  }
};

// Get round history
exports.getRoundHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const rounds = await GameRound.find({ status: "completed" })
      .sort({ endTime: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    res.json({ rounds });
  } catch (error) {
    res.status(500).json({ message: "Failed to get round history" });
  }
};

// Admin/cron: Start a new round
exports.startNewRound = async (req, res) => {
  try {
    const roundsToDelete = await GameRound.find({
      totalBets: 0,
      status: { $in: ["completed", "cancelled"] },
    });
    const roundIdsToDelete = roundsToDelete.map((r) => r._id);
    const orphanedBetsResult = await Bet.deleteMany({
      gameRoundId: { $in: roundIdsToDelete },
    });
    console.log(`Deleted ${orphanedBetsResult.deletedCount} orphaned bets`);

    const deleteResult = await GameRound.deleteMany({
      totalBets: 0,
      status: { $in: ["completed", "cancelled"] },
    });
    console.log(`Deleted ${deleteResult.deletedCount} rounds with 0 totalBets`);

    await GameRound.updateMany(
      { status: { $in: ["betting", "spinning"] } },
      { $set: { status: "cancelled" } }
    );

    const now = new Date();
    const roundId = `ROUND_${now.getTime()}_${Math.random()
      .toString(36)
      .substr(2, 6)}`;
    const gameDuration = 30;
    const bettingDuration = 30;
    const colors = ["red", "green", "violet"];

    const round = new GameRound({
      roundId,
      startTime: now,
      endTime: new Date(now.getTime() + gameDuration * 1000),
      status: "betting",
      colors,
      gameDuration,
      bettingDuration,
    });

    await round.save();
    res.json({
      message: "New round started",
      round,
      cleanup: {
        deletedRounds: deleteResult.deletedCount,
        deletedOrphanedBets: orphanedBetsResult.deletedCount,
      },
    });
  } catch (error) {
    console.error("Error starting new round:", error);
    res.status(500).json({ message: "Failed to start new round" });
  }
};

// Admin/cron: Complete the current round
exports.completeCurrentRound = async (req, res) => {
  try {
    refreshSocketEmitters();
    const round = await GameRound.findOne({
      status: { $in: ["betting", "spinning"] },
    }).sort({ startTime: -1 });
    if (!round)
      return res.status(404).json({ message: "No active round to complete" });

    if (round.status === "betting") {
      round.status = "spinning";
      await round.save();
      refreshSocketEmitters();
      if (socketEmitters && socketEmitters.emitRoundUpdate) {
        socketEmitters.emitRoundUpdate(round);
      }

      setTimeout(async () => {
        try {
          const roundStillExists = await GameRound.findById(round._id);
          if (!roundStillExists) return;

          const resultNumber = generateRandomNumber();

          round.resultNumber = resultNumber;
          round.resultSize = resultNumber < 5 ? "small" : "big";
          round.resultColor = ['1', '3', '7', '9'].includes(resultNumber)
            ? "green"
            : ['2', '4', '6', '8'].includes(resultNumber)
            ? "red"
            : "violet";
          round.status = "completed";
          round.resultSeed = Math.random().toString();
          console.log(round.resultSeed)

          const bets = await Bet.find({ gameRoundId: round._id });
          let totalPool = 0;
          let winners = [];

          for (const bet of bets) {
            console.log(bet,'this is bet , hello', round,'this is round heyyy')
            totalPool += bet.amount;
            let isWinner = false;
            if (bet.chosenColor === round.resultColor) {
              isWinner = true;
            } 
            if (String(bet.chosenNumber) === String(round.resultNumber)) {
              isWinner = true;
            }
            if (bet.chosenSize === round.resultSize) {
              isWinner = true;
            }
            if (isWinner) {
              bet.isWinner = true;
              winners.push(bet);
            }
            bet.status = "confirmed";
            await bet.save();
          }

          round.totalPool = totalPool;
          round.totalBets = bets.length;
          round.totalWinners = winners.length;

          // Winner gets 2x their bet amount (including their original bet)
          for (const bet of winners) {
            bet.payoutAmount = bet.amount * 2;
            await bet.save();
            const user = await User.findById(bet.userId);
            if (user) {
              user.walletBalance += bet.amount * 2;
              // Update totalAmountWon and totalGamesWon
              user.totalAmountWon = (user.totalAmountWon || 0) + (bet.amount * 2);
              user.totalGamesWon = (user.totalGamesWon || 0) + 1;
              await user.save();
            }
          }

          await round.save();
          refreshSocketEmitters();
          if (socketEmitters && socketEmitters.emitRoundResult) {
            socketEmitters.emitRoundResult(round);
          }

          setTimeout(async () => {
            try {
              await exports.startNewRound(
                {},
                { json: () => {}, status: () => ({ json: () => {} }) }
              );
            } catch (startError) {
              console.error(
                "Error starting new round after completion phase:",
                startError
              );
            }
          }, 1000);
        } catch (error) {
          console.error("Error in round completion timeout:", error);
        }
      }, 1000);

      res.json({
        message: "Round is spinning, result will be sent after 30 seconds.",
      });
    } else if (round.status === "spinning") {
      res.json({ message: "Round is already spinning." });
    } else {
      res.json({ message: "Round is not in a state to be completed." });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to complete round" });
  }
};
