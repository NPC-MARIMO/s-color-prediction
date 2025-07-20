const User = require("../models/user.model");

// Create or update bank details
exports.createOrUpdateBankDetails = async (req, res) => {
  try {
    const { _id } = req.user;
    const { accountHolderName, accountNumber, ifsc, upiId } = req.body;

    // Validate required fields
    if (!accountHolderName || !accountNumber || !ifsc) {
      return res.status(400).json({ 
        message: "Account holder name, account number, and IFSC code are required" 
      });
    }

    // Validate IFSC format (basic validation) and convert to uppercase
    const ifscUpper = ifsc.toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscUpper)) {
      return res.status(400).json({ 
        message: "Invalid IFSC code format" 
      });
    }

    // Validate account number (basic validation)
    if (!/^\d{9,18}$/.test(accountNumber)) {
      return res.status(400).json({ 
        message: "Invalid account number format" 
      });
    }

    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update bank details
    user.bankDetails = {
      accountHolderName,
      accountNumber,
      ifsc: ifscUpper,
      upiId: upiId || null
    };

    await user.save();

    return res.status(200).json({
      message: "Bank details saved successfully",
      bankDetails: user.bankDetails
    });
  } catch (error) {
    console.error("Error saving bank details:", error);
    return res.status(500).json({ message: "Failed to save bank details" });
  }
};

// Get user's bank details
exports.getBankDetails = async (req, res) => {
  try {
    const { _id } = req.user;

    const user = await User.findById(_id).select('bankDetails');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      bankDetails: user.bankDetails || null
    });
  } catch (error) {
    console.error("Error getting bank details:", error);
    return res.status(500).json({ message: "Failed to get bank details" });
  }
};

// Update bank details
exports.updateBankDetails = async (req, res) => {
  try {
    const { _id } = req.user;
    const { accountHolderName, accountNumber, ifsc, upiId } = req.body;

    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if bank details exist
    if (!user.bankDetails) {
      return res.status(404).json({ message: "No bank details found. Please create them first." });
    }

    // Update only provided fields
    if (accountHolderName) user.bankDetails.accountHolderName = accountHolderName;
    if (accountNumber) {
      if (!/^\d{9,18}$/.test(accountNumber)) {
        return res.status(400).json({ message: "Invalid account number format" });
      }
      user.bankDetails.accountNumber = accountNumber;
    }
    if (ifsc) {
      const ifscUpper = ifsc.toUpperCase();
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscUpper)) {
        return res.status(400).json({ message: "Invalid IFSC code format" });
      }
      user.bankDetails.ifsc = ifscUpper;
    }
    if (upiId !== undefined) user.bankDetails.upiId = upiId;

    await user.save();

    return res.status(200).json({
      message: "Bank details updated successfully",
      bankDetails: user.bankDetails
    });
  } catch (error) {
    console.error("Error updating bank details:", error);
    return res.status(500).json({ message: "Failed to update bank details" });
  }
};

// Delete bank details
exports.deleteBankDetails = async (req, res) => {
  try {
    const { _id } = req.user;

    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if bank details exist
    if (!user.bankDetails) {
      return res.status(404).json({ message: "No bank details found" });
    }

    // Remove bank details
    user.bankDetails = undefined;
    await user.save();

    return res.status(200).json({
      message: "Bank details deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting bank details:", error);
    return res.status(500).json({ message: "Failed to delete bank details" });
  }
};

// Get user profile (including bank details)
exports.getUserProfile = async (req, res) => {
  try {
    const { _id } = req.user;

    const user = await User.findById(_id).select('-password');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        walletBalance: user.walletBalance,
        isBlocked: user.isBlocked,
        isKYCVerified: user.isKYCVerified,
        bankDetails: user.bankDetails,
        totalGamesPlayed: user.totalGamesPlayed,
        totalGamesWon: user.totalGamesWon,
        totalAmountWon: user.totalAmountWon,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error("Error getting user profile:", error);
    return res.status(500).json({ message: "Failed to get user profile" });
  }
}; 