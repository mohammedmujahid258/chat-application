import mongoose from "mongoose";
import Group from "../models/Group.model.js";
import Message from "../models/Message.model.js";
import User from "../models/Users.model.js";
import cloudinary from "../config/cloudinary.js";
import { getReceiverSocketIds, io } from "../config/socket.js";

const uploadToCloudinary = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "chatsphere_groups",
        resource_type: "image",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(file.buffer);
  });

/**
 * Create a new group
 */
export const createGroup = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, description, members: rawMembers } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    let memberIds = [];
    if (rawMembers) {
      try {
        memberIds = typeof rawMembers === "string" ? JSON.parse(rawMembers) : rawMembers;
      } catch (e) {
        return res.status(400).json({ message: "Invalid members format" });
      }
    }

    if (!Array.isArray(memberIds)) {
      memberIds = [];
    }

    // Ensure valid ObjectIds and deduplicate
    const cleanMemberIds = Array.from(
      new Set(
        memberIds
          .map((id) => String(id))
          .filter((id) => mongoose.Types.ObjectId.isValid(id) && id !== String(userId))
      )
    );

    if (cleanMemberIds.length === 0) {
      return res.status(400).json({
        message: "Please select at least one member to create a group",
      });
    }

    // Creator is always a member and admin
    const allMembers = [userId, ...cleanMemberIds];

    let groupPic = "";
    if (req.file) {
      const uploadRes = await uploadToCloudinary(req.file);
      groupPic = uploadRes.secure_url;
    }

    const newGroup = await Group.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      groupPic,
      admin: userId,
      admins: [userId],
      members: allMembers,
    });

    await newGroup.populate("admin", "name profilePic email");
    await newGroup.populate("admins", "name profilePic email");
    await newGroup.populate("members", "name profilePic email");

    // Real-time broadcast to all members
    allMembers.forEach((mId) => {
      const sockIds = getReceiverSocketIds(String(mId));
      sockIds.forEach((sId) => {
        io.to(sId).emit("groupCreated", newGroup);
      });
    });

    return res.status(201).json({
      message: "Group created successfully",
      group: newGroup,
    });
  } catch (error) {
    console.error("Create group error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get all groups that the authenticated user belongs to
 */
export const getMyGroups = async (req, res) => {
  try {
    const userId = req.userId;
    const userObjectId = new mongoose.Types.ObjectId(String(userId));

    const groups = await Group.find({ members: userObjectId })
      .populate("admin", "name profilePic email")
      .populate("admins", "name profilePic email")
      .populate("members", "name profilePic email")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name profilePic" },
      })
      .sort({ updatedAt: -1 });

    // Calculate unread count for each group
    const groupsWithUnread = await Promise.all(
      groups.map(async (grp) => {
        const unreadCount = await Message.countDocuments({
          group: grp._id,
          sender: { $ne: userObjectId },
          "seenBy.user": { $ne: userObjectId },
        });

        return {
          ...grp.toObject(),
          unreadCount,
        };
      })
    );

    return res.status(200).json({ groups: groupsWithUnread });
  } catch (error) {
    console.error("Get groups error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get single group details
 */
export const getGroupDetails = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "Invalid group ID" });
    }

    const group = await Group.findById(groupId)
      .populate("admin", "name profilePic email")
      .populate("admins", "name profilePic email")
      .populate("members", "name profilePic email");

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Security: Only members can view details
    const isMember = group.members.some(
      (m) => String(m._id || m) === String(userId)
    );
    if (!isMember) {
      return res.status(403).json({ message: "Unauthorized: You are not a member of this group" });
    }

    return res.status(200).json({ group });
  } catch (error) {
    console.error("Get group details error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Update group details (Name, description, picture) - Admin only
 */
export const updateGroup = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.userId;
    const { name, description, removeGroupPic } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "Invalid group ID" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Security check: Only admins can edit group
    const isAdmin =
      String(group.admin) === String(userId) ||
      group.admins.some((aId) => String(aId) === String(userId));

    if (!isAdmin) {
      return res.status(403).json({ message: "Unauthorized: Only group admins can edit group info" });
    }

    if (name && typeof name === "string" && name.trim()) {
      group.name = name.trim();
    }
    if (description !== undefined) {
      group.description = String(description).trim();
    }

    if (removeGroupPic === "true" || removeGroupPic === true) {
      group.groupPic = "";
    } else if (req.file) {
      const uploadRes = await uploadToCloudinary(req.file);
      group.groupPic = uploadRes.secure_url;
    }

    await group.save();
    await group.populate("admin", "name profilePic email");
    await group.populate("admins", "name profilePic email");
    await group.populate("members", "name profilePic email");

    // Broadcast update to all group members
    group.members.forEach((m) => {
      const sIds = getReceiverSocketIds(String(m._id || m));
      sIds.forEach((sId) => {
        io.to(sId).emit("groupUpdated", group);
      });
    });

    return res.status(200).json({
      message: "Group updated successfully",
      group,
    });
  } catch (error) {
    console.error("Update group error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Add members to group - Admin only
 */
export const addMembers = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.userId;
    const { members: newMemberIds } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "Invalid group ID" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isAdmin =
      String(group.admin) === String(userId) ||
      group.admins.some((aId) => String(aId) === String(userId));

    if (!isAdmin) {
      return res.status(403).json({ message: "Unauthorized: Only admins can add members" });
    }

    let parsedMembers = [];
    try {
      parsedMembers =
        typeof newMemberIds === "string" ? JSON.parse(newMemberIds) : newMemberIds;
    } catch (e) {
      return res.status(400).json({ message: "Invalid members format" });
    }

    if (!Array.isArray(parsedMembers) || parsedMembers.length === 0) {
      return res.status(400).json({ message: "No members provided to add" });
    }

    const currentMemberSet = new Set(group.members.map((m) => String(m)));
    const addedUserIds = [];

    parsedMembers.forEach((mId) => {
      const idStr = String(mId);
      if (mongoose.Types.ObjectId.isValid(idStr) && !currentMemberSet.has(idStr)) {
        currentMemberSet.add(idStr);
        addedUserIds.push(new mongoose.Types.ObjectId(idStr));
      }
    });

    if (addedUserIds.length === 0) {
      return res.status(400).json({ message: "Selected users are already members" });
    }

    group.members.push(...addedUserIds);
    await group.save();
    await group.populate("admin", "name profilePic email");
    await group.populate("admins", "name profilePic email");
    await group.populate("members", "name profilePic email");

    // Broadcast groupUpdated and groupCreated to added users
    group.members.forEach((m) => {
      const sIds = getReceiverSocketIds(String(m._id || m));
      sIds.forEach((sId) => {
        io.to(sId).emit("groupUpdated", group);
      });
    });

    return res.status(200).json({
      message: "Members added successfully",
      group,
    });
  } catch (error) {
    console.error("Add members error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Remove member from group - Admin only
 */
export const removeMember = async (req, res) => {
  try {
    const { id: groupId, memberId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isAdmin =
      String(group.admin) === String(userId) ||
      group.admins.some((aId) => String(aId) === String(userId));

    if (!isAdmin) {
      return res.status(403).json({ message: "Unauthorized: Only admins can remove members" });
    }

    if (String(memberId) === String(group.admin)) {
      return res.status(400).json({ message: "Cannot remove primary group owner" });
    }

    group.members = group.members.filter((m) => String(m) !== String(memberId));
    group.admins = group.admins.filter((a) => String(a) !== String(memberId));
    await group.save();

    await group.populate("admin", "name profilePic email");
    await group.populate("admins", "name profilePic email");
    await group.populate("members", "name profilePic email");

    // Notify removed member
    const removedSockets = getReceiverSocketIds(String(memberId));
    removedSockets.forEach((sId) => {
      io.to(sId).emit("groupMemberRemoved", { groupId });
    });

    // Notify remaining members
    group.members.forEach((m) => {
      const sIds = getReceiverSocketIds(String(m._id || m));
      sIds.forEach((sId) => {
        io.to(sId).emit("groupUpdated", group);
      });
    });

    return res.status(200).json({
      message: "Member removed successfully",
      group,
    });
  } catch (error) {
    console.error("Remove member error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Leave group
 */
export const leaveGroup = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "Invalid group ID" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    group.members = group.members.filter((m) => String(m) !== String(userId));
    group.admins = group.admins.filter((a) => String(a) !== String(userId));

    if (group.members.length === 0) {
      // No members left -> delete group and messages
      await Group.findByIdAndDelete(groupId);
      await Message.deleteMany({ group: groupId });
      return res.status(200).json({ message: "Left and deleted empty group", groupId });
    }

    // If owner leaves, reassign owner to another admin or first member
    if (String(group.admin) === String(userId)) {
      group.admin = group.admins[0] || group.members[0];
      if (!group.admins.some((a) => String(a) === String(group.admin))) {
        group.admins.push(group.admin);
      }
    }

    await group.save();
    await group.populate("admin", "name profilePic email");
    await group.populate("admins", "name profilePic email");
    await group.populate("members", "name profilePic email");

    // Notify remaining members
    group.members.forEach((m) => {
      const sIds = getReceiverSocketIds(String(m._id || m));
      sIds.forEach((sId) => {
        io.to(sId).emit("groupUpdated", group);
      });
    });

    return res.status(200).json({ message: "Successfully left group", groupId });
  } catch (error) {
    console.error("Leave group error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
