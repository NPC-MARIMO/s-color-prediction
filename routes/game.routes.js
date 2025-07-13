const express = require("express");
const router = express.Router();
const gameController = require("../controllers/game.controller");
const betController = require("../controllers/bet.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");

// Public route to get current round
router.get("/current-round", gameController.getCurrentRound);

// Public route to get round result
router.get("/round/:roundId/result", gameController.getRoundResult);

// Public route to get round history
router.get("/history", gameController.getRoundHistory);

// Protected routes (authentication required)
router.use(authMiddleware);

// Place a bet on the current round
router.post("/place-bet", betController.placeBetOnCurrentRound);

// (Optional) Admin/cron endpoints for round management
router.use(adminMiddleware);
router.post("/start-round", gameController.startNewRound); // For manual/cron round start
router.post("/complete-round", gameController.completeCurrentRound); // For manual/cron round complete

module.exports = router;
