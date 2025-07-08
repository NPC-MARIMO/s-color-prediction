const User = require("../models/user.model");

const authMiddleware = async (req, res, next) => {
  try {
    // Get user ID from headers, body, or query params
    const userId = req.header("User-Id") || req.body.userId || req.query.userId;
    
    if (!userId) {
      return res.status(401).json({ message: "Access denied. User ID required." });
    }

    const user = await User.findById(userId).select("-password");
    
    if (!user) {
      return res.status(401).json({ message: "Invalid user ID. User not found." });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Account is blocked. Contact support." });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = authMiddleware;
