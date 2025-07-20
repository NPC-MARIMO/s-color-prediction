const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Bank details routes
router.post("/bank-details", userController.createOrUpdateBankDetails);
router.get("/bank-details", userController.getBankDetails);
router.put("/bank-details", userController.updateBankDetails);
router.delete("/bank-details", userController.deleteBankDetails);

// User profile routes
router.get("/profile", userController.getUserProfile);

module.exports = router; 