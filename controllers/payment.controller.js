const cashfree = require("../config/cashfree.config");
const User = require("../models/user.model");
const Transaction = require("../models/transaction.model");

// Create deposit order (Cashfree)
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

    const orderId = `order_${Date.now()}_${userId}`;
    const orderPayload = {
      order_id: orderId,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: userId.toString(),
        customer_email: user.email,
        customer_phone: user.phone || '9999999999', // fallback if phone not present
      },
    };
    const order = await cashfree.orders.createOrder(orderPayload);

    // Create pending transaction
    const transaction = new Transaction({
      userId,
      type: "deposit",
      amount: amount,
      netAmount: amount,
      balanceBefore: user.walletBalance,
      balanceAfter: user.walletBalance,
      description: `Deposit order created for ${amount}`,
      cashfreeOrderId: order.order_id,
      status: "pending",
    });
    await transaction.save();

    return res.status(201).json({
      message: "Deposit order created successfully",
      order,
      cashfree_app_id: process.env.CASHFREE_APP_ID,
    });
  } catch (error) {
    console.error("Error creating deposit order:", error);
    return res.status(500).json({ message: "Failed to create deposit order" });
  }
};

// Verify deposit payment (Cashfree)
exports.verifyDepositPayment = async (req, res) => {
  try {
    const { userId } = req.user;
    const { order_id, payment_id } = req.body;

    if (!order_id || !payment_id) {
      return res.status(400).json({ message: "Order ID and Payment ID are required" });
    }

    // Get payment status from Cashfree
    const payment = await cashfree.payments.getPayment({ order_id, payment_id });
    if (!payment || payment.payment_status !== 'SUCCESS') {
      return res.status(400).json({ message: "Payment not successful" });
    }
    const amount = parseFloat(payment.payment_amount);

    // Find and update transaction
    const transaction = await Transaction.findOne({
      cashfreeOrderId: order_id,
      status: "pending",
    });
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Update transaction
    transaction.cashfreePaymentId = payment_id;
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

// Cashfree webhook handler
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-cf-signature"];
    const body = req.body;

    // TODO: Add signature verification using Cashfree's SDK if needed
    // For now, assume webhook is trusted (for demo)

    const { event, data } = body;
    if (event === "PAYMENT_SUCCESS") {
      const orderId = data.order.order_id;
      const paymentId = data.payment.payment_id;
      const amount = parseFloat(data.payment.payment_amount);

      // Find and update transaction
      const transaction = await Transaction.findOne({
        cashfreeOrderId: orderId,
        status: "pending",
      });
      if (transaction) {
        transaction.cashfreePaymentId = paymentId;
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
