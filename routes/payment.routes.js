const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Webhook route (no authentication required)
router.post("/webhook", paymentController.handleWebhook);

// Protected routes (authentication required)
router.use(authMiddleware);

// Deposit routes
router.post("/create-deposit-order", paymentController.createDepositOrder);
router.post("/verify-deposit-payment", paymentController.verifyDepositPayment);

// Withdrawal routes
router.post("/create-withdrawal-request", paymentController.createWithdrawalRequest);

// Transaction history
router.get("/transaction-history", paymentController.getTransactionHistory);

module.exports = router;
