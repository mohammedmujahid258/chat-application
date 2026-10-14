import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const envFrontend = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.trim().replace(/\/+$/, "") : null;

export const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "https://chat-application-web-0a70.onrender.com",
    envFrontend,
].filter(Boolean);

export const isOriginAllowed = (origin) => {
    if (!origin) return true;
    const cleanOrigin = origin.trim().replace(/\/+$/, "");
    if (allowedOrigins.includes(cleanOrigin)) return true;
    if (/^https?:\/\/localhost(:\d+)?$/.test(cleanOrigin)) return true;
    if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(cleanOrigin)) return true;
    if (/^https:\/\/[a-zA-Z0-9-]+\.onrender\.com$/.test(cleanOrigin)) return true;
    return false;
};

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (isOriginAllowed(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`Origin ${origin} not allowed by CORS`));
            }
        },
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        credentials: true,
    },
});

import User from "../models/Users.model.js";
import jwt from "jsonwebtoken";

// Verify socket connection with JWT token to prevent spoofed/arbitrary client IDs
io.use((socket, next) => {
    try {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.split(" ")[1] ||
            socket.handshake.query?.token;

        if (!token) {
            return next(new Error("Authentication error: Token required"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const authenticatedUserId = String(decoded.userId || decoded.id || "");

        if (!authenticatedUserId) {
            return next(new Error("Authentication error: Invalid token payload"));
        }

        const queryUserId = socket.handshake.query?.userId;
        if (queryUserId && queryUserId !== "undefined" && String(queryUserId) !== authenticatedUserId) {
            return next(new Error("Authentication error: User ID mismatch"));
        }

        socket.userId = authenticatedUserId;
        return next();
    } catch (err) {
        console.error("Socket authentication error:", err.message);
        return next(new Error("Authentication error: Invalid or expired token"));
    }
});

// Map of userId -> Set of socketIds to track multiple tabs/devices per user
const userSocketMap = {};

export const getReceiverSocketId = (receiverId) => {
    const sockets = userSocketMap[String(receiverId)];
    if (!sockets || sockets.size === 0) return null;
    return Array.from(sockets)[0];
};

export const getReceiverSocketIds = (receiverId) => {
    const sockets = userSocketMap[String(receiverId)];
    return sockets ? Array.from(sockets) : [];
};

export const getOnlineUserIds = () => {
    return Object.keys(userSocketMap).filter(
        (id) => userSocketMap[id] && userSocketMap[id].size > 0
    );
};

export const isUserOnline = (userId) => {
    const id = String(userId);
    return Boolean(userSocketMap[id] && userSocketMap[id].size > 0);
};

io.on("connection", async (socket) => {
    console.log("A user connected:", socket.id);

    // Use verified authenticated socket.userId
    const userId = socket.userId;
    if (userId && userId !== "undefined") {
        const isFirstConnection = !userSocketMap[userId] || userSocketMap[userId].size === 0;

        if (!userSocketMap[userId]) {
            userSocketMap[userId] = new Set();
        }
        userSocketMap[userId].add(socket.id);

        if (isFirstConnection) {
            let lastSeenToBroadcast = null;
            try {
                // Mark user as online in database without changing their lastSeen timestamp
                const userDoc = await User.findByIdAndUpdate(
                    userId,
                    { isOnline: true },
                    { returnDocument: 'after' }
                ).select("lastSeen");
                lastSeenToBroadcast = userDoc?.lastSeen ? userDoc.lastSeen.toISOString() : null;
            } catch (err) {
                console.error("Error setting user online status:", err);
            }

            // Broadcast user online status update only on the initial connection for this user
            io.emit("userStatusChanged", {
                userId,
                isOnline: true,
                lastSeen: lastSeenToBroadcast,
            });
        }
    }

    // Broadcast current online user IDs to all connected clients
    io.emit("getOnlineUsers", getOnlineUserIds());

    // Real-time typing indicators
    socket.on("typing", ({ receiverId }) => {
        const receiverSockets = getReceiverSocketIds(receiverId);
        receiverSockets.forEach((sockId) => {
            io.to(sockId).emit("userTyping", { senderId: userId });
        });
    });

    socket.on("stopTyping", ({ receiverId }) => {
        const receiverSockets = getReceiverSocketIds(receiverId);
        receiverSockets.forEach((sockId) => {
            io.to(sockId).emit("userStoppedTyping", { senderId: userId });
        });
    });

    // WebRTC 1-to-1 and Group Call Signaling State
    // Track active user calls: userId -> callId
    const userCallMap = new Map();
    // Track call info: callId -> { callerId, receiverId, callType, isGroupCall, groupId, participants: Set }
    const activeCallsMap = new Map();

    // 1-to-1 Call: Initiate Call
    socket.on("call:initiate", async ({ receiverId, callType, callId }) => {
        const targetId = String(receiverId);
        if (!targetId || targetId === userId) return;

        // Check if receiver is online
        if (!isUserOnline(targetId)) {
            const callerSockets = getReceiverSocketIds(userId);
            callerSockets.forEach((sId) => {
                io.to(sId).emit("call:unavailable", {
                    receiverId: targetId,
                    callId,
                    reason: "User is currently offline",
                });
            });
            return;
        }

        // Check if receiver is already engaged in another call
        if (userCallMap.has(targetId)) {
            const callerSockets = getReceiverSocketIds(userId);
            callerSockets.forEach((sId) => {
                io.to(sId).emit("call:busy", {
                    receiverId: targetId,
                    callId,
                    reason: "User is busy on another call",
                });
            });
            return;
        }

        try {
            const callerUser = await User.findById(userId).select("name profilePic");
            userCallMap.set(userId, callId);
            activeCallsMap.set(callId, {
                callerId: userId,
                receiverId: targetId,
                callType: callType || "voice",
                status: "ringing",
            });

            // Notify receiver sockets
            const receiverSockets = getReceiverSocketIds(targetId);
            receiverSockets.forEach((sId) => {
                io.to(sId).emit("call:incoming", {
                    callId,
                    callType: callType || "voice",
                    caller: {
                        _id: userId,
                        name: callerUser?.name || "Unknown",
                        profilePic: callerUser?.profilePic || "",
                    },
                });
            });

            // Notify caller sockets that call is ringing
            const callerSockets = getReceiverSocketIds(userId);
            callerSockets.forEach((sId) => {
                io.to(sId).emit("call:ringing", {
                    receiverId: targetId,
                    callId,
                });
            });
        } catch (err) {
            console.error("call:initiate error:", err);
        }
    });

    // 1-to-1 Call: Accept Call
    socket.on("call:accept", ({ callerId, callId }) => {
        const cId = String(callerId);
        userCallMap.set(userId, callId);

        const call = activeCallsMap.get(callId);
        if (call) {
            call.status = "connected";
        }

        const callerSockets = getReceiverSocketIds(cId);
        callerSockets.forEach((sId) => {
            io.to(sId).emit("call:accepted", {
                receiverId: userId,
                callId,
            });
        });
    });

    // 1-to-1 Call: Reject Call
    socket.on("call:reject", ({ callerId, callId }) => {
        const cId = String(callerId);
        userCallMap.delete(cId);
        userCallMap.delete(userId);
        activeCallsMap.delete(callId);

        const callerSockets = getReceiverSocketIds(cId);
        callerSockets.forEach((sId) => {
            io.to(sId).emit("call:rejected", {
                receiverId: userId,
                callId,
                reason: "Call declined",
            });
        });
    });

    // 1-to-1 Call: WebRTC Signaling Relay (SDP offer/answer, ICE candidates)
    socket.on("call:signal", ({ targetUserId, signalData, callId }) => {
        const targetSockets = getReceiverSocketIds(targetUserId);
        targetSockets.forEach((sId) => {
            io.to(sId).emit("call:signal", {
                senderId: userId,
                signalData,
                callId,
            });
        });
    });

    // 1-to-1 Call: End Call
    socket.on("call:end", ({ targetUserId, callId, reason }) => {
        const tId = String(targetUserId || "");
        userCallMap.delete(userId);
        if (tId) userCallMap.delete(tId);
        activeCallsMap.delete(callId);

        if (tId) {
            const targetSockets = getReceiverSocketIds(tId);
            targetSockets.forEach((sId) => {
                io.to(sId).emit("call:ended", {
                    senderId: userId,
                    callId,
                    reason: reason || "Call ended",
                });
            });
        }

        // Notify other tabs of same user
        const mySockets = getReceiverSocketIds(userId);
        mySockets.forEach((sId) => {
            if (sId !== socket.id) {
                io.to(sId).emit("call:ended", {
                    senderId: userId,
                    callId,
                    reason: reason || "Call ended",
                });
            }
        });
    });

    // 1-to-1 Call: Media Track Toggle (Mute/Camera Off indicator)
    socket.on("call:toggleMedia", ({ targetUserId, isMuted, isCameraOff, callId }) => {
        if (!targetUserId) return;
        const targetSockets = getReceiverSocketIds(targetUserId);
        targetSockets.forEach((sId) => {
            io.to(sId).emit("call:mediaToggled", {
                senderId: userId,
                isMuted,
                isCameraOff,
                callId,
            });
        });
    });

    // Group Call: Initiate
    socket.on("groupCall:initiate", async ({ groupId, groupName, groupPic, callType, callId, memberIds }) => {
        try {
            const callerUser = await User.findById(userId).select("name profilePic");
            activeCallsMap.set(callId, {
                callerId: userId,
                groupId,
                callType,
                isGroupCall: true,
                participants: new Set([userId]),
            });
            userCallMap.set(userId, callId);
            socket.join(`group-call-${callId}`);

            const members = Array.isArray(memberIds) ? memberIds : [];
            members.forEach((mId) => {
                const targetMemberId = String(mId);
                if (targetMemberId !== userId && isUserOnline(targetMemberId)) {
                    const memberSockets = getReceiverSocketIds(targetMemberId);
                    memberSockets.forEach((sId) => {
                        io.to(sId).emit("groupCall:incoming", {
                            groupId,
                            groupName,
                            groupPic,
                            callType,
                            callId,
                            caller: {
                                _id: userId,
                                name: callerUser?.name || "Group Member",
                                profilePic: callerUser?.profilePic || "",
                            },
                        });
                    });
                }
            });
        } catch (err) {
            console.error("groupCall:initiate error:", err);
        }
    });

    // Group Call: Join
    socket.on("groupCall:join", ({ groupId, callId, userInfo }) => {
        socket.join(`group-call-${callId}`);
        userCallMap.set(userId, callId);
        const call = activeCallsMap.get(callId);
        if (call && call.participants) {
            call.participants.add(userId);
        }

        // Notify others in room
        socket.to(`group-call-${callId}`).emit("groupCall:userJoined", {
            userId,
            userInfo: userInfo || { _id: userId },
            callId,
        });
    });

    // Group Call: WebRTC Signal relay to specific peer
    socket.on("groupCall:signal", ({ targetUserId, signalData, callId }) => {
        const targetSockets = getReceiverSocketIds(targetUserId);
        targetSockets.forEach((sId) => {
            io.to(sId).emit("groupCall:signal", {
                senderId: userId,
                signalData,
                callId,
            });
        });
    });

    // Group Call: Leave
    socket.on("groupCall:leave", ({ groupId, callId }) => {
        socket.leave(`group-call-${callId}`);
        userCallMap.delete(userId);
        const call = activeCallsMap.get(callId);
        if (call && call.participants) {
            call.participants.delete(userId);
            if (call.participants.size === 0) {
                activeCallsMap.delete(callId);
            }
        }

        socket.to(`group-call-${callId}`).emit("groupCall:userLeft", {
            userId,
            callId,
        });
    });

    socket.on("disconnect", async () => {
        console.log("User disconnected:", socket.id);

        // Handle active call clean up on disconnect
        if (userCallMap.has(userId)) {
            const callId = userCallMap.get(userId);
            userCallMap.delete(userId);

            const call = activeCallsMap.get(callId);
            if (call) {
                if (call.isGroupCall) {
                    if (call.participants) call.participants.delete(userId);
                    socket.to(`group-call-${callId}`).emit("groupCall:userLeft", {
                        userId,
                        callId,
                    });
                } else {
                    const peerId = call.callerId === userId ? call.receiverId : call.callerId;
                    activeCallsMap.delete(callId);
                    if (peerId) {
                        userCallMap.delete(peerId);
                        const peerSockets = getReceiverSocketIds(peerId);
                        peerSockets.forEach((sId) => {
                            io.to(sId).emit("call:ended", {
                                senderId: userId,
                                callId,
                                reason: "Participant disconnected",
                            });
                        });
                    }
                }
            }
        }

        if (userId && userSocketMap[userId]) {
            userSocketMap[userId].delete(socket.id);

            // If the user has no remaining active connections across all tabs, mark them offline and record lastSeen
            if (userSocketMap[userId].size === 0) {
                delete userSocketMap[userId];
                const now = new Date();

                try {
                    await User.findByIdAndUpdate(userId, {
                        isOnline: false,
                        lastSeen: now,
                    });
                } catch (err) {
                    console.error("Error setting user lastSeen:", err);
                }

                // Broadcast user offline and updated lastSeen
                io.emit("userStatusChanged", {
                    userId,
                    isOnline: false,
                    lastSeen: now.toISOString(),
                });
            }
        }
        io.emit("getOnlineUsers", getOnlineUserIds());
    });
});

export { app, io, server };
