const GameRound = require("../models/gameRound.model");
const Bet = require("../models/bet.model");

module.exports = function setupGameSocketHandlers(io) {
  // Emit round update to all clients
  function emitRoundUpdate(round) {
    console.log("📡 Emitting round:update event:", {
      roundId: round.roundId,
      status: round.status,
      totalPool: round.totalPool
    });
    io.emit("round:update", {
      roundId: round.roundId,
      status: round.status,
      startTime: round.startTime,
      endTime: round.endTime,
      colors: round.colors,
      totalPool: round.totalPool,
      totalWinners: round.totalWinners,
      resultColor: round.resultColor,
    });
  }

  // Emit bet placed event
  function emitBetPlaced(bet) {
    io.emit("bet:placed", {
      userId: bet.userId,
      roundId: bet.gameRoundId,
      chosenColor: bet.chosenColor,
      amount: bet.amount,
      timestamp: bet.createdAt,
    });
  }

  // Emit round result event
  function emitRoundResult(round) {
    io.emit("round:result", {
      roundId: round.roundId,
      resultColor: round.resultColor,
      totalPool: round.totalPool,
      totalWinners: round.totalWinners,
    });
  }

  io.on("connection", (socket) => {
    console.log(`🎮 Game socket connected: ${socket.id}`);

    // Client requests current round
    socket.on("round:get", async () => {
      console.log(`📡 Client ${socket.id} requested current round`);
      const round = await GameRound.findOne({ status: { $in: ["betting", "spinning"] } }).sort({ startTime: -1 });
      if (round) {
        console.log(`📡 Sending current round to client ${socket.id}:`, round.status);
        socket.emit("round:update", {
          roundId: round.roundId,
          status: round.status,
          startTime: round.startTime,
          endTime: round.endTime,
          colors: round.colors,
          totalPool: round.totalPool,
          totalWinners: round.totalWinners,
          resultColor: round.resultColor,
        });
      } else {
        console.log(`❌ No active round found for client ${socket.id}`);
      }
    });

    // Listen for bet placed (optional, if you want to handle via socket)
    socket.on("bet:place", async (data) => {
      // This is optional; main logic should be via HTTP API
      // You can implement socket-based betting if desired
    });
  });

  // Expose emitters for use in controllers (optional)
  return {
    emitRoundUpdate,
    emitBetPlaced,
    emitRoundResult,
  };
};
