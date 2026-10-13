
import express from "express";
import { getUsers, updateProfile } from "../controllers/User.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, getUsers);
router.put("/profile", authMiddleware, upload.single("profilePic"), updateProfile);

export default router;
