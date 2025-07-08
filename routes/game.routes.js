const express = require("express");
const router = express.Router();
const gameController = require("../controllers/game.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");

// Public routes (no authentication required)
router.get("/current-round", gameController.getCurrentRound);
router.get("/recent-rounds", gameController.getRecentRounds);

// Protected routes (authentication required)
router.use(authMiddleware);

// User routes
router.post("/place-bet", gameController.placeBet);
router.get("/bet-history", gameController.getBetHistory);

// Admin routes
router.use(adminMiddleware);
router.post("/create-round", gameController.createRound);

module.exports = router;
