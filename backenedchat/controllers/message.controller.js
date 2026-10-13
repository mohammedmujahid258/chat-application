import mongoose from "mongoose";
import Message from "../models/Message.model.js";
import Group from "../models/Group.model.js";
import { getReceiverSocketId, getReceiverSocketIds, io } from "../config/socket.js";
import cloudinary from "../config/cloudinary.js";

const extractErrorMessage = (error) => {
    if (!error) return "Server error";
    if (typeof error === "string") return error;
    if (error.message) return error.message;
    if (error.error && typeof error.error === "object" && error.error.message) return error.error.message;
    if (error.error && typeof error.error === "string") return error.error;
    try {
        return JSON.stringify(error);
    } catch (_) {
        return "Server error";
    }
};

const uploadToCloudinary = (file, customFileType) =>
    new Promise((resolve, reject) => {
        const mime = (file.mimetype || "").toLowerCase();
        const name = (file.originalname || "").toLowerCase();
        const isAudio =
            customFileType === "voice" ||
            customFileType === "audio" ||
            mime.startsWith("audio/") ||
            /\.(webm|ogg|mp3|wav|m4a|aac|opus)$/i.test(name);

        const resourceType = isAudio
            ? "video"
            : mime.startsWith("video/")
                ? "video"
                : mime.startsWith("image/")
                    ? "image"
                    : "auto";

        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "chatsphere",
                resource_type: resourceType,
            },
            (error, result) => {
                if (error) {
                    console.error("Cloudinary upload_stream error:", error);
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );

        stream.end(file.buffer);
    });

