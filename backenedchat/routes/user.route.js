
import express from "express";
import {
  getUsers,
  updateProfile,
  searchUsers,
  getContacts,
  addContact,
  removeContact,
} from "../controllers/User.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, getUsers);
router.get("/search", authMiddleware, searchUsers);
router.get("/contacts", authMiddleware, getContacts);
router.post("/contacts/:contactId", authMiddleware, addContact);
router.delete("/contacts/:contactId", authMiddleware, removeContact);
router.put("/profile", authMiddleware, upload.single("profilePic"), updateProfile);

export default router;
