
import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  try {
    // 1. Read the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please log in.",
      });
    }

    // 2. Extract the token
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }

    // 3. Verify token signature and expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "mit-mini-market",
      audience: "mit-mini-market-users",
    });

    // 4. Attach authenticated identity to request
    req.user = {
      id: decoded.userId,
      role: decoded.role,
    };

    // 5. Continue to the next middleware or controller
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message:
        error.name === "TokenExpiredError"
          ? "Session expired. Please log in again."
          : "Invalid authentication token.",
    });
  }
};
