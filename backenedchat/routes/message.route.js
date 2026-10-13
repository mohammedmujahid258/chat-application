import express from "express";
import {
  sendMessage,
  getMessages,
  markMessagesAsSeen,
  editMessage,
  deleteMessage,
  reactToMessage,
  clearConversation,
  pinMessage,
  unpinMessage,
  getGroupMessages,
  markGroupMessagesAsSeen,
} from "../controllers/message.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

const handleUploadMiddleware = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "File is too large. Maximum allowed size is 25MB.",
        });
      }
      return res.status(400).json({
        message: err.message || "Failed to process file upload.",
      });
    }
    next();
  });
};

const router = express.Router();
router.get("/group/:id", authMiddleware, getGroupMessages);
router.put("/group/:id/seen", authMiddleware, markGroupMessagesAsSeen);
router.get("/:id", authMiddleware, getMessages);
router.put("/seen/:id", authMiddleware, markMessagesAsSeen);
router.post("/send", authMiddleware, handleUploadMiddleware, sendMessage);
router.put("/:id/pin", authMiddleware, pinMessage);
router.put("/:id/unpin", authMiddleware, unpinMessage);
router.put("/:id", authMiddleware, editMessage);
router.delete("/:id", authMiddleware, deleteMessage);
router.post("/:id/react", authMiddleware, reactToMessage);
router.delete("/conversation/:id", authMiddleware, clearConversation);

export default router;
