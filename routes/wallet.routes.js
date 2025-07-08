const express = require("express");
const router = express.Router();
const walletController = require("../controllers/wallet.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");

// Protected routes (authentication required)
router.use(authMiddleware);

// User routes
router.get("/balance", walletController.getWalletBalance);
router.get("/stats", walletController.getWalletStats);
router.get("/recent-transactions", walletController.getRecentTransactions);

// Admin routes
router.use(adminMiddleware);
router.post("/create-wallet", walletController.createWallet);

module.exports = router;
