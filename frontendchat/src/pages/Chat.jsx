import { useState, useEffect, useRef } from "react";
import API from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { useCall } from "../context/CallContext.jsx";
import VoiceMessagePlayer from "../components/VoiceMessagePlayer.jsx";
import VoiceRecorder from "../components/VoiceRecorder.jsx";
import { CreateGroupModal } from "../components/CreateGroupModal.jsx";
import { GroupInfoModal } from "../components/GroupInfoModal.jsx";
import {
  Search,
  Phone,
  Send,
  MessageSquare,
  User as UserIcon,
  Users,
  Plus,
  Info,
  Paperclip,
  X,
  FileText,
  Download,
  Check,
  CheckCheck,
  Reply,
  Edit2,
  Trash2,
  Smile,
  MoreVertical,
  Pin,
  PinOff,
  Video,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ChevronDown,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const EMOJI_OPTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

export const Chat = () => {
  const { authUser } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const { startCall, startGroupCall } = useCall();

  // Contacts & Direct Chats
  const [users, setUsers] = useState([]);
  const [unreadSenders, setUnreadSenders] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [lastMessages, setLastMessages] = useState({});
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);

  // Groups State
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("all"); // "all" | "unread" | "direct" | "groups"
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupUnread, setGroupUnread] = useState(new Set());

  // Conversation & Messages State
  const [messages, setMessages] = useState([]);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [text, setText] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  // File attachment state
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [failedUploadPayload, setFailedUploadPayload] = useState(null);
  const [fullScreenImage, setFullScreenImage] = useState(null);

  // Reply, Edit, Message Search, and Header menu state
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState(null);
  const [, setActiveMessageMenuId] = useState(null);

  // Right Side Info Panel / Drawer state
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const messagesEndRef = useRef(null);
  const chatScrollContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const selectedUserRef = useRef(selectedUser);
  const selectedGroupRef = useRef(selectedGroup);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  // Close message action menus and emoji pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".msg-action-menu-container")) {
        setActiveMessageMenuId(null);
      }
      if (!e.target.closest(".msg-reaction-picker-container")) {
        setActiveReactionMessageId(null);
      }
      if (!e.target.closest(".chat-header-menu-container")) {
        setShowChatMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleStartReply = (message) => {
    setReplyingTo(message);
    setActiveMessageMenuId(null);
    setActiveReactionMessageId(null);
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 50);
  };

  const myId = authUser?._id || authUser?.id;
  const getId = (value) => String(value?._id || value?.id || value || "");
  const selectedUserId = selectedUser ? getId(selectedUser) : null;
  const selectedGroupId = selectedGroup ? getId(selectedGroup._id) : null;

  // Monitor chat scroll position to toggle Scroll-to-bottom FAB
  const handleChatScroll = () => {
    const container = chatScrollContainerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 160;
    setShowScrollBottomBtn(!isNearBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch available contacts/users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const res = await API.get("/users");
        setUsers(res.data.users || []);
        if (res.data.unreadSenders && Array.isArray(res.data.unreadSenders)) {
          setUnreadSenders(new Set(res.data.unreadSenders));
        }
        if (res.data.lastMessages && typeof res.data.lastMessages === "object") {
          setLastMessages((prev) => ({
            ...res.data.lastMessages,
            ...prev,
          }));
        }
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  // Fetch user groups
  const fetchGroups = async () => {
    try {
      setLoadingGroups(true);
      const res = await API.get("/groups");
      const loaded = res.data.groups || [];
      setGroups(loaded);

      // Check which groups have unread messages for this user
      const unread = new Set();
      loaded.forEach((g) => {
        if (g.lastMessage && g.lastMessage.sender) {
          const sId = getId(g.lastMessage.sender);
          const seenBy = (g.lastMessage.seenBy || []).map(getId);
          if (sId !== getId(myId) && !seenBy.includes(getId(myId))) {
            unread.add(getId(g._id));
          }
        }
      });
      setGroupUnread(unread);
    } catch (err) {
      console.error("Failed to load groups:", err);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [myId]);

  // Handle switching to a direct user
  const handleSelectUser = (u) => {
    setSelectedGroup(null);
    setSelectedUser(u);
    setShowInfoDrawer(false);
  };

  // Handle switching to a group
  const handleSelectGroup = (g) => {
    setSelectedUser(null);
    setSelectedGroup(g);
    setShowInfoDrawer(false);
  };

  // Fetch direct messages when a contact is selected
  useEffect(() => {
    if (!selectedUserId) {
      if (!selectedGroup) {
        setMessages([]);
        setPinnedMessage(null);
        setIsOtherUserTyping(false);
        setReplyingTo(null);
        setEditingMessage(null);
        setMessageSearchQuery("");
        setShowMsgSearch(false);
      }
      return;
    }

    const targetId = selectedUserId;
    setPinnedMessage(null);
    setIsOtherUserTyping(false);
    setReplyingTo(null);
    setEditingMessage(null);
    setMessageSearchQuery("");
    setShowMsgSearch(false);

    // Remove notification dot immediately when receiver opens this conversation
    setUnreadSenders((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });

    const fetchMessages = async () => {
      try {
        setLoadingMessages(true);
        const res = await API.get(`/messages/${targetId}`);
        const loadedMessages = res.data.messages || [];
        setMessages(loadedMessages);
        setPinnedMessage(res.data.pinnedMessage || null);

        if (loadedMessages.length > 0) {
          setLastMessages((prev) => ({
            ...prev,
            [targetId]: loadedMessages[loadedMessages.length - 1],
          }));
        }

        // Mark incoming messages from target user as seen
        await API.put(`/messages/seen/${targetId}`).catch(() => {});
      } catch (err) {
        console.error("Failed to load direct messages:", err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedUserId]);

  // Fetch group messages when a group is selected
  useEffect(() => {
    if (!selectedGroupId) return;

    const gId = selectedGroupId;
    setPinnedMessage(null);
    setIsOtherUserTyping(false);
    setReplyingTo(null);
    setEditingMessage(null);
    setMessageSearchQuery("");
    setShowMsgSearch(false);

    // Remove group notification dot
    setGroupUnread((prev) => {
      const next = new Set(prev);
      next.delete(gId);
      return next;
    });

    const fetchGroupMessages = async () => {
      try {
        setLoadingMessages(true);
        const res = await API.get(`/messages/group/${gId}`);
        const loadedMessages = res.data.messages || [];
        setMessages(loadedMessages);

        // Mark group messages as seen
        await API.put(`/messages/group/${gId}/seen`).catch(() => {});
      } catch (err) {
        console.error("Failed to load group messages:", err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchGroupMessages();
  }, [selectedGroupId]);

  // Real-time message, group, typing, seen status, and reaction listeners
  useEffect(() => {
    if (!socket) return;

    const myUserId = getId(myId);

    // 1. Direct message handler
    const handleNewMessage = (newMessage) => {
      const senderId = getId(newMessage.sender);
      const receiverId = getId(newMessage.receiver);
      const otherUserId = senderId === myUserId ? receiverId : senderId;
      const currentSelectedId = selectedUserRef.current ? getId(selectedUserRef.current) : null;

      // Update last messages for sorting sidebar
      setLastMessages((prev) => ({
        ...prev,
        [otherUserId]: newMessage,
      }));

      // If receiver gets a new message from someone else, show notification dot
      if (receiverId === myUserId && currentSelectedId !== senderId) {
        setUnreadSenders((prev) => new Set(prev).add(senderId));
      }

      if (currentSelectedId && (senderId === currentSelectedId || receiverId === currentSelectedId)) {
        setMessages((prev) => {
          if (newMessage._id && prev.some((m) => getId(m._id) === getId(newMessage._id))) {
            return prev;
          }
          return [...prev, newMessage];
        });

        if (senderId === currentSelectedId) {
          setUnreadSenders((prev) => {
            const next = new Set(prev);
            next.delete(senderId);
            return next;
          });
          API.put(`/messages/seen/${currentSelectedId}`).catch(() => {});
        }
      }
    };

    // 2. Group message handler
    const handleNewGroupMessage = (newMessage) => {
      const gId = getId(newMessage.group);
      const senderId = getId(newMessage.sender);
      const currentGId = selectedGroupRef.current ? getId(selectedGroupRef.current._id) : null;

      // Update group list with latest message and move to top
      setGroups((prev) => {
        const found = prev.find((g) => getId(g._id) === gId);
        if (!found) return prev;
        const updated = { ...found, lastMessage: newMessage };
        return [updated, ...prev.filter((g) => getId(g._id) !== gId)];
      });

      if (currentGId && currentGId === gId) {
        setMessages((prev) => {
          if (newMessage._id && prev.some((m) => getId(m._id) === getId(newMessage._id))) {
            return prev;
          }
          return [...prev, newMessage];
        });

        if (senderId !== myUserId) {
          API.put(`/messages/group/${gId}/seen`).catch(() => {});
        }
      } else {
        if (senderId !== myUserId) {
          setGroupUnread((prev) => new Set(prev).add(gId));
        }
      }
    };

    // 3. Group created
    const handleGroupCreated = (newGroup) => {
      setGroups((prev) => [newGroup, ...prev.filter((g) => getId(g._id) !== getId(newGroup._id))]);
    };

    // 4. Group updated
    const handleGroupUpdated = (updatedGroup) => {
      setGroups((prev) =>
        prev.map((g) => (getId(g._id) === getId(updatedGroup._id) ? updatedGroup : g))
      );
      setSelectedGroup((prev) =>
        prev && getId(prev._id) === getId(updatedGroup._id) ? updatedGroup : prev
      );
    };

    // 5. Group member removed
    const handleGroupMemberRemoved = ({ groupId, memberId }) => {
      if (getId(memberId) === myUserId) {
        setGroups((prev) => prev.filter((g) => getId(g._id) !== getId(groupId)));
        setSelectedGroup((prev) => (prev && getId(prev._id) === getId(groupId) ? null : prev));
      } else {
        setGroups((prev) =>
          prev.map((g) =>
            getId(g._id) === getId(groupId)
              ? { ...g, members: (g.members || []).filter((m) => getId(m._id || m) !== getId(memberId)) }
              : g
          )
        );
        setSelectedGroup((prev) =>
          prev && getId(prev._id) === getId(groupId)
            ? { ...prev, members: (prev.members || []).filter((m) => getId(m._id || m) !== getId(memberId)) }
            : prev
        );
      }
    };

    // 6. Direct typing status
    const handleUserTyping = ({ senderId }) => {
      const currentSelectedId = selectedUserRef.current ? getId(selectedUserRef.current) : null;
      if (currentSelectedId && senderId === currentSelectedId) {
        setIsOtherUserTyping(true);
      }
    };

    const handleUserStoppedTyping = ({ senderId }) => {
      const currentSelectedId = selectedUserRef.current ? getId(selectedUserRef.current) : null;
      if (currentSelectedId && senderId === currentSelectedId) {
        setIsOtherUserTyping(false);
      }
    };

    // 7. Direct seen receipts
    const handleMessagesSeen = ({ seenBy }) => {
      const currentSelectedId = selectedUserRef.current ? getId(selectedUserRef.current) : null;
      if (currentSelectedId && seenBy === currentSelectedId) {
        setMessages((prev) =>
          prev.map((m) => (getId(m.sender) === myUserId ? { ...m, seen: true } : m))
        );
      }
    };

    // 8. Message update / delete / reactions
    const handleMessageUpdated = (updatedMessage) => {
      const targetId = getId(updatedMessage._id);
      setMessages((prev) =>
        prev.map((m) => (getId(m._id) === targetId ? updatedMessage : m))
      );
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => getId(m._id) !== getId(messageId)));
    };

    const handleMessageReaction = (updatedMessage) => {
      const targetId = getId(updatedMessage._id);
      setMessages((prev) =>
        prev.map((m) => (getId(m._id) === targetId ? updatedMessage : m))
      );
    };

    // 9. Cleared conversation
    const handleConversationCleared = ({ clearedBy }) => {
      const currentSelectedId = selectedUserRef.current ? getId(selectedUserRef.current) : null;
      if (currentSelectedId && (clearedBy === currentSelectedId || clearedBy === myUserId)) {
        setMessages([]);
      }
      if (clearedBy) {
        setLastMessages((prev) => {
          const next = { ...prev };
          delete next[getId(clearedBy)];
          return next;
        });
      }
    };

    // 10. User online status change
    const handleUserStatusChanged = ({ userId: statusUserId, isOnline: newIsOnline, lastSeen: newLastSeen }) => {
      const uId = getId(statusUserId);
      setUsers((prevUsers) =>
        prevUsers.map((u) => {
          if (getId(u) !== uId) return u;
          return {
            ...u,
            isOnline: newIsOnline,
            lastSeen: newLastSeen !== undefined ? newLastSeen : u.lastSeen,
          };
        })
      );

      setSelectedUser((prevSelected) => {
        if (prevSelected && getId(prevSelected) === uId) {
          return {
            ...prevSelected,
            isOnline: newIsOnline,
            lastSeen: newLastSeen !== undefined ? newLastSeen : prevSelected.lastSeen,
          };
        }
        return prevSelected;
      });
    };

    // 11. Pinned messages
    const handleMessagePinned = ({ message, sender, receiver }) => {
      const p1 = getId(sender || message.sender);
      const p2 = getId(receiver || message.receiver);
      const otherUserId = p1 === myUserId ? p2 : p1;
      const currentSelectedId = selectedUserRef.current ? getId(selectedUserRef.current) : null;

      if (currentSelectedId && otherUserId === currentSelectedId) {
        setPinnedMessage(message);
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            isPinned: getId(m._id) === getId(message._id),
          }))
        );
      }
    };

    const handleMessageUnpinned = ({ messageId, sender, receiver }) => {
      const p1 = getId(sender);
      const p2 = getId(receiver);
      const otherUserId = p1 === myUserId ? p2 : p1;
      const currentSelectedId = selectedUserRef.current ? getId(selectedUserRef.current) : null;

      if (currentSelectedId && (!otherUserId || otherUserId === currentSelectedId)) {
        setPinnedMessage((prev) => {
          if (!prev) return null;
          if (!messageId || getId(prev._id) === getId(messageId)) {
            return null;
          }
          return prev;
        });
        setMessages((prev) =>
          prev.map((m) => (!messageId || getId(m._id) === getId(messageId) ? { ...m, isPinned: false } : m))
        );
      }
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("newGroupMessage", handleNewGroupMessage);
    socket.on("groupCreated", handleGroupCreated);
    socket.on("groupUpdated", handleGroupUpdated);
    socket.on("groupMemberRemoved", handleGroupMemberRemoved);
    socket.on("userTyping", handleUserTyping);
    socket.on("userStoppedTyping", handleUserStoppedTyping);
    socket.on("messagesSeen", handleMessagesSeen);
    socket.on("messageUpdated", handleMessageUpdated);
    socket.on("messageDeleted", handleMessageDeleted);
    socket.on("messageReaction", handleMessageReaction);
    socket.on("conversationCleared", handleConversationCleared);
    socket.on("userStatusChanged", handleUserStatusChanged);
    socket.on("messagePinned", handleMessagePinned);
    socket.on("messageUnpinned", handleMessageUnpinned);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("newGroupMessage", handleNewGroupMessage);
      socket.off("groupCreated", handleGroupCreated);
      socket.off("groupUpdated", handleGroupUpdated);
      socket.off("groupMemberRemoved", handleGroupMemberRemoved);
      socket.off("userTyping", handleUserTyping);
      socket.off("userStoppedTyping", handleUserStoppedTyping);
      socket.off("messagesSeen", handleMessagesSeen);
      socket.off("messageUpdated", handleMessageUpdated);
      socket.off("messageDeleted", handleMessageDeleted);
      socket.off("messageReaction", handleMessageReaction);
      socket.off("conversationCleared", handleConversationCleared);
      socket.off("userStatusChanged", handleUserStatusChanged);
      socket.off("messagePinned", handleMessagePinned);
      socket.off("messageUnpinned", handleMessageUnpinned);
    };
  }, [socket, myId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, filePreview, isOtherUserTyping]);

  // Handle typing debounce for direct chat
  const handleTextChange = (e) => {
    setText(e.target.value);
    if (!socket || !selectedUser) return;

    const targetId = getId(selectedUser);
    socket.emit("typing", { receiverId: targetId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", { receiverId: targetId });
    }, 2000);
  };

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError(null);
    setFailedUploadPayload(null);

    if (file.size > 25 * 1024 * 1024) {
      setUploadError("File size exceeds 25MB limit. Please choose a smaller file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      const previewUrl = URL.createObjectURL(file);
      setFilePreview(previewUrl);
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setUploadProgress(0);
    setUploadError(null);
  };

  // Send message handler (supports direct and group chats)
  const handleSendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if ((!text.trim() && !selectedFile) || (!selectedUser && !selectedGroup) || sending) return;

    const isGroupMode = Boolean(selectedGroup);
    const targetId = isGroupMode ? getId(selectedGroup._id) : getId(selectedUser);
    const content = text.trim();
    const fileToSend = selectedFile;
    const currentReplyTo = replyingTo;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (socket && !isGroupMode) {
      socket.emit("stopTyping", { receiverId: targetId });
    }

    setUploadError(null);
    setFailedUploadPayload(null);
    setUploadProgress(0);
    setSending(true);

    try {
      let res;
      if (fileToSend) {
        const formData = new FormData();
        if (isGroupMode) {
          formData.append("group", targetId);
        } else {
          formData.append("receiver", targetId);
        }
        if (content) {
          formData.append("content", content);
        }
        if (currentReplyTo?._id) {
          formData.append("replyTo", currentReplyTo._id);
        }
        formData.append("file", fileToSend);

        res = await API.post("/messages/send", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(percentCompleted);
            }
          },
        });
      } else {
        const payload = {
          content,
          ...(isGroupMode ? { group: targetId } : { receiver: targetId }),
        };
        if (currentReplyTo?._id) {
          payload.replyTo = currentReplyTo._id;
        }
        res = await API.post("/messages/send", payload);
      }

      setText("");
      setReplyingTo(null);
      handleRemoveFile();

      // Optimistically append sent message
      setMessages((prev) => {
        if (res.data.data?._id && prev.some((m) => getId(m._id) === getId(res.data.data._id))) {
          return prev;
        }
        return [...prev, res.data.data];
      });

      if (isGroupMode) {
        setGroups((prev) =>
          prev.map((g) =>
            getId(g._id) === targetId ? { ...g, lastMessage: res.data.data } : g
          )
        );
      } else {
        setLastMessages((prev) => ({
          ...prev,
          [targetId]: res.data.data,
        }));
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      const errMsg =
        err.response?.data?.message ||
        "Failed to upload or send message. Please try again.";
      setUploadError(errMsg);
      setFailedUploadPayload({
        file: fileToSend,
        content,
        replyTo: currentReplyTo,
      });
    } finally {
      setSending(false);
      setUploadProgress(0);
    }
  };

  const handleRetryUpload = () => {
    if (!failedUploadPayload) return;
    if (failedUploadPayload.file) setSelectedFile(failedUploadPayload.file);
    if (failedUploadPayload.content) setText(failedUploadPayload.content);
    if (failedUploadPayload.replyTo) setReplyingTo(failedUploadPayload.replyTo);
    handleSendMessage();
  };

  // Send voice message handler (direct or group)
  const handleSendVoiceMessage = async ({ file, duration, waveform }) => {
    if ((!selectedUser && !selectedGroup) || sending) return;
    const isGroupMode = Boolean(selectedGroup);
    const targetId = isGroupMode ? getId(selectedGroup._id) : getId(selectedUser);
    const currentReplyTo = replyingTo;

    setUploadError(null);
    setFailedUploadPayload(null);
    setSending(true);

    try {
      const formData = new FormData();
      if (isGroupMode) {
        formData.append("group", targetId);
      } else {
        formData.append("receiver", targetId);
      }
      formData.append("file", file);
      formData.append("fileType", "voice");
      formData.append("duration", duration);
      formData.append("waveform", JSON.stringify(waveform));
      if (currentReplyTo?._id) {
        formData.append("replyTo", currentReplyTo._id);
      }

      const res = await API.post("/messages/send", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setReplyingTo(null);

      setMessages((prev) => {
        if (res.data.data?._id && prev.some((m) => getId(m._id) === getId(res.data.data._id))) {
          return prev;
        }
        return [...prev, res.data.data];
      });

      if (isGroupMode) {
        setGroups((prev) =>
          prev.map((g) =>
            getId(g._id) === targetId ? { ...g, lastMessage: res.data.data } : g
          )
        );
      } else {
        setLastMessages((prev) => ({
          ...prev,
          [targetId]: res.data.data,
        }));
      }
    } catch (err) {
      console.error("Failed to send voice message:", err);
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Failed to send voice message. Please try again.";
      setUploadError(serverMsg);
    } finally {
      setSending(false);
    }
  };

  // Edit message handler
  const handleStartEdit = (message) => {
    setEditingMessage(message);
    setEditContent(message.content || "");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingMessage || !editContent.trim()) return;

    try {
      const res = await API.put(`/messages/${editingMessage._id}`, {
        content: editContent.trim(),
      });
      const updated = res.data.data;
      setMessages((prev) =>
        prev.map((m) => (getId(m._id) === getId(updated._id) ? updated : m))
      );
      setEditingMessage(null);
      setEditContent("");
    } catch (err) {
      console.error("Failed to edit message:", err);
      alert(err.response?.data?.message || "Failed to update message.");
    }
  };

  // Delete message handler
  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;

    try {
      await API.delete(`/messages/${messageId}`);
      setMessages((prev) => prev.filter((m) => getId(m._id) !== getId(messageId)));
      setPinnedMessage((prev) => (prev && getId(prev._id) === getId(messageId) ? null : prev));
    } catch (err) {
      console.error("Failed to delete message:", err);
      alert(err.response?.data?.message || "Failed to delete message.");
    }
  };

  // Pin / Unpin handlers
  const handlePinMessage = async (messageId) => {
    try {
      const res = await API.put(`/messages/${messageId}/pin`);
      const pinned = res.data.data;
      setPinnedMessage(pinned);
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          isPinned: getId(m._id) === getId(pinned._id),
        }))
      );
    } catch (err) {
      console.error("Failed to pin message:", err);
      alert(err.response?.data?.message || "Failed to pin message.");
    }
  };

  const handleUnpinMessage = async (messageId) => {
    if (!window.confirm("Are you sure you want to unpin this message?")) return;

    try {
      await API.put(`/messages/${messageId}/unpin`);
      setPinnedMessage(null);
      setMessages((prev) =>
        prev.map((m) => (getId(m._id) === getId(messageId) ? { ...m, isPinned: false } : m))
      );
    } catch (err) {
      console.error("Failed to unpin message:", err);
      alert(err.response?.data?.message || "Failed to unpin message.");
    }
  };

  // Scroll to message
  const handleScrollToMessage = (messageId) => {
    if (!messageId) return;
    const el = document.getElementById(`message-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-4", "ring-emerald-400", "bg-emerald-950/40", "rounded-2xl", "transition-all", "duration-500");
      setTimeout(() => {
        el.classList.remove("ring-4", "ring-emerald-400", "bg-emerald-950/40");
      }, 2000);
    }
  };

  // Emoji reaction handler
  const handleReactToMessage = async (messageId, emoji) => {
    try {
      setActiveReactionMessageId(null);
      const res = await API.post(`/messages/${messageId}/react`, { emoji });
      const updated = res.data.data;
      setMessages((prev) =>
        prev.map((m) => (getId(m._id) === getId(updated._id) ? updated : m))
      );
    } catch (err) {
      console.error("Failed to react to message:", err);
    }
  };

  // Clear conversation handler
  const handleClearConversation = async () => {
    if (!selectedUser) return;
    if (!window.confirm(`Clear all messages with ${selectedUser.name}? This cannot be undone.`)) return;

    try {
      const targetId = getId(selectedUser);
      await API.delete(`/messages/conversation/${targetId}`);
      setMessages([]);
      setPinnedMessage(null);
      setLastMessages((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      setShowChatMenu(false);
    } catch (err) {
      console.error("Failed to clear conversation:", err);
      alert(err.response?.data?.message || "Failed to clear conversation.");
    }
  };

  // Filter contacts by search query & sort by recent message
  const filteredUsers = users
    .filter(
      (u) =>
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aTime = new Date(lastMessages[getId(a)]?.createdAt || 0).getTime();
      const bTime = new Date(lastMessages[getId(b)]?.createdAt || 0).getTime();
      if (bTime !== aTime) {
        return bTime - aTime;
      }
      return (a.name || "").localeCompare(b.name || "");
    });

  // Filter groups by search query
  const filteredGroups = groups
    .filter((g) => g.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aTime = new Date(a.lastMessage?.createdAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.lastMessage?.createdAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

  // Unified "All" conversation list sorted chronologically
  const unifiedConversations = [
    ...filteredUsers.map((u) => ({
      type: "user",
      id: getId(u),
      data: u,
      time: new Date(lastMessages[getId(u)]?.createdAt || 0).getTime(),
    })),
    ...filteredGroups.map((g) => ({
      type: "group",
      id: getId(g._id),
      data: g,
      time: new Date(g.lastMessage?.createdAt || g.createdAt || 0).getTime(),
    })),
  ].sort((a, b) => b.time - a.time);

  // Filter messages in open conversation by query
  const displayedMessages = messageSearchQuery.trim()
    ? messages.filter((m) =>
        m.content?.toLowerCase().includes(messageSearchQuery.toLowerCase()) ||
        m.fileName?.toLowerCase().includes(messageSearchQuery.toLowerCase())
      )
    : messages;

  // Extract shared media (images, videos, docs) for the info drawer
  const sharedMediaMessages = messages.filter((m) => m.fileUrl);

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatConversationTime = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today - targetDay) / (1000 * 60 * 60 * 24));

    const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });

    if (diffDays === 0) {
      return timeStr;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: "short" });
    } else {
      return d.toLocaleDateString([], { day: "numeric", month: "short" });
    }
  };

  const formatDateHeader = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today - targetDay) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: "long" });
    }
    return d.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
  };

  const formatLastSeen = (dateString) => {
    if (!dateString) return "Offline";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Offline";

    const now = new Date();
    const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today - targetDay) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Last seen today at ${timeStr}`;
    } else if (diffDays === 1) {
      return `Last seen yesterday at ${timeStr}`;
    } else {
      const datePart = d.toLocaleDateString([], { day: "numeric", month: "short" });
      return `Last seen ${datePart} at ${timeStr}`;
    }
  };

  const isSelectedOnline = selectedUser ? onlineUsers.includes(getId(selectedUser)) : false;

  // Group messages by date for date separators
  const messagesWithDateSeparators = [];
  let lastDateStr = null;
  displayedMessages.forEach((msg) => {
    const msgDate = new Date(msg.createdAt).toDateString();
    if (msgDate !== lastDateStr) {
      messagesWithDateSeparators.push({
        isDateSeparator: true,
        date: msg.createdAt,
        id: `date-sep-${msgDate}`,
      });
      lastDateStr = msgDate;
    }
    messagesWithDateSeparators.push(msg);
  });

  return (
    <div className="h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] flex bg-[var(--bg-app)] overflow-hidden transition-colors">
      {/* ======================================================== */}
      {/* 1. LEFT SIDEBAR: Conversations List & Filters           */}
      {/* ======================================================== */}
      <aside
        className={`w-full md:w-80 lg:w-96 border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] flex flex-col shrink-0 ${
          selectedUser || selectedGroup ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Top Header / Actions in Sidebar */}
        <div className="p-3.5 pb-2.5 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--text-primary)]">Messages</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
              {users.length + groups.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateGroup(true)}
            className="p-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title="Create new group"
            aria-label="Create new group"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Group</span>
          </button>
        </div>

        {/* Filter Pills Tabs: All, Unread, Direct, Groups (WhatsApp/Telegram style) */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-sidebar)] border-b border-[var(--border-subtle)] overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSidebarTab("all")}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              sidebarTab === "all"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            All
          </button>

          <button
            type="button"
            onClick={() => setSidebarTab("unread")}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              sidebarTab === "unread"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <span>Unread</span>
            {unreadSenders.size + groupUnread.size > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-[10px] text-white font-bold leading-none">
                {unreadSenders.size + groupUnread.size}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSidebarTab("direct")}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              sidebarTab === "direct"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <UserIcon className="h-3 w-3" />
            <span>Direct</span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarTab("groups")}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              sidebarTab === "groups"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <Users className="h-3 w-3" />
            <span>Groups</span>
          </button>
        </div>

        {/* Search Bar with clear button */}
        <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-0.5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List Scroll Area */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
          {loadingUsers && loadingGroups ? (
            <div className="p-8 text-center text-xs text-[var(--text-secondary)] flex flex-col items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              <span>Loading conversations...</span>
            </div>
          ) : sidebarTab === "groups" ? (
            /* Groups Only */
            filteredGroups.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-secondary)]">No groups found</div>
            ) : (
              filteredGroups.map((g) => renderGroupItem(g))
            )
          ) : sidebarTab === "direct" ? (
            /* Direct Contacts Only */
            filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-secondary)]">No contacts found</div>
            ) : (
              filteredUsers.map((u) => renderUserItem(u))
            )
          ) : sidebarTab === "unread" ? (
            /* Unread Conversations Only */
            unreadSenders.size === 0 && groupUnread.size === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-secondary)] flex flex-col items-center">
                <CheckCheck className="h-8 w-8 text-emerald-500/50 mb-2" />
                <p className="font-semibold text-[var(--text-primary)]">All caught up!</p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">No unread messages</p>
              </div>
            ) : (
              unifiedConversations
                .filter((item) =>
                  item.type === "user" ? unreadSenders.has(item.id) : groupUnread.has(item.id)
                )
                .map((item) =>
                  item.type === "user" ? renderUserItem(item.data) : renderGroupItem(item.data)
                )
            )
          ) : (
            /* "All" Tab: Unified View */
            unifiedConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-secondary)]">No conversations yet</div>
            ) : (
              unifiedConversations.map((item) =>
                item.type === "user" ? renderUserItem(item.data) : renderGroupItem(item.data)
              )
            )
          )}
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. MAIN CHAT PANEL                                       */}
      {/* ======================================================== */}
      <main
        className={`flex-1 flex flex-col bg-[var(--bg-chat)] relative overflow-hidden ${
          !selectedUser && !selectedGroup ? "hidden md:flex" : "flex"
        }`}
      >
        {selectedGroup ? (
          /* Group Active View */
          renderGroupChat()
        ) : selectedUser ? (
          /* Direct Active View */
          renderDirectChat()
        ) : (
          /* Empty State when no conversation selected */
          renderEmptyState()
        )}
      </main>

      {/* ======================================================== */}
      {/* 3. OPTIONAL RIGHT INFORMATION PANEL (DRAWER)             */}
      {/* ======================================================== */}
      {showInfoDrawer && (selectedUser || selectedGroup) && (
        <aside className="w-80 lg:w-96 border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col z-20 shrink-0 shadow-2xl animate-in slide-in-from-right duration-200">
          {renderInfoDrawerContent()}
        </aside>
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        availableUsers={users}
        onGroupCreated={(newG) => {
          setGroups((prev) => [newG, ...prev.filter((g) => getId(g._id) !== getId(newG._id))]);
          setSelectedGroup(newG);
          setSelectedUser(null);
          setShowCreateGroup(false);
          setSidebarTab("groups");
        }}
      />

      {/* Group Info Modal */}
      <GroupInfoModal
        isOpen={showGroupInfo}
        onClose={() => setShowGroupInfo(false)}
        group={selectedGroup}
        availableUsers={users}
        onGroupUpdated={(upd) => {
          setSelectedGroup(upd);
          setGroups((prev) => prev.map((g) => (getId(g._id) === getId(upd._id) ? upd : g)));
        }}
        onGroupLeft={(gId) => {
          setSelectedGroup(null);
          setGroups((prev) => prev.filter((g) => getId(g._id) !== getId(gId)));
          setShowGroupInfo(false);
        }}
      />

      {/* Full-screen Image Viewer Lightbox */}
      {fullScreenImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setFullScreenImage(null)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="absolute top-4 inset-x-4 flex items-center justify-between text-white z-10">
            <span className="text-sm font-semibold truncate max-w-md drop-shadow">
              {fullScreenImage.name}
            </span>
            <div className="flex items-center gap-3">
              <a
                href={fullScreenImage.url}
                download={fullScreenImage.name || "image"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors"
                title="Download full size"
              >
                <Download className="h-5 w-5" />
              </a>
              <button
                type="button"
                onClick={() => setFullScreenImage(null)}
                className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
                title="Close viewer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] flex items-center justify-center overflow-hidden"
          >
            <img
              src={fullScreenImage.url}
              alt={fullScreenImage.name}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );

  // ========================================================
  // RENDER HELPERS: List Items & Views
  // ========================================================

  function renderUserItem(u) {
    const uId = getId(u);
    const isSelected = selectedUser && getId(selectedUser) === uId;
    const isOnline = onlineUsers.includes(uId);
    const hasUnread = unreadSenders.has(uId);
    const lastMsg = lastMessages[uId];
    const isMine = lastMsg && getId(lastMsg.sender) === getId(myId);

    return (
      <button
        key={uId}
        type="button"
        onClick={() => handleSelectUser(u)}
        className={`w-full p-3.5 flex items-center gap-3 text-left transition-colors cursor-pointer relative ${
          isSelected
            ? "bg-[var(--bg-active)] border-l-3 border-emerald-500"
            : "hover:bg-[var(--bg-hover)]"
        }`}
      >
        <div className="relative shrink-0">
          <div className="h-11 w-11 rounded-full bg-[var(--bg-input)] text-emerald-500 font-semibold flex items-center justify-center border border-[var(--border-subtle)] text-sm overflow-hidden shadow-sm">
            {u.profilePic ? (
              <img src={u.profilePic} alt={u.name} className="h-full w-full object-cover" />
            ) : u.name ? (
              u.name[0].toUpperCase()
            ) : (
              <UserIcon className="h-5 w-5" />
            )}
          </div>
          {isOnline && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[var(--bg-sidebar)]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs font-bold text-[var(--text-primary)] truncate">{u.name}</p>
            <span
              className={`text-[10px] shrink-0 font-medium ${
                hasUnread ? "text-emerald-500 font-bold" : "text-[var(--text-secondary)]"
              }`}
            >
              {lastMsg?.createdAt ? formatConversationTime(lastMsg.createdAt) : isOnline ? "Online" : ""}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p
              className={`text-[11px] truncate flex items-center gap-1 ${
                hasUnread ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-secondary)]"
              }`}
            >
              {isMine && (
                <span className="shrink-0 inline-flex">
                  {lastMsg.seen ? (
                    <CheckCheck className="h-3 w-3 text-sky-400" />
                  ) : (
                    <Check className="h-3 w-3 text-[var(--text-secondary)]" />
                  )}
                </span>
              )}
              <span className="truncate">
                {lastMsg
                  ? lastMsg.content ||
                    (lastMsg.fileType === "voice" || lastMsg.fileType === "audio"
                      ? "🎤 Voice message"
                      : lastMsg.fileType === "image"
                      ? "📷 Photo"
                      : lastMsg.fileType === "video"
                      ? "🎥 Video"
                      : "📎 Attachment")
                  : u.email}
              </span>
            </p>

            {hasUnread && (
              <span className="h-4.5 min-w-[18px] px-1 rounded-full bg-emerald-500 text-[10px] text-white font-bold flex items-center justify-center shrink-0">
                1
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }

  function renderGroupItem(g) {
    const gId = getId(g._id);
    const isSelected = selectedGroup && getId(selectedGroup._id) === gId;
    const hasUnread = groupUnread.has(gId);
    const lastMsg = g.lastMessage;
    const isMine = lastMsg && getId(lastMsg.sender) === getId(myId);

    return (
      <button
        key={gId}
        type="button"
        onClick={() => handleSelectGroup(g)}
        className={`w-full p-3.5 flex items-center gap-3 text-left transition-colors cursor-pointer relative ${
          isSelected
            ? "bg-[var(--bg-active)] border-l-3 border-emerald-500"
            : "hover:bg-[var(--bg-hover)]"
        }`}
      >
        <div className="relative shrink-0">
          <div className="h-11 w-11 rounded-full bg-[var(--bg-input)] text-emerald-500 font-semibold flex items-center justify-center border border-[var(--border-subtle)] text-sm overflow-hidden shadow-sm">
            {g.groupPic ? (
              <img src={g.groupPic} alt={g.name} className="h-full w-full object-cover" />
            ) : (
              <Users className="h-5 w-5" />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs font-bold text-[var(--text-primary)] truncate">{g.name}</p>
            <span
              className={`text-[10px] shrink-0 font-medium ${
                hasUnread ? "text-emerald-500 font-bold" : "text-[var(--text-secondary)]"
              }`}
            >
              {lastMsg?.createdAt
                ? formatConversationTime(lastMsg.createdAt)
                : `${g.members?.length || 0} members`}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p
              className={`text-[11px] truncate flex items-center gap-1 ${
                hasUnread ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-secondary)]"
              }`}
            >
              {isMine && (
                <span className="shrink-0 inline-flex">
                  <Check className="h-3 w-3 text-[var(--text-secondary)]" />
                </span>
              )}
              <span className="truncate">
                {lastMsg
                  ? (lastMsg.sender?.name ? `${lastMsg.sender.name}: ` : "") +
                    (lastMsg.content ||
                      (lastMsg.fileType === "voice" || lastMsg.fileType === "audio"
                        ? "🎤 Voice message"
                        : lastMsg.fileType === "image"
                        ? "📷 Photo"
                        : "📎 Attachment"))
                  : g.description || `${g.members?.length || 0} members`}
              </span>
            </p>

            {hasUnread && (
              <span className="h-4.5 min-w-[18px] px-1 rounded-full bg-emerald-500 text-[10px] text-white font-bold flex items-center justify-center shrink-0">
                1
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }

  // ========================================================
  // DIRECT CHAT VIEW
  // ========================================================
  function renderDirectChat() {
    return (
      <>
        {/* Chat Header */}
        <div className="h-14 sm:h-16 border-b border-[var(--border-subtle)] px-4 sm:px-6 flex items-center justify-between bg-[var(--bg-header)] backdrop-blur-md relative z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Back button on mobile */}
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
              className="md:hidden p-1.5 -ml-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            {/* Avatar (Clickable to open right info drawer) */}
            <div
              onClick={() => setShowInfoDrawer((prev) => !prev)}
              className="relative cursor-pointer shrink-0"
              title="View contact info"
            >
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-[var(--bg-input)] text-emerald-500 font-bold flex items-center justify-center border border-[var(--border-subtle)] text-xs sm:text-sm overflow-hidden">
                {selectedUser.profilePic ? (
                  <img
                    src={selectedUser.profilePic}
                    alt={selectedUser.name}
                    className="h-full w-full object-cover"
                  />
                ) : selectedUser.name ? (
                  selectedUser.name[0].toUpperCase()
                ) : (
                  <UserIcon className="h-4 w-4" />
                )}
              </div>
              {isSelectedOnline && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[var(--bg-header)]" />
              )}
            </div>

            {/* User Title & Status */}
            <div
              onClick={() => setShowInfoDrawer((prev) => !prev)}
              className="cursor-pointer min-w-0"
            >
              <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
                {selectedUser.name}
              </h3>
              {isOtherUserTyping ? (
                <span className="text-[11px] text-emerald-500 font-semibold animate-pulse">
                  typing...
                </span>
              ) : isSelectedOnline ? (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Online</span>
                </div>
              ) : (
                <span className="text-[11px] text-[var(--text-secondary)] truncate block">
                  {formatLastSeen(selectedUser.lastSeen)}
                </span>
              )}
            </div>
          </div>

          {/* Chat Header Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => startCall({ targetUser: selectedUser, type: "voice" })}
              className="p-2 sm:p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-emerald-500 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              title="Voice call"
              aria-label="Start voice call"
            >
              <Phone className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </button>

            <button
              type="button"
              onClick={() => startCall({ targetUser: selectedUser, type: "video" })}
              className="p-2 sm:p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-emerald-500 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              title="Video call"
              aria-label="Start video call"
            >
              <Video className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowMsgSearch((prev) => !prev)}
              className={`p-2 sm:p-2.5 rounded-xl transition-colors cursor-pointer ${
                showMsgSearch
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
              title="Search in conversation"
              aria-label="Search messages"
            >
              <Search className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowInfoDrawer((prev) => !prev)}
              className={`p-2 sm:p-2.5 rounded-xl transition-colors cursor-pointer hidden sm:flex ${
                showInfoDrawer
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
              title="Contact info & shared media"
              aria-label="Contact info"
            >
              <Info className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </button>

            <div className="relative chat-header-menu-container">
              <button
                type="button"
                onClick={() => setShowChatMenu((prev) => !prev)}
                className="p-2 sm:p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                title="Options"
                aria-label="Conversation options"
              >
                <MoreVertical className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </button>

              {showChatMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl py-1.5 z-30 animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInfoDrawer(true);
                      setShowChatMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2.5 cursor-pointer"
                  >
                    <Info className="h-3.5 w-3.5" />
                    Contact details
                  </button>
                  <button
                    type="button"
                    onClick={handleClearConversation}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear conversation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Message Search Bar */}
        {showMsgSearch && (
          <div className="px-4 sm:px-6 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex items-center gap-2 animate-in fade-in">
            <Search className="h-3.5 w-3.5 text-[var(--text-secondary)] shrink-0" />
            <input
              type="text"
              placeholder="Search in this chat..."
              value={messageSearchQuery}
              onChange={(e) => setMessageSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none"
              autoFocus
            />
            {messageSearchQuery && (
              <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                {displayedMessages.length} results
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setMessageSearchQuery("");
                setShowMsgSearch(false);
              }}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Pinned Message Banner */}
        {pinnedMessage && (
          <div
            onClick={() => handleScrollToMessage(getId(pinnedMessage._id))}
            className="px-4 sm:px-6 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-emerald-500/15 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Pin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="font-bold text-emerald-500 shrink-0">Pinned:</span>
              <p className="truncate text-[var(--text-primary)] text-xs">
                {pinnedMessage.fileType === "voice"
                  ? "🎤 Voice message"
                  : pinnedMessage.content || "Attachment"}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleUnpinMessage(getId(pinnedMessage._id));
              }}
              className="text-[var(--text-secondary)] hover:text-rose-400 transition-colors p-1 cursor-pointer shrink-0"
              title="Unpin message"
            >
              <PinOff className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Messages Stream */}
        <div
          ref={chatScrollContainerRef}
          onScroll={handleChatScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 chat-wallpaper relative"
        >
          {loadingMessages ? (
            <div className="h-full flex items-center justify-center text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                <span>Loading messages...</span>
              </div>
            </div>
          ) : displayedMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--text-secondary)]">
              <div className="h-14 w-14 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-3 shadow-lg">
                <MessageSquare className="h-7 w-7" />
              </div>
              <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">
                Say hello to {selectedUser.name}!
              </h4>
              <p className="text-xs max-w-xs text-[var(--text-secondary)]">
                Messages are protected with real-time end-to-end encryption.
              </p>
            </div>
          ) : (
            messagesWithDateSeparators.map((item, idx) => {
              if (item.isDateSeparator) {
                return (
                  <div key={item.id} className="flex justify-center my-3">
                    <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] shadow-sm">
                      {formatDateHeader(item.date)}
                    </span>
                  </div>
                );
              }
              return renderMessageBubble(item, idx, false);
            })
          )}

          {/* Typing Indicator inside chat stream */}
          {isOtherUserTyping && (
            <div className="flex items-center gap-2 animate-in fade-in">
              <div className="h-7 w-7 rounded-full bg-[var(--bg-input)] text-emerald-500 text-xs flex items-center justify-center border border-[var(--border-subtle)] shrink-0">
                {selectedUser.name?.[0]?.toUpperCase()}
              </div>
              <div className="px-3.5 py-2 rounded-2xl rounded-bl-xs bg-[var(--bubble-in)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] flex items-center gap-1.5 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll To Bottom FAB */}
        {showScrollBottomBtn && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-20 right-6 z-20 h-10 w-10 rounded-full bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Scroll to bottom"
            aria-label="Scroll to latest message"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}

        {/* Input Composer Bar */}
        {renderComposer(false)}
      </>
    );
  }

  // ========================================================
  // GROUP CHAT VIEW
  // ========================================================
  function renderGroupChat() {
    return (
      <>
        {/* Group Header */}
        <div className="h-14 sm:h-16 border-b border-[var(--border-subtle)] px-4 sm:px-6 flex items-center justify-between bg-[var(--bg-header)] backdrop-blur-md relative z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedGroup(null)}
              className="md:hidden p-1.5 -ml-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div
              onClick={() => setShowInfoDrawer((prev) => !prev)}
              className="relative cursor-pointer shrink-0"
              title="View group info"
            >
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-[var(--bg-input)] text-emerald-500 font-bold flex items-center justify-center border border-[var(--border-subtle)] text-xs sm:text-sm overflow-hidden">
                {selectedGroup.groupPic ? (
                  <img
                    src={selectedGroup.groupPic}
                    alt={selectedGroup.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </div>
            </div>

            <div
              onClick={() => setShowInfoDrawer((prev) => !prev)}
              className="cursor-pointer min-w-0"
            >
              <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
                {selectedGroup.name}
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)] truncate">
                {selectedGroup.members?.length || 0} participants
              </p>
            </div>
          </div>

          {/* Group Header Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => startGroupCall({ group: selectedGroup, type: "voice" })}
              className="p-2 sm:p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-emerald-500 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              title="Group voice call"
              aria-label="Start group voice call"
            >
              <Phone className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </button>

            <button
              type="button"
              onClick={() => startGroupCall({ group: selectedGroup, type: "video" })}
              className="p-2 sm:p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-emerald-500 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              title="Group video call"
              aria-label="Start group video call"
            >
              <Video className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowMsgSearch((prev) => !prev)}
              className={`p-2 sm:p-2.5 rounded-xl transition-colors cursor-pointer ${
                showMsgSearch
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
              title="Search in group chat"
              aria-label="Search group messages"
            >
              <Search className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowInfoDrawer((prev) => !prev)}
              className={`p-2 sm:p-2.5 rounded-xl transition-colors cursor-pointer ${
                showInfoDrawer
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
              title="Group members & settings"
              aria-label="Group settings"
            >
              <Info className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </button>
          </div>
        </div>

        {/* Message Search Bar */}
        {showMsgSearch && (
          <div className="px-4 sm:px-6 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex items-center gap-2 animate-in fade-in">
            <Search className="h-3.5 w-3.5 text-[var(--text-secondary)] shrink-0" />
            <input
              type="text"
              placeholder="Search in this group..."
              value={messageSearchQuery}
              onChange={(e) => setMessageSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none"
              autoFocus
            />
            {messageSearchQuery && (
              <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                {displayedMessages.length} results
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setMessageSearchQuery("");
                setShowMsgSearch(false);
              }}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Messages Stream */}
        <div
          ref={chatScrollContainerRef}
          onScroll={handleChatScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 chat-wallpaper relative"
        >
          {loadingMessages ? (
            <div className="h-full flex items-center justify-center text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                <span>Loading group messages...</span>
              </div>
            </div>
          ) : displayedMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--text-secondary)]">
              <div className="h-14 w-14 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-3 shadow-lg">
                <Users className="h-7 w-7" />
              </div>
              <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">
                Welcome to {selectedGroup.name}
              </h4>
              <p className="text-xs max-w-xs text-[var(--text-secondary)]">
                Send a message, file, or voice note to chat with group members.
              </p>
            </div>
          ) : (
            messagesWithDateSeparators.map((item, idx) => {
              if (item.isDateSeparator) {
                return (
                  <div key={item.id} className="flex justify-center my-3">
                    <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] shadow-sm">
                      {formatDateHeader(item.date)}
                    </span>
                  </div>
                );
              }
              return renderMessageBubble(item, idx, true);
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll To Bottom FAB */}
        {showScrollBottomBtn && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-20 right-6 z-20 h-10 w-10 rounded-full bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Scroll to bottom"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}

        {/* Input Composer Bar */}
        {renderComposer(true)}
      </>
    );
  }

  // ========================================================
  // MESSAGE BUBBLE RENDERER
  // ========================================================
  function renderMessageBubble(m, index, isGroup) {
    const mId = getId(m._id);
    const isMine = getId(m.sender) === getId(myId);
    const isThisPinned = m.isPinned || (pinnedMessage && getId(pinnedMessage._id) === mId);
    const senderName = isMine
      ? "You"
      : m.sender?.name || (isGroup ? "Member" : selectedUser?.name || "User");
    const senderPic = isMine
      ? authUser?.profilePic
      : m.sender?.profilePic || (!isGroup ? selectedUser?.profilePic : null);

    return (
      <div
        key={mId || index}
        id={`message-${mId}`}
        className={`flex items-end gap-2 group relative w-full ${
          isMine ? "justify-end" : "justify-start"
        }`}
      >
        {/* Avatar for other group participants */}
        {!isMine && isGroup && (
          <div
            className="h-7 w-7 rounded-full bg-[var(--bg-input)] text-emerald-500 font-semibold text-[11px] flex items-center justify-center border border-[var(--border-subtle)] shrink-0 overflow-hidden mb-1 shadow-sm"
            title={senderName}
          >
            {senderPic ? (
              <img src={senderPic} alt={senderName} className="h-full w-full object-cover" />
            ) : (
              senderName[0]?.toUpperCase() || <UserIcon className="h-3.5 w-3.5" />
            )}
          </div>
        )}

        <div className="relative max-w-[85%] sm:max-w-md">
          {/* Quick Action Toolbar on Hover */}
          <div
            className={`absolute -top-7 ${
              isMine ? "right-0" : "left-0"
            } hidden group-hover:flex items-center gap-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl px-1.5 py-0.5 shadow-xl z-10 transition-opacity`}
          >
            <button
              type="button"
              onClick={() => {
                setActiveReactionMessageId(
                  activeReactionMessageId === mId ? null : mId
                );
                setActiveMessageMenuId(null);
              }}
              className="p-1 text-[var(--text-secondary)] hover:text-amber-400 transition-colors cursor-pointer"
              title="React with emoji"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleStartReply(m)}
              className="p-1 text-[var(--text-secondary)] hover:text-emerald-400 transition-colors cursor-pointer"
              title="Reply"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>

            {!isGroup && (
              <button
                type="button"
                onClick={() => {
                  if (isThisPinned) {
                    handleUnpinMessage(mId);
                  } else {
                    handlePinMessage(mId);
                  }
                }}
                className={`p-1 transition-colors cursor-pointer ${
                  isThisPinned
                    ? "text-amber-400 hover:text-amber-300"
                    : "text-[var(--text-secondary)] hover:text-emerald-400"
                }`}
                title={isThisPinned ? "Unpin message" : "Pin message"}
              >
                {isThisPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              </button>
            )}

            {isMine && m.content && (
              <button
                type="button"
                onClick={() => handleStartEdit(m)}
                className="p-1 text-[var(--text-secondary)] hover:text-emerald-400 transition-colors cursor-pointer"
                title="Edit message"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}

            {isMine && (
              <button
                type="button"
                onClick={() => handleDeleteMessage(mId)}
                className="p-1 text-[var(--text-secondary)] hover:text-rose-400 transition-colors cursor-pointer"
                title="Delete message"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Floating Emoji Picker Popover */}
          {activeReactionMessageId === mId && (
            <div
              className={`msg-reaction-picker-container absolute -top-12 ${
                isMine ? "right-0" : "left-0"
              } bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-full px-2 py-1 shadow-2xl flex items-center gap-1.5 z-30 animate-in fade-in zoom-in-95`}
            >
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReactToMessage(mId, emoji)}
                  className="hover:scale-130 transition-transform p-1 text-base cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Quoted Message / Reply Preview Banner */}
          {m.replyTo && (
            <div
              onClick={() => handleScrollToMessage(getId(m.replyTo._id))}
              className={`mb-1 p-2 rounded-xl text-xs cursor-pointer border-l-3 transition-opacity hover:opacity-90 ${
                isMine
                  ? "bg-black/20 border-emerald-300 text-slate-100"
                  : "bg-[var(--bg-input)] border-emerald-500 text-[var(--text-primary)]"
              }`}
            >
              <p className="font-bold text-[10px] text-emerald-400 mb-0.5">
                {getId(m.replyTo.sender) === getId(myId)
                  ? "You"
                  : m.replyTo.sender?.name || "Member"}
              </p>
              <p className="truncate text-[11px] opacity-90">
                {m.replyTo.fileType === "voice"
                  ? "🎤 Voice message"
                  : m.replyTo.fileType === "image"
                  ? "📷 Photo"
                  : m.replyTo.content || "Attachment"}
              </p>
            </div>
          )}

          {/* Main Message Bubble */}
          <div
            className={`p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm shadow-sm transition-all relative ${
              isMine
                ? "bg-[var(--bubble-out)] text-[var(--bubble-out-text)] rounded-br-xs"
                : "bg-[var(--bubble-in)] text-[var(--bubble-in-text)] border border-[var(--border-subtle)] rounded-bl-xs"
            }`}
          >
            {/* Sender name for group chats */}
            {!isMine && isGroup && (
              <p className="text-[11px] font-bold text-teal-400 mb-1">
                {senderName}
              </p>
            )}

            {/* Voice Message Player */}
            {(m.fileType === "voice" || m.fileType === "audio") && m.fileUrl && (
              <VoiceMessagePlayer
                audioUrl={m.fileUrl}
                fileUrl={m.fileUrl}
                duration={m.duration}
                waveform={m.waveform}
                isMine={isMine}
              />
            )}

            {/* Image Attachment */}
            {m.fileUrl && m.fileType === "image" && (
              <div className="mb-2 relative overflow-hidden rounded-xl">
                <img
                  src={m.fileUrl}
                  alt={m.fileName || "attachment"}
                  onClick={() => setFullScreenImage({ url: m.fileUrl, name: m.fileName || "Image" })}
                  className="rounded-xl max-h-72 w-auto object-cover border border-black/10 hover:opacity-95 transition-opacity cursor-pointer shadow-sm"
                />
              </div>
            )}

            {/* Video Attachment */}
            {m.fileUrl && m.fileType === "video" && (
              <div className="mb-2 rounded-xl overflow-hidden border border-black/10 bg-black/40">
                <video
                  src={m.fileUrl}
                  controls
                  preload="metadata"
                  className="rounded-xl max-h-72 w-full max-w-sm object-cover"
                >
                  Your browser does not support playing this video.
                </video>
              </div>
            )}

            {/* Document Attachment */}
            {m.fileUrl && m.fileType === "file" && (
              <div
                className={`mb-2 p-2.5 sm:p-3 rounded-xl text-xs transition-colors border ${
                  isMine
                    ? "bg-black/20 border-white/20 text-white"
                    : "bg-[var(--bg-input)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-xs" title={m.fileName}>
                      {m.fileName || "Document"}
                    </p>
                    <p className="text-[10px] opacity-75 mt-0.5">
                      {m.fileSize ? formatFileSize(m.fileSize) : "Document"}
                    </p>
                  </div>
                  <a
                    href={m.fileUrl}
                    download={m.fileName || "document"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white shrink-0"
                    title="Download document"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}

            {/* Text Content */}
            {m.content && (
              <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
            )}

            {/* Timestamp & Read Receipt Indicators */}
            <div
              className={`flex items-center justify-end gap-1.5 text-[10px] mt-1 ${
                isMine ? "text-emerald-100/80" : "text-[var(--text-secondary)]"
              }`}
            >
              {m.isEdited && <span className="italic opacity-75">(edited)</span>}
              <span>{formatTime(m.createdAt)}</span>
              {isMine && (
                <span className="ml-0.5" title={m.seen ? "Read" : "Sent"}>
                  {m.seen || (m.seenBy && m.seenBy.length > 1) ? (
                    <CheckCheck className="h-3.5 w-3.5 text-sky-300" />
                  ) : (
                    <Check className="h-3.5 w-3.5 text-emerald-100/70" />
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Emoji Reactions display */}
          {m.reactions && m.reactions.length > 0 && (
            <div
              className={`flex flex-wrap gap-1 mt-1 ${
                isMine ? "justify-end" : "justify-start"
              }`}
            >
              {Object.entries(
                m.reactions.reduce((acc, r) => {
                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                  return acc;
                }, {})
              ).map(([emoji, count]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReactToMessage(mId, emoji)}
                  className="px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-emerald-500 shadow-xs cursor-pointer"
                >
                  <span>{emoji}</span>
                  <span className="text-[10px] font-bold">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========================================================
  // COMPOSER BAR (BOTTOM INPUT)
  // ========================================================
  function renderComposer(isGroup) {
    return (
      <div className="p-3 sm:p-4 bg-[var(--bg-header)] border-t border-[var(--border-subtle)] relative z-10 shrink-0">
        {/* Replying banner */}
        {replyingTo && (
          <div className="mb-2 p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs animate-in fade-in">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-emerald-500 text-[11px]">
                Replying to {replyingTo.sender?.name || (isGroup ? "Member" : selectedUser?.name)}
              </p>
              <p className="truncate text-[var(--text-primary)] text-xs mt-0.5">
                {replyingTo.fileType === "voice"
                  ? "🎤 Voice message"
                  : replyingTo.content || "Attachment"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer ml-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Editing banner */}
        {editingMessage && (
          <form
            onSubmit={handleSaveEdit}
            className="mb-2 p-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center gap-2 text-xs animate-in fade-in"
          >
            <Edit2 className="h-4 w-4 text-teal-400 shrink-0" />
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 bg-transparent text-[var(--text-primary)] focus:outline-none text-xs"
              autoFocus
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingMessage(null)}
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* File attachment preview */}
        {selectedFile && (
          <div className="mb-2 p-2.5 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-subtle)] flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3 min-w-0">
              {filePreview ? (
                <img src={filePreview} alt="preview" className="h-10 w-10 rounded-xl object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-500">
                  <FileText className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-xs">
                  {selectedFile.name}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)]">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Upload error banner */}
        {uploadError && (
          <div className="mb-2 p-2.5 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{uploadError}</span>
            </div>
            {failedUploadPayload && (
              <button
                type="button"
                onClick={handleRetryUpload}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-[11px] cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Main Input Form */}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip"
            className="hidden"
          />

          {/* Attachment Paperclip */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 rounded-xl bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-emerald-500 flex items-center justify-center cursor-pointer transition-colors shrink-0"
            title="Attach file or photo"
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </button>

          {/* Text input */}
          <input
            ref={textInputRef}
            type="text"
            placeholder={isGroup ? "Message group..." : "Type a message..."}
            value={text}
            onChange={isGroup ? (e) => setText(e.target.value) : handleTextChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-emerald-500 transition-colors"
          />

          {/* Voice Note Recorder Button */}
          <VoiceRecorder onSendVoice={handleSendVoiceMessage} disabled={sending} />

          {/* Send Button */}
          <button
            type="submit"
            disabled={(!text.trim() && !selectedFile) || sending}
            className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shadow-md shadow-emerald-600/25 shrink-0"
            title="Send message"
            aria-label="Send message"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    );
  }

  // ========================================================
  // RIGHT SLIDE-OVER INFO DRAWER
  // ========================================================
  function renderInfoDrawerContent() {
    const isGroup = Boolean(selectedGroup);
    const target = isGroup ? selectedGroup : selectedUser;
    const displayName = isGroup ? target.name : target.name;
    const displayPic = isGroup ? target.groupPic : target.profilePic;

    return (
      <div className="h-full flex flex-col overflow-y-auto">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {isGroup ? "Group Details" : "Contact Info"}
          </h3>
          <button
            type="button"
            onClick={() => setShowInfoDrawer(false)}
            className="p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            aria-label="Close details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Profile Card */}
        <div className="p-6 border-b border-[var(--border-subtle)] flex flex-col items-center text-center">
          <div className="h-24 w-24 rounded-full bg-[var(--bg-input)] text-emerald-500 font-bold text-2xl flex items-center justify-center border-2 border-emerald-500/40 overflow-hidden shadow-xl mb-3">
            {displayPic ? (
              <img src={displayPic} alt={displayName} className="h-full w-full object-cover" />
            ) : isGroup ? (
              <Users className="h-10 w-10" />
            ) : displayName ? (
              displayName[0].toUpperCase()
            ) : (
              <UserIcon className="h-10 w-10" />
            )}
          </div>

          <h4 className="text-base font-bold text-[var(--text-primary)]">{displayName}</h4>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {isGroup ? `${target.members?.length || 0} participants` : target.email}
          </p>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => {
                if (isGroup) {
                  startGroupCall({ group: selectedGroup, type: "voice" });
                } else {
                  startCall({ targetUser: selectedUser, type: "voice" });
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>Voice</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isGroup) {
                  startGroupCall({ group: selectedGroup, type: "video" });
                } else {
                  startCall({ targetUser: selectedUser, type: "video" });
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Video className="h-3.5 w-3.5" />
              <span>Video</span>
            </button>
          </div>
        </div>

        {/* Group Specific Members List / Manage */}
        {isGroup && (
          <div className="p-5 border-b border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[var(--text-primary)]">
                Participants ({selectedGroup.members?.length || 0})
              </span>
              <button
                type="button"
                onClick={() => setShowGroupInfo(true)}
                className="text-xs font-semibold text-emerald-500 hover:text-emerald-400 cursor-pointer"
              >
                Manage
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(selectedGroup.members || []).map((m) => {
                const isMe = getId(m._id || m) === getId(myId);
                const memName = m.name || "Member";
                return (
                  <div key={getId(m._id || m)} className="flex items-center gap-2.5 text-xs py-1">
                    <div className="h-7 w-7 rounded-full bg-[var(--bg-input)] text-emerald-500 font-semibold flex items-center justify-center text-[10px] overflow-hidden shrink-0 border border-[var(--border-subtle)]">
                      {m.profilePic ? (
                        <img src={m.profilePic} alt={memName} className="h-full w-full object-cover" />
                      ) : (
                        memName[0]?.toUpperCase()
                      )}
                    </div>
                    <span className="text-[var(--text-primary)] font-medium truncate flex-1">
                      {memName} {isMe && "(You)"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Shared Media Gallery Preview */}
        <div className="p-5 flex-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[var(--text-primary)]">
              Shared Media & Files ({sharedMediaMessages.length})
            </span>
          </div>

          {sharedMediaMessages.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
              No files or photos shared yet
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {sharedMediaMessages.map((m) => {
                if (m.fileType === "image") {
                  return (
                    <img
                      key={m._id}
                      src={m.fileUrl}
                      alt={m.fileName || "media"}
                      onClick={() => setFullScreenImage({ url: m.fileUrl, name: m.fileName || "Image" })}
                      className="h-20 w-full object-cover rounded-xl cursor-pointer hover:opacity-90 border border-[var(--border-subtle)]"
                    />
                  );
                }
                return (
                  <a
                    key={m._id}
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-20 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] flex flex-col items-center justify-center p-2 text-center text-[var(--text-primary)] hover:border-emerald-500 transition-colors"
                  >
                    <FileText className="h-5 w-5 text-emerald-500 mb-1" />
                    <span className="text-[10px] truncate max-w-full font-medium">
                      {m.fileName || "File"}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========================================================
  // EMPTY STATE (NO CONVERSATION SELECTED)
  // ========================================================
  function renderEmptyState() {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[var(--text-secondary)] chat-wallpaper">
        <div className="relative mb-6">
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/25">
            <MessageSquare className="h-10 w-10 fill-white/20" />
          </div>
          <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
        </div>

        <h3 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight mb-2">
          ChatSphere for Web
        </h3>
        <p className="text-xs sm:text-sm max-w-md text-[var(--text-secondary)] mb-8 leading-relaxed">
          Send and receive messages with end-to-end security. Start one-on-one direct chats,
          record live voice notes, or launch WebRTC audio & video group calls.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarTab("direct")}
            className="px-4 py-2.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <UserIcon className="h-4 w-4 text-emerald-500" />
            <span>Browse Contacts</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateGroup(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Group</span>
          </button>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--border-subtle)] flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>End-to-end encrypted messaging & calls</span>
        </div>
      </div>
    );
  }
};

export default Chat;
