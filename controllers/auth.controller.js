const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const Wallet = require("../models/wallet.model");

const otpStore = {};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP to email
exports.sendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required." });

  const otp = generateOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  otpStore[email] = { otp, expiresAt };

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP for Registration",
      text: `Your OTP is: ${otp}. It is valid for 10 minutes.`,
    });
    return res.json({ message: "OTP sent to email." });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Failed to send OTP.", error: err.message });
  }
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required." });
  }

  const otpEntry = otpStore[email];
  if (!otpEntry || otpEntry.otp !== otp) {
    return res.status(400).json({ message: "Invalid OTP." });
  }
  
  if (otpEntry.expiresAt < Date.now()) {
    delete otpStore[email];
    return res.status(400).json({ message: "OTP has expired." });
  }

  delete otpStore[email];

  return res.status(200).json({ message: "OTP verified successfully.", verified: true });
};

exports.register = async (req, res) => {
  const { email, password, verified } = req.body;
  if (!email || !password || !verified) {
    return res
      .status(400)
      .json({ message: "Email, password and verified are required." });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "User already exists." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ email, password: hashedPassword });
  await user.save();

  // Create wallet for the user
  const wallet = new Wallet({ userId: user._id });
  await wallet.save();

  // Return user data without password
  const userResponse = {
    _id: user._id,
    email: user.email,
    role: user.role,
    walletBalance: user.walletBalance,
    isBlocked: user.isBlocked,
    isKYCVerified: user.isKYCVerified,
    createdAt: user.createdAt,
  };

  return res.status(201).json({ 
    message: "User registered successfully.", 
    user: userResponse 
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "User not found." });
  }
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ message: "Invalid password." });
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Return user data without password
  const userResponse = {
    _id: user._id,
    email: user.email,
    role: user.role,
    walletBalance: user.walletBalance,
    isBlocked: user.isBlocked,
    isKYCVerified: user.isKYCVerified,
    lastLogin: user.lastLogin,
  };

  return res.status(200).json({ 
    message: "Login successful.", 
    user: userResponse 
  });
};
