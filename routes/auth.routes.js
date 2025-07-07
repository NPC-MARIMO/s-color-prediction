const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

// Send OTP to email
router.post("/send-otp", authController.sendOtp);
router.post("/verify-otp", authController.verifyOtp);
router.post("/register", authController.register);
router.post("/login", authController.login);

module.exports = router;
    