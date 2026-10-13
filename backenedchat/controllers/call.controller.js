import mongoose from "mongoose";
import CallLog from "../models/CallLog.model.js";
import User from "../models/Users.model.js";

/**
 * Returns ICE servers for WebRTC connectivity.
 * Keeps TURN credentials on backend and protected by auth.
 */
export const getIceServers = async (req, res) => {
  try {
    const iceServers = [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
        ],
      },
    ];

    // Optional TURN servers from environment variables
    if (process.env.TURN_URL) {
      const turnConfig = {
        urls: process.env.TURN_URL.split(","),
      };
      if (process.env.TURN_USERNAME) {
        turnConfig.username = process.env.TURN_USERNAME;
      }
      if (process.env.TURN_PASSWORD) {
        turnConfig.credential = process.env.TURN_PASSWORD;
      }
      iceServers.push(turnConfig);
    }

    return res.status(200).json({ iceServers });
  } catch (error) {
    console.error("Get ICE servers error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Create or update a call log entry
 */
export const logCall = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      callId,
      receiver,
      group,
      isGroupCall,
      callType,
      status,
      startedAt,
      endedAt,
      duration,
    } = req.body || {};

    if (callId) {
      let existingCall = null;
      if (mongoose.Types.ObjectId.isValid(callId)) {
        existingCall = await CallLog.findById(callId);
      }
      if (!existingCall) {
        existingCall = await CallLog.findOne({ callId });
      }

      if (existingCall) {
        if (status) existingCall.status = status;
        if (startedAt) existingCall.startedAt = new Date(startedAt);
        if (endedAt) {
          existingCall.endedAt = new Date(endedAt);
          if (existingCall.startedAt) {
            existingCall.duration = Math.max(
              0,
              Math.round((existingCall.endedAt.getTime() - existingCall.startedAt.getTime()) / 1000)
            );
          }
        }
        if (duration !== undefined && duration !== null) {
          existingCall.duration = Number(duration) || existingCall.duration;
        }

        await existingCall.save();
        await existingCall.populate("caller", "name profilePic");
        if (existingCall.receiver) {
          await existingCall.populate("receiver", "name profilePic");
        }
        if (existingCall.group) {
          await existingCall.populate("group", "name groupPic");
        }

        return res.status(200).json({ callLog: existingCall });
      }
    }

    // Create new call log
    if (!callType || (!receiver && !group)) {
      return res.status(400).json({ message: "Invalid call log parameters" });
    }

    const newCall = await CallLog.create({
      callId: callId || `call_${Date.now()}`,
      caller: userId,
      receiver: receiver || null,
      group: group || null,
      isGroupCall: Boolean(isGroupCall),
      callType: callType === "video" ? "video" : "voice",
      status: status || "initiated",
      startedAt: startedAt ? new Date(startedAt) : null,
      endedAt: endedAt ? new Date(endedAt) : null,
      duration: Number(duration) || 0,
      participants: [{ user: userId, joinedAt: new Date() }],
    });

    await newCall.populate("caller", "name profilePic");
    if (newCall.receiver) {
      await newCall.populate("receiver", "name profilePic");
    }
    if (newCall.group) {
      await newCall.populate("group", "name groupPic");
    }

    return res.status(201).json({ callLog: newCall });
  } catch (error) {
    console.error("Log call error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Retrieve user's call history
 */
export const getCallHistory = async (req, res) => {
  try {
    const userId = req.userId;

    const history = await CallLog.find({
      $or: [
        { caller: userId },
        { receiver: userId },
        { "participants.user": userId },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("caller", "name profilePic email")
      .populate("receiver", "name profilePic email")
      .populate("group", "name groupPic");

    return res.status(200).json({ history, callLogs: history });
  } catch (error) {
    console.error("Get call history error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
