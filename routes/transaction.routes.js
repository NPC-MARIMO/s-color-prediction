const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transaction.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");

// All transaction routes require admin access
router.use(authMiddleware);
router.use(adminMiddleware);

// Admin routes
router.get("/all", transactionController.getAllTransactions);
router.get("/stats", transactionController.getTransactionStats);
router.get("/:transactionId", transactionController.getTransactionById);
router.patch("/:transactionId/status", transactionController.updateTransactionStatus);
router.post("/:transactionId/refund", transactionController.refundTransaction);

module.exports = router;