export const sendMessage = async (req, res) => {
    try {
        const { receiver, group: groupId, content, replyTo, duration, waveform, fileType: customFileType } = req.body || {};
        const sender = req.userId;

        const isGroup = Boolean(groupId);

        if (!isGroup && (!receiver || !mongoose.Types.ObjectId.isValid(receiver))) {
            return res.status(400).json({
                message: "Valid receiver ID is required for direct messages",
            });
        }

        let targetGroup = null;
        if (isGroup) {
            if (!mongoose.Types.ObjectId.isValid(groupId)) {
                return res.status(400).json({ message: "Invalid group ID format" });
            }
            targetGroup = await Group.findById(groupId);
            if (!targetGroup) {
                return res.status(404).json({ message: "Group not found" });
            }
            const isMember = targetGroup.members.some((m) => String(m) === String(sender));
            if (!isMember) {
                return res.status(403).json({ message: "Unauthorized: You are not a member of this group" });
            }
        }

        let fileUrl = "";
        let fileName = "";
        let fileType = "";
        let fileSize = 0;
        let audioDuration = 0;
        let audioWaveform = [];

        if (duration) {
            audioDuration = Math.round(Number(duration)) || 0;
        }

        if (waveform) {
            try {
                audioWaveform = typeof waveform === "string" ? JSON.parse(waveform) : (Array.isArray(waveform) ? waveform : []);
            } catch (e) {
                audioWaveform = [];
            }
        }

        if (req.file) {
            const uploadResult = await uploadToCloudinary(req.file, customFileType);
            fileName = req.file.originalname;
            fileSize = req.file.size || 0;
            const mime = (req.file.mimetype || "").toLowerCase();
            const name = (req.file.originalname || "").toLowerCase();
            if (
                customFileType === "voice" ||
                customFileType === "audio" ||
                mime.startsWith("audio/") ||
                /\.(webm|ogg|mp3|wav|m4a|aac|opus)$/i.test(name)
            ) {
                fileType = "voice";
            } else if (mime.startsWith("image/")) {
                fileType = "image";
            } else if (mime.startsWith("video/")) {
                fileType = "video";
            } else {
                fileType = "file";
            }
            fileUrl = uploadResult.secure_url;
        }

        const textContent = typeof content === "string" ? content.trim() : "";

        if (!textContent && !fileUrl) {
            return res.status(400).json({
                message: "Message must contain either text or an attachment",
            });
        }

        let validatedReplyToId = null;
        if (replyTo && replyTo !== "null" && replyTo !== "undefined") {
            if (!mongoose.Types.ObjectId.isValid(replyTo)) {
                return res.status(400).json({
                    message: "Invalid replyTo message ID format",
                });
            }

            const originalMessage = await Message.findById(replyTo);
            if (!originalMessage) {
                return res.status(400).json({
                    message: "Original message to reply to does not exist",
                });
            }

            validatedReplyToId = originalMessage._id;
        }

        let message = await Message.create({
            sender,
            receiver: isGroup ? null : receiver,
            group: isGroup ? targetGroup._id : null,
            content: textContent,
            fileUrl,
            fileName,
            fileType,
            fileSize,
            duration: audioDuration,
            waveform: audioWaveform,
            replyTo: validatedReplyToId,
            seenBy: isGroup ? [{ user: sender, seenAt: new Date() }] : [],
        });

        await message.populate("sender", "name profilePic");
        if (validatedReplyToId) {
            message = await message.populate({
                path: "replyTo",
                select: "sender content fileName fileType fileUrl createdAt duration waveform",
                populate: { path: "sender", select: "name profilePic" },
            });
        }
        await message.populate("reactions.user", "name profilePic");

        if (isGroup) {
            // Update lastMessage and timestamp in group
            targetGroup.lastMessage = message._id;
            targetGroup.updatedAt = new Date();
            await targetGroup.save();

            // Real-time broadcast to all group members
            targetGroup.members.forEach((memberId) => {
                const memberSocketIds = getReceiverSocketIds(String(memberId));
                memberSocketIds.forEach((sockId) => {
                    io.to(sockId).emit("newGroupMessage", {
                        groupId: targetGroup._id.toString(),
                        message,
                    });
                    io.to(sockId).emit("newMessage", message);
                });
            });
        } else {
            const receiverSocketIds = getReceiverSocketIds(receiver);
            receiverSocketIds.forEach((sockId) => {
                io.to(sockId).emit("newMessage", message);
            });

            // Also notify sender sockets so any other open tabs update sidebar in real time
            const senderSocketIds = getReceiverSocketIds(sender);
            senderSocketIds.forEach((sockId) => {
                io.to(sockId).emit("newMessage", message);
            });
        }

        return res.status(201).json({
            message: "Message sent successfully",
            data: message,
        });
    } catch (error) {
        console.error("Send message error:", error);
        const detailedError = extractErrorMessage(error);

        return res.status(500).json({
            message:
                process.env.NODE_ENV === "production"
                    ? "Server error"
                    : detailedError || "Server error",
            error: process.env.NODE_ENV === "production" ? undefined : detailedError,
        });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { id: userToChatId } = req.params;
        const myId = req.userId;

        if (!mongoose.Types.ObjectId.isValid(userToChatId)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        const messages = await Message.find({
            $or: [
                { sender: myId, receiver: userToChatId },
                { sender: userToChatId, receiver: myId },
            ],
        })
            .populate("sender", "name profilePic")
            .populate({
                path: "replyTo",
                select: "sender content fileName fileType fileUrl createdAt duration waveform",
                populate: { path: "sender", select: "name profilePic" },
            })
            .populate("reactions.user", "name profilePic")
            .sort({ createdAt: 1 });

        // Retrieve current pinned message in this conversation if exists
        const pinnedMessage = await Message.findOne({
            $or: [
                { sender: myId, receiver: userToChatId },
                { sender: userToChatId, receiver: myId },
            ],
            isPinned: true,
        })
            .populate("sender", "name profilePic")
            .populate("pinnedBy", "name profilePic")
            .populate({
                path: "replyTo",
                select: "sender content fileName fileType fileUrl createdAt duration waveform",
                populate: { path: "sender", select: "name profilePic" },
            })
            .populate("reactions.user", "name profilePic");

        return res.status(200).json({
            messages,
            pinnedMessage: pinnedMessage || null,
        });
    } catch (error) {
        console.error("Get messages error:", error);

        return res.status(500).json({
            message: "Server error",
        });
    }
};

export const editMessage = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const { content } = req.body || {};
        const userId = req.userId;

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: "Invalid message ID format" });
        }

        if (!content || typeof content !== "string" || !content.trim()) {
            return res.status(400).json({ message: "Updated content is required" });
        }

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (message.sender.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Unauthorized to edit this message" });
        }

        message.content = content.trim();
        message.isEdited = true;
        await message.save();
        await message.populate("sender", "name profilePic");
        await message.populate({
            path: "replyTo",
            select: "sender content fileName fileType fileUrl createdAt duration waveform",
            populate: { path: "sender", select: "name profilePic" },
        });
        await message.populate("reactions.user", "name profilePic");

        const receiverSocketIds = getReceiverSocketIds(message.receiver.toString());
        receiverSocketIds.forEach((sockId) => {
            io.to(sockId).emit("messageUpdated", message);
        });

        return res.status(200).json({ message: "Message edited successfully", data: message });
    } catch (error) {
        console.error("Edit message error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const userId = req.userId;

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: "Invalid message ID format" });
        }

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (message.sender.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Unauthorized to delete this message" });
        }

        const isPinned = message.isPinned;
        const groupId = message.group ? message.group.toString() : null;
        const receiverId = message.receiver ? message.receiver.toString() : null;
        await Message.findByIdAndDelete(messageId);

        if (groupId) {
            const group = await Group.findById(groupId);
            if (group && group.members) {
                group.members.forEach((mId) => {
                    const sockIds = getReceiverSocketIds(String(mId));
                    sockIds.forEach((sId) => {
                        io.to(sId).emit("messageDeleted", { messageId, sender: userId, groupId });
                    });
                });
            }
        } else if (receiverId) {
            const receiverSocketIds = getReceiverSocketIds(receiverId);
            const senderSocketIds = getReceiverSocketIds(userId);

            [...receiverSocketIds, ...senderSocketIds].forEach((sockId) => {
                io.to(sockId).emit("messageDeleted", { messageId, sender: userId });
                if (isPinned) {
                    io.to(sockId).emit("messageUnpinned", { messageId, sender: userId, receiver: receiverId });
                }
            });
        }

        return res.status(200).json({ message: "Message deleted successfully", messageId });
    } catch (error) {
        console.error("Delete message error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const reactToMessage = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const { emoji } = req.body || {};
        const userId = req.userId;

        // 1. Validate message ID format
        if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: "Invalid message ID format" });
        }

        // 2. Validate emoji value against allowed set
        const ALLOWED_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🙏", "🔥"];
        if (!emoji || typeof emoji !== "string" || !ALLOWED_EMOJIS.includes(emoji)) {
            return res.status(400).json({
                message: `Invalid or unsupported emoji reaction. Allowed: ${ALLOWED_EMOJIS.join(" ")}`,
            });
        }

        // 3. Find message
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // 4. Validate conversation access authorization
        const isParticipant =
            message.sender.toString() === userId.toString() ||
            message.receiver.toString() === userId.toString();

        if (!isParticipant) {
            return res.status(403).json({
                message: "Unauthorized: You are not a participant in this conversation",
            });
        }

        if (!Array.isArray(message.reactions)) {
            message.reactions = [];
        }

        // 5. Add, change, or remove reaction
        const existingIndex = message.reactions.findIndex(
            (r) => (r.user?._id || r.user).toString() === userId.toString()
        );

        let action = "added";
        if (existingIndex > -1) {
            if (message.reactions[existingIndex].emoji === emoji) {
                // User clicked their existing reaction -> remove it
                message.reactions.splice(existingIndex, 1);
                action = "removed";
            } else {
                // User changed their reaction
                message.reactions[existingIndex].emoji = emoji;
                action = "changed";
            }
        } else {
            // User added a new reaction
            message.reactions.push({ user: userId, emoji });
            action = "added";
        }

        await message.save();

        // 6. Populate for full response
        await message.populate("sender", "name profilePic");
        await message.populate({
            path: "replyTo",
            select: "sender content fileName fileType fileUrl createdAt duration waveform",
            populate: { path: "sender", select: "name profilePic" },
        });
        await message.populate("reactions.user", "name profilePic");

        // 7. Broadcast to both conversation participants (and all active sockets)
        const otherUserId = message.sender.toString() === userId.toString()
            ? message.receiver.toString()
            : message.sender.toString();
        const otherSocketIds = getReceiverSocketIds(otherUserId);
        const userSocketIds = getReceiverSocketIds(userId);

        [...otherSocketIds, ...userSocketIds].forEach((sockId) => {
            io.to(sockId).emit("messageReaction", message);
        });

        return res.status(200).json({
            message: `Reaction ${action} successfully`,
            action,
            data: message,
        });
    } catch (error) {
        console.error("React to message error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const clearConversation = async (req, res) => {
    try {
        const { id: otherUserId } = req.params;
        const myId = req.userId;

        await Message.deleteMany({
            $or: [
                { sender: myId, receiver: otherUserId },
                { sender: otherUserId, receiver: myId },
            ],
        });

        const otherSocketIds = getReceiverSocketIds(otherUserId);
        const mySocketIds = getReceiverSocketIds(myId);
        [...otherSocketIds, ...mySocketIds].forEach((sockId) => {
            io.to(sockId).emit("conversationCleared", { clearedBy: myId });
            io.to(sockId).emit("messageUnpinned", { sender: myId, receiver: otherUserId });
        });

        return res.status(200).json({ message: "Conversation cleared successfully" });
    } catch (error) {
        console.error("Clear conversation error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const markMessagesAsSeen = async (req, res) => {
    try {
        const { id: userToChatId } = req.params;
        const myId = req.userId;

        // Mark all unread messages sent by userToChatId to me as seen
        await Message.updateMany(
            { sender: userToChatId, receiver: myId, seen: false },
            { $set: { seen: true, seenAt: new Date() } }
        );

        // Notify the original sender via socket that their messages were seen
        const senderSocketIds = getReceiverSocketIds(userToChatId);
        senderSocketIds.forEach((sockId) => {
            io.to(sockId).emit("messagesSeen", { seenBy: myId });
        });

        return res.status(200).json({
            message: "Messages marked as seen",
        });
    } catch (error) {
        console.error("Mark messages as seen error:", error);

        return res.status(500).json({
            message: "Server error",
        });
    }
};

export const pinMessage = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const userId = req.userId;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        const senderStr = message.sender.toString();
        const receiverStr = message.receiver.toString();

        // Security check: Only participants of this conversation can pin messages
        if (senderStr !== userId.toString() && receiverStr !== userId.toString()) {
            return res.status(403).json({ message: "Unauthorized to pin this message" });
        }

        // Unpin any previously pinned message in this conversation
        await Message.updateMany(
            {
                $or: [
                    { sender: message.sender, receiver: message.receiver },
                    { sender: message.receiver, receiver: message.sender },
                ],
                isPinned: true,
            },
            {
                $set: { isPinned: false, pinnedAt: null, pinnedBy: null },
            }
        );

        message.isPinned = true;
        message.pinnedAt = new Date();
        message.pinnedBy = userId;
        await message.save();

        await message.populate("sender", "name profilePic");
        await message.populate("pinnedBy", "name profilePic");
        await message.populate({
            path: "replyTo",
            select: "sender content fileName fileType fileUrl createdAt duration waveform",
            populate: { path: "sender", select: "name profilePic" },
        });
        await message.populate("reactions.user", "name profilePic");

        // Broadcast pin event to both participants
        const partnerId = senderStr === userId.toString() ? receiverStr : senderStr;
        const receiverSockets = getReceiverSocketIds(partnerId);
        const senderSockets = getReceiverSocketIds(userId);

        [...receiverSockets, ...senderSockets].forEach((sockId) => {
            io.to(sockId).emit("messagePinned", {
                message,
                sender: senderStr,
                receiver: receiverStr,
            });
        });

        return res.status(200).json({
            message: "Message pinned successfully",
            data: message,
        });
    } catch (error) {
        console.error("Pin message error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const unpinMessage = async (req, res) => {
    try {
        const { id: messageId } = req.params;
        const userId = req.userId;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        const senderStr = message.sender.toString();
        const receiverStr = message.receiver.toString();

        // Security check: Only participants of this conversation can unpin messages
        if (senderStr !== userId.toString() && receiverStr !== userId.toString()) {
            return res.status(403).json({ message: "Unauthorized to unpin this message" });
        }

        message.isPinned = false;
        message.pinnedAt = null;
        message.pinnedBy = null;
        await message.save();

        // Broadcast unpin event to both participants
        const partnerId = senderStr === userId.toString() ? receiverStr : senderStr;
        const receiverSockets = getReceiverSocketIds(partnerId);
        const senderSockets = getReceiverSocketIds(userId);

        [...receiverSockets, ...senderSockets].forEach((sockId) => {
            io.to(sockId).emit("messageUnpinned", {
                messageId: message._id.toString(),
                sender: senderStr,
                receiver: receiverStr,
            });
        });

        return res.status(200).json({
            message: "Message unpinned successfully",
            messageId: message._id,
        });
    } catch (error) {
        console.error("Unpin message error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const getGroupMessages = async (req, res) => {
    try {
        const { id: groupId } = req.params;
        const myId = req.userId;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ message: "Invalid group ID format" });
        }

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        const isMember = group.members.some((m) => String(m) === String(myId));
        if (!isMember) {
            return res.status(403).json({ message: "Unauthorized: You are not a member of this group" });
        }

        const messages = await Message.find({ group: groupId })
            .populate("sender", "name profilePic email")
            .populate({
                path: "replyTo",
                select: "sender content fileName fileType fileUrl createdAt duration waveform",
                populate: { path: "sender", select: "name profilePic" },
            })
            .populate("reactions.user", "name profilePic")
            .sort({ createdAt: 1 });

        return res.status(200).json({
            messages,
            group,
        });
    } catch (error) {
        console.error("Get group messages error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const markGroupMessagesAsSeen = async (req, res) => {
    try {
        const { id: groupId } = req.params;
        const myId = req.userId;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ message: "Invalid group ID format" });
        }

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        const isMember = group.members.some((m) => String(m) === String(myId));
        if (!isMember) {
            return res.status(403).json({ message: "Unauthorized: You are not a member of this group" });
        }

        await Message.updateMany(
            {
                group: groupId,
                sender: { $ne: myId },
                "seenBy.user": { $ne: myId },
            },
            {
                $push: { seenBy: { user: myId, seenAt: new Date() } },
            }
        );

        // Notify group members of seen status
        group.members.forEach((m) => {
            const memberSockets = getReceiverSocketIds(String(m));
            memberSockets.forEach((sId) => {
                io.to(sId).emit("groupMessagesSeen", { groupId, seenBy: myId });
            });
        });

        return res.status(200).json({ message: "Group messages marked as seen" });
    } catch (error) {
        console.error("Mark group messages seen error:", error);
        return res.status(500).json({ message: "Server error" });
    }
};




