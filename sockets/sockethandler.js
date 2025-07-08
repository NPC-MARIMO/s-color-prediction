const User = require("../models/user.model");

module.exports = function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    if (!userId) {
      console.warn("🚨 User connected without ID");
      return;
    }

    console.log(`✅ Socket connected: ${userId}`);

    // Mark user online
    User.findByIdAndUpdate(userId, {
      isOnline: true,
      socketId: socket.id,
    }).catch(console.error);

    // Handle disconnect
    socket.on("disconnect", async () => {
      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          socketId: null,
        });
        console.log(`❌ Socket disconnected: ${userId}`);
      } catch (err) {
        console.error("🧨 Error updating user offline:", err);
      }
    });
  });
};
