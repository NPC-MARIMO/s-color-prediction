const express = require("express");
const router = express.Router();
const walletController = require("../controllers/wallet.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Protected routes (authentication required)
router.use(authMiddleware);

// User routes
router.get("/balance", walletController.getWalletBalance);
router.get("/stats", walletController.getWalletStats);
router.get("/recent-transactions", walletController.getRecentTransactions);

// Admin routes
router.post("/create-wallet", walletController.createWallet);

module.exports = router;
