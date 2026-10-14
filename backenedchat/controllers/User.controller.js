import mongoose from "mongoose";
import User from "../models/Users.model.js";
import Message from "../models/Message.model.js";
import cloudinary from "../config/cloudinary.js";
import { isUserOnline, io } from "../config/socket.js";

export const getUsers = async (req, res) => {
    try {
        const loggedInUserId = req.userId;
        const loggedInObjectId = new mongoose.Types.ObjectId(String(loggedInUserId));

        const users = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

        // Find senders who have sent unseen messages to the logged-in user
        const unreadSenders = await Message.distinct("sender", {
            receiver: loggedInUserId,
            seen: false,
        });

        // Find the latest message for every conversation involving the logged-in user
        const lastMessagesAggregation = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { sender: loggedInObjectId },
                        { receiver: loggedInObjectId },
                    ],
                },
            },
            {
                $sort: { createdAt: -1 },
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ["$sender", loggedInObjectId] },
                            "$receiver",
                            "$sender",
                        ],
                    },
                    lastMessage: { $first: "$$ROOT" },
                },
            },
        ]);

        const lastMessagesMap = {};
        lastMessagesAggregation.forEach((item) => {
            if (item._id) {
                lastMessagesMap[item._id.toString()] = item.lastMessage;
            }
        });

        const usersWithOnlineStatus = users.map((u) => {
            const userObj = u.toObject();
            return {
                ...userObj,
                isOnline: isUserOnline(u._id),
            };
        });

        // Sort users by latest message createdAt descending (conversations with latest messages on top)
        usersWithOnlineStatus.sort((a, b) => {
            const aTime = new Date(lastMessagesMap[a._id.toString()]?.createdAt || 0).getTime();
            const bTime = new Date(lastMessagesMap[b._id.toString()]?.createdAt || 0).getTime();
            if (bTime !== aTime) {
                return bTime - aTime;
            }
            return (a.name || "").localeCompare(b.name || "");
        });

        return res.status(200).json({
            users: usersWithOnlineStatus,
            unreadSenders: unreadSenders.map((id) => id.toString()),
            lastMessages: lastMessagesMap,
        });
    } catch (error) {
        console.error("Get users error :", error);
        return res.status(500).json({
            message: "Server error",
        });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const { name, removeProfilePic } = req.body || {};

        const updateData = {};

        if (name && typeof name === "string" && name.trim()) {
            updateData.name = name.trim();
        }

        if (removeProfilePic === "true" || removeProfilePic === true) {
            updateData.profilePic = "";
        } else if (req.file) {
            // Validate image MIME type
            if (!req.file.mimetype || !req.file.mimetype.startsWith("image/")) {
                return res.status(400).json({
                    message: "Only image files (JPEG, PNG, WebP, GIF) are allowed for profile pictures",
                });
            }

            // Validate file size limit (5 MB)
            if (req.file.size > 5 * 1024 * 1024) {
                return res.status(400).json({
                    message: "Profile picture size exceeds 5MB limit",
                });
            }

            const uploadResult = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: "chatsphere_profiles",
                        resource_type: "image",
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                stream.end(req.file.buffer);
            });
            updateData.profilePic = uploadResult.secure_url;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                message: "Please provide a name or profile picture to update",
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        // Broadcast safe public user profile update via Socket.IO
        io.emit("userProfileUpdated", {
            userId: updatedUser._id.toString(),
            name: updatedUser.name,
            profilePic: updatedUser.profilePic || "",
        });

        return res.status(200).json({
            message: "Profile updated successfully",
            user: updatedUser,
            data: updatedUser,
        });
    } catch (error) {
        console.error("Update profile error:", error);
        return res.status(500).json({
            message: "Server error",
        });
    }
};

/**
 * Search users by name or email (excluding current user)
 * GET /api/users/search?q=value
 */
export const searchUsers = async (req, res) => {
    try {
        const loggedInUserId = req.userId;
        const query = (req.query.q || req.query.query || "").trim();

        if (!query) {
            return res.status(200).json({ users: [] });
        }

        // Escape regex special characters to prevent regex injection attacks
        const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const searchRegex = new RegExp(safeQuery, "i");

        const matchedUsers = await User.find({
            _id: { $ne: loggedInUserId },
            $or: [
                { name: searchRegex },
                { email: searchRegex },
            ],
        })
            .select("_id name email profilePic isOnline lastSeen")
            .limit(25);

        const safeUsers = matchedUsers.map((u) => ({
            _id: u._id,
            name: u.name,
            email: u.email,
            profilePic: u.profilePic || "",
            isOnline: isUserOnline(u._id),
            lastSeen: u.lastSeen,
        }));

        return res.status(200).json({ users: safeUsers });
    } catch (error) {
        console.error("Search users error:", error);
        return res.status(500).json({
            message: "Server error",
        });
    }
};

