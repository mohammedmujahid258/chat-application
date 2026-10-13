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

