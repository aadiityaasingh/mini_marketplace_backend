
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getMyProfile } from "../controllers/userController.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/me", protect, getMyProfile);

router.get(
  "/admin-test",
  protect,
  authorizeRoles("admin"),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome, admin!",
    });
  }
);


export default router;
