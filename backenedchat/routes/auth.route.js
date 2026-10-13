import express from "express";
import { register, login, logout } from "../controllers/auth.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import User from "../models/Users.model.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      message: "You are authenticated",
      user,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;