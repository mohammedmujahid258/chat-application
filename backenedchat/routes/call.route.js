import express from "express";
import {
  getIceServers,
  logCall,
  getCallHistory,
} from "../controllers/call.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/ice-servers", authMiddleware, getIceServers);
router.get("/history", authMiddleware, getCallHistory);
router.post("/log", authMiddleware, logCall);

export default router;