/**
 * Get logged-in user's saved contacts
 * GET /api/users/contacts
 */
export const getContacts = async (req, res) => {
    try {
        const loggedInUserId = req.userId;
        const loggedInObjectId = new mongoose.Types.ObjectId(String(loggedInUserId));

        const user = await User.findById(loggedInObjectId)
            .populate({
                path: "contacts",
                select: "_id name email profilePic lastSeen isOnline",
            });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const validContacts = (user.contacts || []).filter(Boolean);

        // Map populated contacts and attach real-time online status
        const contactsWithOnline = validContacts.map((c) => {
            const cObj = c.toObject ? c.toObject() : c;
            return {
                ...cObj,
                isOnline: isUserOnline(cObj._id),
            };
        });

        // Fetch latest messages with these contacts for display & ordering
        const contactIds = contactsWithOnline.map((c) => c._id);
        const lastMessagesAggregation = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { sender: loggedInObjectId, receiver: { $in: contactIds } },
                        { receiver: loggedInObjectId, sender: { $in: contactIds } },
                    ],
                },
            },
            {
                $sort: { createdAt: -1 },
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ["$sender", loggedInObjectId] },
                            "$receiver",
                            "$sender",
                        ],
                    },
                    lastMessage: { $first: "$$ROOT" },
                },
            },
        ]);

        const lastMessagesMap = {};
        lastMessagesAggregation.forEach((item) => {
            if (item._id) {
                lastMessagesMap[item._id.toString()] = item.lastMessage;
            }
        });

        // Sort contacts by latest message timestamp descending, then alphabetically by name
        contactsWithOnline.sort((a, b) => {
            const aTime = new Date(lastMessagesMap[a._id.toString()]?.createdAt || 0).getTime();
            const bTime = new Date(lastMessagesMap[b._id.toString()]?.createdAt || 0).getTime();
            if (bTime !== aTime) {
                return bTime - aTime;
            }
            return (a.name || "").localeCompare(b.name || "");
        });

        return res.status(200).json({
            contacts: contactsWithOnline,
            lastMessages: lastMessagesMap,
        });
    } catch (error) {
        console.error("Get contacts error:", error);
        return res.status(500).json({
            message: "Server error",
        });
    }
};

/**
 * Add a contact for the logged-in user
 * POST /api/users/contacts/:contactId
 */
export const addContact = async (req, res) => {
    try {
        const loggedInUserId = req.userId;
        const { contactId } = req.params;

        if (!contactId || !mongoose.Types.ObjectId.isValid(contactId)) {
            return res.status(400).json({ message: "Invalid contact ID format" });
        }

        if (String(contactId) === String(loggedInUserId)) {
            return res.status(400).json({ message: "You cannot add yourself as a contact" });
        }

        // Verify that the user being added exists
        const contactUser = await User.findById(contactId).select("_id name email profilePic lastSeen isOnline");
        if (!contactUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = await User.findById(loggedInUserId);
        if (!user) {
            return res.status(404).json({ message: "Current user not found" });
        }

        // Check for duplicates
        const isAlreadyAdded = (user.contacts || []).some(
            (c) => String(c._id || c) === String(contactId)
        );

        if (isAlreadyAdded) {
            return res.status(409).json({ message: "User is already in your contacts" });
        }

        user.contacts = user.contacts || [];
        user.contacts.push(new mongoose.Types.ObjectId(String(contactId)));
        await user.save();

        const savedContact = {
            ...contactUser.toObject(),
            isOnline: isUserOnline(contactUser._id),
        };

        return res.status(201).json({
            message: "Contact added successfully",
            contact: savedContact,
        });
    } catch (error) {
        console.error("Add contact error:", error);
        return res.status(500).json({
            message: "Server error",
        });
    }
};

/**
 * Remove a contact for the logged-in user
 * DELETE /api/users/contacts/:contactId
 */
export const removeContact = async (req, res) => {
    try {
        const loggedInUserId = req.userId;
        const { contactId } = req.params;

        if (!contactId || !mongoose.Types.ObjectId.isValid(contactId)) {
            return res.status(400).json({ message: "Invalid contact ID format" });
        }

        const user = await User.findById(loggedInUserId);
        if (!user) {
            return res.status(404).json({ message: "Current user not found" });
        }

        user.contacts = (user.contacts || []).filter(
            (c) => String(c._id || c) !== String(contactId)
        );
        await user.save();

        return res.status(200).json({
            message: "Contact removed successfully",
            contactId,
        });
    } catch (error) {
        console.error("Remove contact error:", error);
        return res.status(500).json({
            message: "Server error",
        });
    }
};


