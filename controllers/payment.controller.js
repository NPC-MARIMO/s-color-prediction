const razorpay = require("../utils/razorpay");
const User = require("../models/user.model");
const Transaction = require("../models/transaction.model");

// Create deposit order (Razorpay)
exports.createDepositOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount } = req.body;

    console.log(`[createDepositOrder] userId: ${userId}, amount: ${amount}`);

    if (!amount || amount < 1) {
      console.warn(`[createDepositOrder] Invalid amount: ${amount}`);
      return res.status(400).json({ message: "Amount must be at least 1 INR" });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.warn(`[createDepositOrder] User not found: ${userId}`);
      return res.status(404).json({ message: "User not found" });
    }

    // Razorpay receipt must be <= 40 chars
    const rawReceipt = `order_${Date.now()}_${userId}`;
    const receipt = rawReceipt.slice(0, 40);
    const orderOptions = {
      amount: amount * 100, // Razorpay expects paise
      currency: "INR",
      receipt,
      payment_capture: 1,
      notes: {
        userId: userId.toString(),
        userEmail: user.email,
      },
    };
    console.log(`[createDepositOrder] Creating Razorpay order with options:`, orderOptions);

    const order = await razorpay.orders.create(orderOptions);

    console.log(`[createDepositOrder] Razorpay order created:`, order);

    await Transaction.create({
      userId,
      type: "deposit",
      amount,
      currency: "INR",
      status: "pending",
      razorpayOrderId: order.id,
      description: `Deposit order created via Razorpay`,
      netAmount: amount,
      balanceBefore: user.walletBalance,
      balanceAfter: user.walletBalance,
    });

    console.log(`[createDepositOrder] Transaction created for userId: ${userId}, orderId: ${order.id}`);

    // To show the payment page, you need to provide the frontend with all the details required to open Razorpay Checkout.
    // Typically, you should return: orderId, amount, currency, key, user info, etc.
    // The frontend should then use Razorpay Checkout JS to open the payment page.

    return res.status(201).json({
      message: "Order created successfully",
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID, // Send public key to frontend
      user: {
        name: user.name,
        email: user.email,
        contact: user.phone || "",
      },
      // Optionally, you can send any other info needed for Razorpay Checkout
    });
  } catch (error) {
    console.error("[createDepositOrder] Razorpay error:", error);
    return res.status(500).json({ message: "Payment failed. Please try again." });
  }
};

// Verify deposit payment (Razorpay) - Create transaction history here
exports.verifyDepositPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    console.log(`[verifyDepositPayment] userId: ${userId}, razorpay_order_id: ${razorpay_order_id}, razorpay_payment_id: ${razorpay_payment_id}`);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.warn(`[verifyDepositPayment] Missing required fields:`, req.body);
      return res.status(400).json({ message: "Order ID, Payment ID, and Signature are required" });
    }

    // Verify signature
    const crypto = require('crypto');
    const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');
    if (generated_signature !== razorpay_signature) {
      console.warn(`[verifyDepositPayment] Invalid payment signature. Expected: ${generated_signature}, Received: ${razorpay_signature}`);
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    console.log(`[verifyDepositPayment] Fetched payment:`, payment);

    if (!payment || payment.status !== 'captured') {
      console.warn(`[verifyDepositPayment] Payment not successful or not captured. Payment:`, payment);
      return res.status(400).json({ message: "Payment not successful" });
    }
    const amount = payment.amount / 100;

    // Update user wallet and create transaction history
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const balanceBefore = user.walletBalance;
    user.walletBalance += amount;
    await user.save();
    const balanceAfter = user.walletBalance;

    // Create transaction history record
    // First, find the existing pending transaction for this order and update it
    let transaction = await Transaction.findOneAndUpdate(
      {
        userId: userId,
        razorpayOrderId: razorpay_order_id,
        status: "pending"
      },
      {
        $set: {
          type: "deposit",
          amount: amount,
          currency: "INR",
          status: "completed",
          razorpayPaymentId: razorpay_payment_id,
          description: `Deposit via Razorpay`,
          netAmount: amount,
          balanceBefore: balanceBefore,
          balanceAfter: balanceAfter,
          completedAt: new Date(),
        }
      },
      { new: true }
    );

    // If not found, create a new transaction (fallback)
    if (!transaction) {
      transaction = await Transaction.create({
        userId: userId,
        type: "deposit",
        amount: amount,
        currency: "INR",
        status: "completed",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        description: `Deposit via Razorpay`,
        netAmount: amount,
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
        completedAt: new Date(),
      });
    }
    
    console.log(`[verifyDepositPayment] Transaction created for userId: ${userId}, orderId: ${razorpay_order_id}`);

    return res.status(200).json({
      message: "Payment verified successfully",
      success: true,
      amount: amount,
      walletBalance: user.walletBalance,
      transaction: {
        _id: transaction._id,
        amount: transaction.amount,
        status: transaction.status,
        createdAt: transaction.createdAt,
        completedAt: transaction.completedAt,
        type: transaction.type,
        razorpayOrderId: transaction.razorpayOrderId,
        razorpayPaymentId: transaction.razorpayPaymentId,
      }
    });
  } catch (error) {
    console.error("[verifyDepositPayment] Error verifying deposit payment:", error);
    return res.status(500).json({ message: "Failed to verify payment" });
  }
};

// Create withdrawal request
exports.createWithdrawalRequest = async (req, res) => {
  try {
    const userId  = req.user._id;
    const { amount, bankDetails } = req.body;

    if (!amount || amount < 100) {
      return res
        .status(400)
        .json({ message: "Minimum withdrawal amount is 100" });
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
    return res
      .status(500)
      .json({ message: "Failed to create withdrawal request" });
  }
};

// Get transaction history
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId  = req.user._id;

    
    const transactions = await Transaction.find(userId)
    
    console.log(transactions);
    return res.status(200).json({
      transactions,
    });

    
  } catch (error) {
    console.error("Error getting transaction history:", error);
    return res
      .status(500)
      .json({ message: "Failed to get transaction history" });
  }
};

// Razorpay webhook handler
exports.handleWebhook = async (req, res) => {
  try {
    const crypto = require('crypto');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
    if (signature !== expectedSignature) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }
    const event = req.body.event;
    if (event === "payment.captured") {
      const paymentEntity = req.body.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      const amount = paymentEntity.amount / 100;
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
    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("[Razorpay Webhook] Error:", error);
    res.status(500).json({ message: "Failed to process webhook" });
  }
};
