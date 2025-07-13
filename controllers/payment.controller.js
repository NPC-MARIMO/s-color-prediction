const razorpay = require("../config/razorpay.config");
const User = require("../models/user.model");
const Transaction = require("../models/transaction.model");
const { verifyRazorpaySignature, verifyWebhookSignature } = require("../utils/verifySignature");

// Create deposit order
exports.createDepositOrder = async (req, res) => {
  try {
    const { userId } = req.user;
    const { amount } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ message: "Valid amount is required (minimum 1)" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: "INR",
      receipt: `deposit_${Date.now()}_${userId}`,
      notes: {
        userId: userId,
        type: "deposit",
      },
    };

    const order = await razorpay.orders.create(options);

    // Create pending transaction
    const transaction = new Transaction({
      userId,
      type: "deposit",
      amount: amount,
      netAmount: amount,
      balanceBefore: user.walletBalance,
      balanceAfter: user.walletBalance,
      description: `Deposit order created for ${amount}`,
      razorpayOrderId: order.id,
      status: "pending",
    });

    await transaction.save();

    return res.status(201).json({
      message: "Deposit order created successfully",
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      },
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error creating deposit order:", error);
    return res.status(500).json({ message: "Failed to create deposit order" });
  }
};

// Verify deposit payment
exports.verifyDepositPayment = async (req, res) => {
  try {
    const { userId } = req.user;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Payment verification data is required" });
    }

    // Verify signature
    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      process.env.RAZORPAY_KEY_SECRET
    );

    if (!isValid) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Get payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    const amount = payment.amount / 100; // Convert from paise to rupees

    // Find and update transaction
    const transaction = await Transaction.findOne({
      razorpayOrderId: razorpay_order_id,
      status: "pending",
    });

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Update transaction
    transaction.razorpayPaymentId = razorpay_payment_id;
    transaction.status = "completed";
    transaction.completedAt = new Date();
    await transaction.save();

    // Update user wallet
    const user = await User.findById(userId);
    if (user) {
      user.walletBalance += amount;
      await user.save();
    }

    return res.status(200).json({
      message: "Payment verified successfully",
      amount: amount,
    });
  } catch (error) {
    console.error("Error verifying deposit payment:", error);
    return res.status(500).json({ message: "Failed to verify payment" });
  }
};

// Create withdrawal request
exports.createWithdrawalRequest = async (req, res) => {
  try {
    const { userId } = req.user;
    const { amount, bankDetails } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ message: "Minimum withdrawal amount is 100" });
    }

    if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifsc) {
      return res.status(400).json({ message: "Bank details are required" });
    }

    // Check user wallet balance
    const user = await User.findById(userId);
    if (!user || user.walletBalance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Create withdrawal transaction
    const transaction = new Transaction({
      userId,
      type: "withdrawal",
      amount: -amount,
      netAmount: -amount,
      balanceBefore: user.walletBalance,
      balanceAfter: user.walletBalance - amount,
      description: `Withdrawal request for ${amount}`,
      status: "pending",
      metadata: {
        bankDetails: bankDetails,
      },
    });

    await transaction.save();

    // Update wallet balance
    user.walletBalance -= amount;
    await user.save();

    return res.status(201).json({
      message: "Withdrawal request created successfully",
      transaction: {
        _id: transaction._id,
        amount: amount,
        status: transaction.status,
      },
    });
  } catch (error) {
    console.error("Error creating withdrawal request:", error);
    return res.status(500).json({ message: "Failed to create withdrawal request" });
  }
};

// Get transaction history
exports.getTransactionHistory = async (req, res) => {
  try {
    const { userId } = req.user;
    const { page = 1, limit = 10, type } = req.query;

    const query = { userId };
    if (type) {
      query.type = type;
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Transaction.countDocuments(query);

    return res.status(200).json({
      transactions,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasNext: parseInt(page) * parseInt(limit) < total,
      },
    });
  } catch (error) {
    console.error("Error getting transaction history:", error);
    return res.status(500).json({ message: "Failed to get transaction history" });
  }
};

// Razorpay webhook handler
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const body = req.body;

    if (!signature) {
      return res.status(400).json({ message: "Signature is required" });
    }

    // Verify webhook signature
    const isValid = verifyWebhookSignature(
      body,
      signature,
      process.env.RAZORPAY_WEBHOOK_SECRET
    );

    if (!isValid) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const { event, payload } = body;

    if (event === "payment.captured") {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      const amount = payment.amount / 100;

      // Find and update transaction
      const transaction = await Transaction.findOne({
        razorpayOrderId: orderId,
        status: "pending",
      });

      if (transaction) {
        transaction.razorpayPaymentId = paymentId;
        transaction.status = "completed";
        transaction.completedAt = new Date();
        await transaction.save();

        // Update user wallet
        const user = await User.findById(transaction.userId);
        if (user) {
          user.walletBalance += amount;
          await user.save();
        }
      }
    }

    return res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res.status(500).json({ message: "Failed to process webhook" });
  }
};
