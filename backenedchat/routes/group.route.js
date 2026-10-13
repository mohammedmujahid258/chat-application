import express from "express";
import {
  createGroup,
  getMyGroups,
  getGroupDetails,
  updateGroup,
  addMembers,
  removeMember,
  leaveGroup,
} from "../controllers/group.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, getMyGroups);
router.post("/", authMiddleware, upload.single("groupPic"), createGroup);
router.get("/:id", authMiddleware, getGroupDetails);
router.put("/:id", authMiddleware, upload.single("groupPic"), updateGroup);
router.put("/:id/members", authMiddleware, addMembers);
router.delete("/:id/members/:memberId", authMiddleware, removeMember);
router.post("/:id/leave", authMiddleware, leaveGroup);

export default router;
