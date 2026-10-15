import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext.jsx";
import { useSocket } from "./SocketContext.jsx";
import API from "../services/api.js";
import ringtoneService from "../services/ringtone.js";

const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  const { authUser } = useAuth();
  const { socket } = useSocket();

  // Call state: 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected' | 'ended'
  const [callState, setCallState] = useState("idle");
  const [callType, setCallType] = useState("voice"); // 'voice' | 'video'
  const [currentCallId, setCurrentCallId] = useState(null);
  const [callPeer, setCallPeer] = useState(null); // { _id, name, profilePic }
  const [isIncoming, setIsIncoming] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Media toggles
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteCameraOff, setIsRemoteCameraOff] = useState(false);
  const [callError, setCallError] = useState(null);

  // Group call state
  const [isGroupCall, setIsGroupCall] = useState(false);
  const [groupCallInfo, setGroupCallInfo] = useState(null); // { groupId, groupName, groupPic, memberIds }
  const [groupParticipants, setGroupParticipants] = useState([]); // [{ userId, userInfo, stream, isMuted, isCameraOff }]

  // Streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  // WebRTC & DOM Refs
  const peerConnectionRef = useRef(null);
  const groupPeerConnectionsRef = useRef(new Map()); // userId -> RTCPeerConnection
  const localStreamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const iceServersRef = useRef([
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
      ],
    },
  ]);
  const callDurationRef = useRef(0);
  const callStartTimeRef = useRef(null);
  const callIdRef = useRef(null);
  const callPeerRef = useRef(null);
  const isGroupCallRef = useRef(false);
  const groupCallInfoRef = useRef(null);
  const callStateRef = useRef("idle");
  const callTypeRef = useRef(callType);
  const callTimeoutRef = useRef(null);
  const activeNotificationRef = useRef(null);
  const titleIntervalRef = useRef(null);
  const originalTitleRef = useRef(typeof document !== "undefined" ? document.title : "ChatSphere");

  // Ringtone and notification state
  const [isRingtoneBlocked, setIsRingtoneBlocked] = useState(false);
  const [isRingtoneMuted, setIsRingtoneMuted] = useState(false);

  const myId = authUser?._id || authUser?.id;

  // Sync refs with state
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);

  useEffect(() => {
    callIdRef.current = currentCallId;
  }, [currentCallId]);

  useEffect(() => {
    callPeerRef.current = callPeer;
  }, [callPeer]);

  useEffect(() => {
    isGroupCallRef.current = isGroupCall;
  }, [isGroupCall]);

  useEffect(() => {
    groupCallInfoRef.current = groupCallInfo;
  }, [groupCallInfo]);

  // Fetch ICE servers from backend on initial load
  useEffect(() => {
    if (!authUser) return;
    API.get("/calls/ice-servers")
      .then((res) => {
        if (res.data?.iceServers && Array.isArray(res.data.iceServers)) {
          iceServersRef.current = res.data.iceServers;
        }
      })
      .catch((err) => {
        console.warn("Could not fetch remote ICE servers, falling back to public STUN:", err);
      });
  }, [authUser]);

  // Clean up all WebRTC media streams, tracks, and timer
  const cleanupMedia = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onconnectionstatechange = null;
        peerConnectionRef.current.close();
      } catch (e) {
        console.error("PeerConnection close error:", e);
      }
      peerConnectionRef.current = null;
    }

    // Clean up multi-peer group call connections
    groupPeerConnectionsRef.current.forEach((pc) => {
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch (e) {
        console.error("Group PeerConnection close error:", e);
      }
    });
    groupPeerConnectionsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error("Error stopping local track:", e);
        }
      });
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setGroupParticipants([]);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsRemoteMuted(false);
    setIsRemoteCameraOff(false);
  }, []);

  // Stop ringtone audio, tab title flash, notifications, and incoming timeouts
  const stopIncomingAlerts = useCallback(() => {
    ringtoneService.stop();
    setIsRingtoneBlocked(false);

    if (activeNotificationRef.current) {
      try {
        activeNotificationRef.current.close();
      } catch (e) {
        // ignore
      }
      activeNotificationRef.current = null;
    }

    if (titleIntervalRef.current) {
      clearInterval(titleIntervalRef.current);
      titleIntervalRef.current = null;
      if (typeof document !== "undefined") {
        document.title = originalTitleRef.current || "ChatSphere";
      }
    }

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  // Full reset to idle
  const resetCall = useCallback(
    (reason = null) => {
      stopIncomingAlerts();
      cleanupMedia();
      if (reason) {
        setCallError(reason);
        setTimeout(() => setCallError(null), 4000);
      }
      setCallState("idle");
      setCurrentCallId(null);
      setCallPeer(null);
      setIsIncoming(false);
      setCallDuration(0);
      setIsGroupCall(false);
      setGroupCallInfo(null);
      callDurationRef.current = 0;
      callStartTimeRef.current = null;
    },
    [cleanupMedia, stopIncomingAlerts]
  );

  // Start incoming ringtone, tab title animation, and desktop notifications
  const startIncomingAlerts = useCallback(
    (caller, type = "voice", isGroup = false) => {
      // 1. Play local incoming call ringtone
      ringtoneService.start({
        onAutoplayBlocked: (blocked) => {
          setIsRingtoneBlocked(blocked);
        },
      });

      // 2. Animate browser tab title for visibility when app is in another tab
      if (typeof document !== "undefined") {
        if (titleIntervalRef.current) clearInterval(titleIntervalRef.current);
        let toggle = false;
        const callerName = caller?.name || "Someone";
        titleIntervalRef.current = setInterval(() => {
          document.title = toggle
            ? `📞 Incoming ${type === "video" ? "Video" : "Voice"} Call...`
            : `✨ ${callerName} is calling...`;
          toggle = !toggle;
        }, 1000);
      }

      // 3. Desktop HTML5 notification if tab is in background or permitted
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        } else if (Notification.permission === "granted") {
          try {
            if (activeNotificationRef.current) {
              activeNotificationRef.current.close();
            }
            const callLabel = isGroup
              ? `Group ${type === "video" ? "Video" : "Voice"} Call`
              : `${type === "video" ? "HD Video" : "Voice"} Call`;
            const notif = new Notification(`Incoming ${callLabel} - ChatSphere`, {
              body: `${caller?.name || "A contact"} is calling you on ChatSphere`,
              icon: caller?.profilePic || "/favicon.svg",
              tag: "chatsphere-incoming-call",
              requireInteraction: true,
              silent: true,
            });
            notif.onclick = () => {
              window.focus();
              notif.close();
            };
            activeNotificationRef.current = notif;
          } catch (e) {
            console.warn("Could not display incoming call notification:", e);
          }
        }
      }

      // 4. Automatic missed-call timeout after 45 seconds if unanswered
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        resetCall("Missed call");
      }, 45000);
    },
    [resetCall]
  );

  // Ringtone unlock and mute controls
  const unlockRingtone = useCallback(() => {
    ringtoneService.unlockAudio();
    setIsRingtoneBlocked(false);
  }, []);

  const toggleRingtoneMute = useCallback(() => {
    const muted = ringtoneService.toggleMute();
    setIsRingtoneMuted(muted);
    return muted;
  }, []);

  // Initialize 1-to-1 RTCPeerConnection
  const createPeerConnection = useCallback(
    (targetUserId, callId) => {
      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 10,
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && socket && targetUserId) {
          socket.emit("call:signal", {
            targetUserId,
            signalData: { type: "candidate", candidate: event.candidate },
            callId,
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          if (callState === "connected" || callState === "connecting") {
            resetCall("Connection lost");
          }
        }
      };

      peerConnectionRef.current = pc;
      return pc;
    },
    [socket, callState, resetCall]
  );

  // Initialize Group RTCPeerConnection for a specific remote peer
  const createGroupPeerConnection = useCallback(
    (remoteUserId, callId, remoteUserInfo = null) => {
      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 10,
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && socket && remoteUserId) {
          socket.emit("groupCall:signal", {
            targetUserId: remoteUserId,
            signalData: { type: "candidate", candidate: event.candidate },
            callId,
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          setGroupParticipants((prev) => {
            const exists = prev.some((p) => p.userId === remoteUserId);
            if (exists) {
              return prev.map((p) =>
                p.userId === remoteUserId ? { ...p, stream, userInfo: remoteUserInfo || p.userInfo } : p
              );
            }
            return [
              ...prev,
              {
                userId: remoteUserId,
                userInfo: remoteUserInfo || { _id: remoteUserId, name: "Group Member" },
                stream,
                isMuted: false,
                isCameraOff: false,
              },
            ];
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          setGroupParticipants((prev) => prev.filter((p) => p.userId !== remoteUserId));
        }
      };

      // Add local stream tracks to this peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      groupPeerConnectionsRef.current.set(remoteUserId, pc);
      return pc;
    },
    [socket]
  );

  // Start call timer when connected
  const startCallTimer = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    callStartTimeRef.current = Date.now();
    callDurationRef.current = 0;
    setCallDuration(0);

    timerIntervalRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
        callDurationRef.current = elapsed;
        setCallDuration(elapsed);
      }
    }, 1000);
  }, []);

  // Initiate an Outgoing 1-to-1 Call
  const startCall = async ({ targetUser, type = "voice" }) => {
    if (!targetUser || !socket) return;
    if (callState !== "idle") return;

    setCallError(null);
    setCallType(type);
    setCallPeer(targetUser);
    setIsIncoming(false);
    setIsGroupCall(false);
    const newCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setCurrentCallId(newCallId);
    setCallState("outgoing");

    try {
      // 1. Request user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: type === "video",
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      // 2. Initialize PeerConnection
      const pc = createPeerConnection(targetUser._id, newCallId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 3. Log initiated call to database
      try {
        await API.post("/calls/log", {
          callId: newCallId,
          receiver: targetUser._id,
          callType: type,
          status: "initiated",
        });
      } catch (e) {
        console.warn("Failed to log initiated call:", e);
      }

      // 4. Emit call:initiate
      socket.emit("call:initiate", {
        receiverId: targetUser._id,
        callType: type,
        callId: newCallId,
      });

      // 5. Outgoing ringing timeout: automatically end if receiver does not answer in 45s
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        endCall("No answer");
      }, 45000);
    } catch (err) {
      console.error("Camera/Microphone permission or startCall error:", err);
      let msg = "Failed to access microphone or camera.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Microphone/Camera permission was denied. Please allow access in browser settings.";
      }
      resetCall(msg);
    }
  };

  // Initiate a Group Call
  const startGroupCall = async ({ group, type = "voice" }) => {
    if (!group || !socket) return;
    if (callState !== "idle") return;

    setCallError(null);
    setCallType(type);
    setCallPeer({ _id: group._id, name: group.name, profilePic: group.groupPic });
    setIsIncoming(false);
    setIsGroupCall(true);
    setGroupCallInfo(group);
    const newCallId = `group_call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setCurrentCallId(newCallId);
    setCallState("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: type === "video",
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const memberIds = (group.members || []).map((m) => (m._id ? String(m._id) : String(m)));

      // Emit group call initiate
      socket.emit("groupCall:initiate", {
        groupId: group._id,
        groupName: group.name,
        groupPic: group.groupPic,
        callType: type,
        callId: newCallId,
        memberIds,
      });

      // Log call
      try {
        await API.post("/calls/log", {
          callId: newCallId,
          group: group._id,
          callType: type,
          status: "connected",
        });
      } catch (e) {
        console.warn("Failed to log group call:", e);
      }

      setCallState("connected");
      startCallTimer();
    } catch (err) {
      console.error("Group call media error:", err);
      let msg = "Failed to access microphone or camera.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Microphone/Camera permission denied. Cannot start group call.";
      }
      resetCall(msg);
    }
  };

  // Accept an Incoming Call (1-to-1 or Group)
  const acceptCall = async () => {
    stopIncomingAlerts();
    if (!currentCallId || !socket) return;

    if (isGroupCall) {
      // Accept group call
      setCallState("connecting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: callType === "video",
        });
        localStreamRef.current = stream;
        setLocalStream(stream);

        socket.emit("groupCall:join", {
          groupId: groupCallInfo?.groupId || callPeer?._id,
          callId: currentCallId,
          userInfo: authUser,
        });

        setCallState("connected");
        startCallTimer();
      } catch (err) {
        console.error("Failed to accept group call:", err);
        resetCall("Microphone/Camera permission denied.");
      }
      return;
    }

    // Accept 1-to-1 call
    if (!callPeer) return;
    setCallState("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: callType === "video",
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection(callPeer._id, currentCallId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Emit accept to caller
      socket.emit("call:accept", {
        callerId: callPeer._id,
        callId: currentCallId,
      });

      // Update call log to connected
      try {
        await API.post("/calls/log", {
          callId: currentCallId,
          status: "connected",
          startedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("Failed to update call log on accept:", e);
      }
    } catch (err) {
      console.error("Failed to accept call:", err);
      let msg = "Microphone/Camera permission denied.";
      if (err.name === "NotAllowedError") {
        msg = "Camera/Microphone access denied. Cannot accept call.";
      }
      rejectCall();
      setCallError(msg);
      setTimeout(() => setCallError(null), 4000);
    }
  };

  // Reject an Incoming Call
  const rejectCall = async () => {
    stopIncomingAlerts();
    if (!currentCallId || !socket) {
      resetCall();
      return;
    }

    if (isGroupCall) {
      resetCall();
      return;
    }

    if (callPeer) {
      socket.emit("call:reject", {
        callerId: callPeer._id,
        callId: currentCallId,
      });

      try {
        await API.post("/calls/log", {
          callId: currentCallId,
          status: "rejected",
          endedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("Failed to update call log on reject:", e);
      }
    }

    resetCall();
  };

  // End an Active or Outgoing Call
  const endCall = useCallback(
    async (reason = "Call ended") => {
      stopIncomingAlerts();
      const cId = callIdRef.current;

      if (isGroupCallRef.current) {
        if (socket && cId) {
          socket.emit("groupCall:leave", {
            groupId: groupCallInfoRef.current?.groupId || callPeerRef.current?._id,
            callId: cId,
          });
        }

        if (cId) {
          const finalDuration = callDurationRef.current || 0;
          try {
            await API.post("/calls/log", {
              callId: cId,
              status: "ended",
              endedAt: new Date().toISOString(),
              duration: finalDuration,
            });
          } catch (e) {
            console.warn("Failed to update group call log on leave:", e);
          }
        }

        resetCall();
        return;
      }

      // 1-to-1 End Call
      const peerId = callPeerRef.current?._id;
      if (socket && cId && peerId) {
        socket.emit("call:end", {
          targetUserId: peerId,
          callId: cId,
          reason,
        });
      }

      if (cId) {
        const finalDuration = callDurationRef.current || 0;
        try {
          await API.post("/calls/log", {
            callId: cId,
            status: callState === "connected" ? "ended" : "missed",
            endedAt: new Date().toISOString(),
            duration: finalDuration,
          });
        } catch (e) {
          console.warn("Failed to update call log on end:", e);
        }
      }

      resetCall();
    },
    [callState, resetCall, socket, stopIncomingAlerts]
  );

  // Toggle Microphone Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMuted = !audioTrack.enabled;
        setIsMuted(newMuted);

        if (!isGroupCall && socket && callPeerRef.current?._id) {
          socket.emit("call:toggleMedia", {
            targetUserId: callPeerRef.current._id,
            isMuted: newMuted,
            isCameraOff,
            callId: callIdRef.current,
          });
        }
      }
    }
  };

  // Toggle Video Camera
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const newCameraOff = !videoTrack.enabled;
        setIsCameraOff(newCameraOff);

        if (!isGroupCall && socket && callPeerRef.current?._id) {
          socket.emit("call:toggleMedia", {
            targetUserId: callPeerRef.current._id,
            isMuted,
            isCameraOff: newCameraOff,
            callId: callIdRef.current,
          });
        }
      }
    }
  };

  // Real-time Call Signaling Socket Event Listeners
  useEffect(() => {
    if (!socket || !authUser) return;

    // Incoming 1-to-1 call received
    const handleIncomingCall = ({ callId, callType: incomingType, caller }) => {
      if (callStateRef.current !== "idle") {
        socket.emit("call:busy", { callerId: caller._id, callId });
        return;
      }

      setIsGroupCall(false);
      setGroupCallInfo(null);
      setCurrentCallId(callId);
      setCallType(incomingType);
      callTypeRef.current = incomingType;
      setCallPeer(caller);
      callPeerRef.current = caller;
      setIsIncoming(true);
      setCallState("incoming");
    };

    // Incoming Group Call received
    const handleIncomingGroupCall = ({
      groupId,
      groupName,
      groupPic,
      callType: incomingType,
      callId,
      caller,
    }) => {
      if (callStateRef.current !== "idle") return;

      const chosenType = incomingType || "voice";
      setIsGroupCall(true);
      setGroupCallInfo({ groupId, groupName, groupPic, caller });
      setCurrentCallId(callId);
      setCallType(chosenType);
      callTypeRef.current = chosenType;
      const peerData = {
        _id: groupId,
        name: groupName,
        profilePic: groupPic,
        callerName: caller?.name,
      };
      setCallPeer(peerData);
      callPeerRef.current = peerData;
      setIsIncoming(true);
      setCallState("incoming");
    };

    // Caller receives ringing notification
    const handleCallRinging = () => {
      setCallState("outgoing");
    };

    // Caller receives call accepted notification
    const handleCallAccepted = async ({ receiverId, callId }) => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      setCallState("connecting");

      const pc = peerConnectionRef.current;
      if (pc) {
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: callTypeRef.current === "video",
          });
          await pc.setLocalDescription(offer);

          socket.emit("call:signal", {
            targetUserId: receiverId,
            signalData: { type: "offer", sdp: offer },
            callId,
          });
        } catch (err) {
          console.error("Failed to create WebRTC offer:", err);
          endCall("Connection error");
        }
      }
    };

    // Caller receives call rejected notification
    const handleCallRejected = ({ reason }) => {
      resetCall(reason || "Call was rejected");
    };

    // Call busy notification
    const handleCallBusy = ({ reason }) => {
      resetCall(reason || "User is currently busy on another call");
    };

    // Call unavailable notification (user offline)
    const handleCallUnavailable = ({ reason }) => {
      resetCall(reason || "User is offline");
    };

    // WebRTC 1-to-1 Signaling data exchange (Offer, Answer, Candidate)
    const handleCallSignal = async ({ senderId, signalData, callId }) => {
      const pc = peerConnectionRef.current;
      if (!pc || !signalData) return;

      try {
        if (signalData.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("call:signal", {
            targetUserId: senderId,
            signalData: { type: "answer", sdp: answer },
            callId,
          });

          setCallState("connected");
          startCallTimer();
        } else if (signalData.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          setCallState("connected");
          startCallTimer();
        } else if (signalData.type === "candidate" && signalData.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        }
      } catch (err) {
        console.error("Error processing WebRTC signal:", err);
      }
    };

    // Group Call: A new participant joined the active group call
    const handleGroupUserJoined = async ({ userId, userInfo, callId }) => {
      if (!userId || userId === myId) return;

      try {
        // Create peer connection for this newly joined peer and send offer
        const pc = createGroupPeerConnection(userId, callId, userInfo);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callTypeRef.current === "video",
        });
        await pc.setLocalDescription(offer);

        socket.emit("groupCall:signal", {
          targetUserId: userId,
          signalData: { type: "offer", sdp: offer, senderInfo: authUser },
          callId,
        });
      } catch (err) {
        console.error("Failed to connect to joined group user:", err);
      }
    };

    // Group Call: WebRTC Signaling data exchange
    const handleGroupCallSignal = async ({ senderId, signalData, callId }) => {
      if (!senderId || !signalData) return;

      try {
        let pc = groupPeerConnectionsRef.current.get(senderId);

        if (signalData.type === "offer") {
          if (!pc) {
            pc = createGroupPeerConnection(senderId, callId, signalData.senderInfo);
          }
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("groupCall:signal", {
            targetUserId: senderId,
            signalData: { type: "answer", sdp: answer },
            callId,
          });
        } else if (signalData.type === "answer") {
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          }
        } else if (signalData.type === "candidate" && signalData.candidate) {
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
          }
        }
      } catch (err) {
        console.error("Error handling group call signal:", err);
      }
    };

    // Group Call: A participant left
    const handleGroupUserLeft = ({ userId }) => {
      if (!userId) return;
      const pc = groupPeerConnectionsRef.current.get(userId);
      if (pc) {
        try {
          pc.close();
        } catch (e) {
          console.error("Error closing left peer:", e);
        }
        groupPeerConnectionsRef.current.delete(userId);
      }
      setGroupParticipants((prev) => prev.filter((p) => p.userId !== userId));
    };

    // Peer ended the call
    const handleCallEnded = ({ reason }) => {
      resetCall(reason || "Call ended");
    };

    // Peer toggled media tracks
    const handleMediaToggled = ({ isMuted: remoteMuted, isCameraOff: remoteCamOff }) => {
      if (remoteMuted !== undefined) setIsRemoteMuted(remoteMuted);
      if (remoteCamOff !== undefined) setIsRemoteCameraOff(remoteCamOff);
    };

    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:ringing", handleCallRinging);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("call:rejected", handleCallRejected);
    socket.on("call:busy", handleCallBusy);
    socket.on("call:unavailable", handleCallUnavailable);
    socket.on("call:signal", handleCallSignal);
    socket.on("call:ended", handleCallEnded);
    socket.on("call:mediaToggled", handleMediaToggled);

    // Group call listeners
    socket.on("groupCall:incoming", handleIncomingGroupCall);
    socket.on("groupCall:userJoined", handleGroupUserJoined);
    socket.on("groupCall:signal", handleGroupCallSignal);
    socket.on("groupCall:userLeft", handleGroupUserLeft);

    return () => {
      socket.off("call:incoming", handleIncomingCall);
      socket.off("call:ringing", handleCallRinging);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("call:rejected", handleCallRejected);
      socket.off("call:busy", handleCallBusy);
      socket.off("call:unavailable", handleCallUnavailable);
      socket.off("call:signal", handleCallSignal);
      socket.off("call:ended", handleCallEnded);
      socket.off("call:mediaToggled", handleMediaToggled);

      socket.off("groupCall:incoming", handleIncomingGroupCall);
      socket.off("groupCall:userJoined", handleGroupUserJoined);
      socket.off("groupCall:signal", handleGroupCallSignal);
      socket.off("groupCall:userLeft", handleGroupUserLeft);
    };
  }, [
    socket,
    authUser,
    myId,
    createPeerConnection,
    createGroupPeerConnection,
    startCallTimer,
    endCall,
    resetCall,
  ]);

  // Declarative incoming call ringtone lifecycle: loops continuously while incoming call screen is active
  useEffect(() => {
    if (callState === "incoming" && isIncoming) {
      startIncomingAlerts(callPeerRef.current, callTypeRef.current, isGroupCallRef.current);
      return () => {
        stopIncomingAlerts();
      };
    }
  }, [callState, isIncoming, startIncomingAlerts, stopIncomingAlerts]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        callPeer,
        isIncoming,
        callDuration,
        isMuted,
        isCameraOff,
        isRemoteMuted,
        isRemoteCameraOff,
        localStream,
        remoteStream,
        callError,
        isGroupCall,
        groupCallInfo,
        groupParticipants,
        isRingtoneBlocked,
        isRingtoneMuted,
        startCall,
        startGroupCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
        unlockRingtone,
        toggleRingtoneMute,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};

export default CallContext;
