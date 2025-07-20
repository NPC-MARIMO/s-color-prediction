const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMiddleware = require("../middlewares/admin.middleware");

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(adminMiddleware);

// ==================== USER MANAGEMENT ====================
router.get("/users", adminController.getAllUsers);
router.get("/users/:userId", adminController.getUserById);
router.patch("/users/:userId/block", adminController.toggleUserBlock);
router.patch("/users/:userId/role", adminController.updateUserRole);

// ==================== GAME SETTINGS ====================
router.get("/game/settings", adminController.getGameSettings);
router.put("/game/settings", adminController.updateGameSettings);

// ==================== SYSTEM STATISTICS ====================
router.get("/stats/system", adminController.getSystemStats);

// ==================== MANUAL PAYOUTS ====================
router.get("/withdrawals/pending", adminController.getPendingWithdrawals);
router.post("/withdrawals/:transactionId/approve", adminController.approveWithdrawal);
router.post("/withdrawals/:transactionId/reject", adminController.rejectWithdrawal);

// ==================== ADMIN DASHBOARD ====================
router.get("/dashboard", adminController.getDashboardData);

module.exports = router; 