import { useEffect, useRef, useState } from "react";
import { useCall } from "../context/CallContext.jsx";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  User as UserIcon,
  Maximize2,
  Minimize2,
  VolumeX,
  Volume2,
  Bell,
  BellOff,
  Users,
  ShieldCheck,
} from "lucide-react";

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

// Remote group participant video/audio card
const RemoteParticipantTile = ({ participant, callType }) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (participant.stream) {
      if (videoRef.current) {
        videoRef.current.srcObject = participant.stream;
      }
      if (audioRef.current) {
        audioRef.current.srcObject = participant.stream;
      }
    }
  }, [participant.stream]);

  const name = participant.userInfo?.name || "Participant";
  const profilePic = participant.userInfo?.profilePic;

  return (
    <div className="relative rounded-2xl bg-slate-900/90 border border-slate-700/60 overflow-hidden flex flex-col items-center justify-center min-h-[170px] sm:min-h-[220px] shadow-lg">
      <audio ref={audioRef} autoPlay playsInline />
      {callType === "video" && participant.stream && !participant.isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-4">
          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-slate-800 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xl overflow-hidden mb-2 shadow-lg">
            {profilePic ? (
              <img src={profilePic} alt={name} className="h-full w-full object-cover" />
            ) : (
              name[0]?.toUpperCase() || <UserIcon className="h-8 w-8" />
            )}
          </div>
          <span className="text-xs font-semibold text-slate-200">{name}</span>
          {participant.isCameraOff && (
            <span className="text-[10px] text-slate-400 mt-0.5">Camera off</span>
          )}
        </div>
      )}
      <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[11px] font-medium text-white flex items-center gap-1.5">
        <span>{name}</span>
        {participant.isMuted && <VolumeX className="h-3 w-3 text-rose-400" />}
      </div>
    </div>
  );
};

export const CallModal = () => {
  const {
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
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    unlockRingtone,
    toggleRingtoneMute,
  } = useCall();

  const [isMinimized, setIsMinimized] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Attach local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream for 1-to-1 calls
  useEffect(() => {
    if (!isGroupCall) {
      if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      if (remoteAudioRef.current && remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream, isGroupCall]);

  if (callState === "idle" && !callError) return null;

  // Render call error toast if call failed/disconnected
  if (callState === "idle" && callError) {
    return (
      <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 flex items-center gap-3">
        <PhoneOff className="h-4 w-4 text-rose-400 shrink-0" />
        <span>{callError}</span>
      </div>
    );
  }

  // --- STATE 1: Incoming Call Screen ---
  if (callState === "incoming" && isIncoming) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        onClick={() => {
          if (isRingtoneBlocked) unlockRingtone();
        }}
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      >
        <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700/80 p-7 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
          {/* Animated Background Ring Glow */}
          <div className="absolute -top-16 -left-16 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar: Call Type Badge & Silence/Mute Ringtone Button */}
          <div className="w-full flex items-center justify-between mb-2 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              {callType === "video" ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
              <span>
                {isGroupCall
                  ? `Group ${callType === "video" ? "Video" : "Voice"}`
                  : `${callType === "video" ? "HD Video Call" : "Voice Call"}`}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleRingtoneMute();
              }}
              className={`p-2 rounded-full transition-colors cursor-pointer border ${
                isRingtoneMuted
                  ? "bg-rose-500/20 border-rose-500/50 text-rose-300 hover:bg-rose-500/30"
                  : "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:text-white"
              }`}
              title={isRingtoneMuted ? "Unmute ringtone" : "Silence ringtone"}
              aria-label={isRingtoneMuted ? "Unmute ringtone" : "Silence ringtone"}
            >
              {isRingtoneMuted ? <BellOff className="h-4 w-4 text-rose-400" /> : <Bell className="h-4 w-4" />}
            </button>
          </div>

          {/* Autoplay Sound Prompt if blocked by browser policy */}
          {isRingtoneBlocked && !isRingtoneMuted && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                unlockRingtone();
              }}
              className="mt-2 mb-3 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-semibold flex items-center gap-2 animate-bounce cursor-pointer hover:bg-amber-500/30 transition-all shadow-lg shadow-amber-500/10 z-10"
              title="Browser silenced audio — Click to enable ringtone"
            >
              <Volume2 className="h-3.5 w-3.5 text-amber-400" />
              <span>Tap to enable ringtone sound</span>
            </button>
          )}

          {/* Caller Avatar with Pulsing Ring */}
          <div className="relative mb-5 mt-2">
            <span className="absolute -inset-2 rounded-full bg-emerald-500/20 animate-ping duration-1000" />
            <div className="h-24 w-24 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center font-bold text-3xl border-2 border-emerald-500/60 shadow-xl overflow-hidden relative z-10">
              {callPeer?.profilePic ? (
                <img
                  src={callPeer.profilePic}
                  alt={callPeer.name}
                  className="h-full w-full object-cover"
                />
              ) : isGroupCall ? (
                <Users className="h-10 w-10 text-emerald-400" />
              ) : callPeer?.name ? (
                callPeer.name[0].toUpperCase()
              ) : (
                <UserIcon className="h-10 w-10" />
              )}
            </div>
          </div>

          <h3 className="text-xl font-bold text-white mb-1">{callPeer?.name}</h3>

          {isGroupCall && (groupCallInfo?.caller?.name || callPeer?.callerName) ? (
            <p className="text-xs text-slate-400 mb-6">
              Started by {groupCallInfo?.caller?.name || callPeer?.callerName}
            </p>
          ) : (
            <p className="text-xs text-slate-400 mb-6">
              {isRingtoneMuted ? "Incoming call (silenced)..." : "Incoming call ringing..."}
            </p>
          )}

          {/* Action Buttons: Accept / Reject */}
          <div className="flex items-center justify-center gap-10 w-full pt-2">
            {/* Reject Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  rejectCall();
                }}
                className="h-14 w-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title="Decline"
                aria-label="Decline call"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
              <span className="text-xs font-semibold text-slate-400">Decline</span>
            </div>

            {/* Accept Button */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  acceptCall();
                }}
                className="h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
                title="Accept"
                aria-label="Accept call"
              >
                {callType === "video" ? (
                  <Video className="h-6 w-6" />
                ) : (
                  <Phone className="h-6 w-6" />
                )}
              </button>
              <span className="text-xs font-semibold text-slate-400">Accept</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- STATE 2: Group Call Active Screen ---
  if (isGroupCall) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed z-50 transition-all duration-300 ${
          isMinimized
            ? "bottom-5 right-5 w-84 h-52 rounded-2xl shadow-2xl bg-slate-900 border border-slate-700/80 overflow-hidden"
            : "inset-0 bg-slate-950/98 backdrop-blur-xl flex flex-col justify-between"
        }`}
      >
        {/* Group Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center border border-slate-700 overflow-hidden">
              {callPeer?.profilePic ? (
                <img
                  src={callPeer.profilePic}
                  alt={callPeer.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Users className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">{callPeer?.name}</h4>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                  <ShieldCheck className="h-3 w-3" />
                  Encrypted
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-emerald-400 font-medium">
                  {groupParticipants.length + 1} in call
                </span>
                <span className="text-slate-600">•</span>
                <div className="flex items-center gap-1 text-emerald-400 font-mono font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{formatDuration(callDuration)}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMinimized((prev) => !prev)}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/60"
            title={isMinimized ? "Maximize call" : "Minimize call"}
            aria-label={isMinimized ? "Maximize call" : "Minimize call"}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Group Participants Media Grid */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex items-center justify-center">
          <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Local User Card */}
            <div className="relative rounded-2xl bg-slate-900/90 border border-slate-700/60 overflow-hidden flex flex-col items-center justify-center min-h-[170px] sm:min-h-[220px] shadow-lg">
              {callType === "video" && localStream && !isCameraOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover -scale-x-100"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-4">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-slate-800 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xl mb-2 shadow-lg">
                    You
                  </div>
                  <span className="text-xs font-semibold text-slate-300">
                    {isCameraOff ? "Camera Off" : "Voice Active"}
                  </span>
                </div>
              )}
              <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[11px] font-medium text-white flex items-center gap-1.5">
                <span>You</span>
                {isMuted && <MicOff className="h-3 w-3 text-rose-400" />}
              </div>
            </div>

            {/* Remote Participants */}
            {groupParticipants.map((p) => (
              <RemoteParticipantTile key={p.userId} participant={p} callType={callType} />
            ))}

            {groupParticipants.length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-slate-400 flex flex-col items-center">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 animate-pulse border border-emerald-500/20">
                  <Users className="h-7 w-7" />
                </div>
                <span className="text-sm font-semibold text-slate-200">Calling group members...</span>
                <span className="text-xs text-slate-400 mt-1">Waiting for other participants to connect</span>
              </div>
            )}
          </div>
        </div>

        {/* Controls Dock */}
        <div className="p-6 pb-8 flex items-center justify-center gap-4 z-20 bg-gradient-to-t from-black/80 to-transparent">
          <button
            type="button"
            onClick={toggleMute}
            className={`h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer ${
              isMuted
                ? "bg-rose-600/25 text-rose-400 border border-rose-500/50 hover:bg-rose-600/35"
                : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/60"
            }`}
            title={isMuted ? "Unmute microphone" : "Mute microphone"}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {callType === "video" && (
            <button
              type="button"
              onClick={toggleCamera}
              className={`h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer ${
                isCameraOff
                  ? "bg-rose-600/25 text-rose-400 border border-rose-500/50 hover:bg-rose-600/35"
                  : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/60"
              }`}
              title={isCameraOff ? "Turn on camera" : "Turn off camera"}
              aria-label={isCameraOff ? "Turn on camera" : "Turn off camera"}
            >
              {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => endCall("Left group call")}
            className="h-14 w-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Leave group call"
            aria-label="Leave group call"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
      </div>
    );
  }

  // --- STATE 3: 1-to-1 Outgoing, Connecting, or Connected Active Call Screen ---
  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed z-50 transition-all duration-300 ${
        isMinimized
          ? "bottom-5 right-5 w-84 h-52 rounded-2xl shadow-2xl bg-slate-900 border border-slate-700/80 overflow-hidden"
          : "inset-0 bg-slate-950/98 backdrop-blur-xl flex flex-col justify-between"
      }`}
    >
      {/* Hidden audio element to play remote sound regardless of video display */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Top Header Bar */}
      <div className="p-4 sm:p-5 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center border border-slate-700 overflow-hidden">
            {callPeer?.profilePic ? (
              <img
                src={callPeer.profilePic}
                alt={callPeer.name}
                className="h-full w-full object-cover"
              />
            ) : callPeer?.name ? (
              callPeer.name[0].toUpperCase()
            ) : (
              <UserIcon className="h-5 w-5" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">{callPeer?.name}</h4>
            <div className="flex items-center gap-1.5 text-xs">
              {callState === "outgoing" && (
                <span className="text-emerald-400 animate-pulse font-medium">Ringing...</span>
              )}
              {callState === "connecting" && (
                <span className="text-amber-400 animate-pulse font-medium">Connecting...</span>
              )}
              {callState === "connected" && (
                <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{formatDuration(callDuration)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsMinimized((prev) => !prev)}
          className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/60"
          title={isMinimized ? "Maximize call" : "Minimize call"}
          aria-label={isMinimized ? "Maximize call" : "Minimize call"}
        >
          {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Center Media Feed View */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {callType === "video" ? (
          <>
            {/* Remote Peer Video Stream */}
            {remoteStream && !isRemoteCameraOff ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <div className="h-28 w-28 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 font-bold text-4xl mb-4 shadow-2xl overflow-hidden">
                  {callPeer?.profilePic ? (
                    <img
                      src={callPeer.profilePic}
                      alt={callPeer.name}
                      className="h-full w-full object-cover"
                    />
                  ) : callPeer?.name ? (
                    callPeer.name[0].toUpperCase()
                  ) : (
                    <UserIcon className="h-12 w-12" />
                  )}
                </div>
                <h4 className="text-base font-semibold text-white mb-1">{callPeer?.name}</h4>
                <p className="text-xs text-slate-400">
                  {isRemoteCameraOff ? "Camera turned off" : "Waiting for video..."}
                </p>
              </div>
            )}

            {/* Remote Mute Indicator Badge */}
            {isRemoteMuted && (
              <div className="absolute top-4 left-4 z-20 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-rose-300 text-xs flex items-center gap-1.5 border border-rose-500/40">
                <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                <span>Muted</span>
              </div>
            )}

            {/* Local Video Stream Picture-in-Picture (PIP) */}
            {!isMinimized && (
              <div className="absolute bottom-6 right-6 h-36 w-28 sm:h-44 sm:w-36 rounded-2xl overflow-hidden border-2 border-slate-700/80 shadow-2xl bg-slate-900 z-20">
                {localStream && !isCameraOff ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover -scale-x-100"
                  />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 text-xs">
                    <VideoOff className="h-6 w-6 text-slate-600 mb-1" />
                    <span className="text-[10px]">Camera off</span>
                  </div>
                )}
                <div className="absolute bottom-1 left-2 text-[10px] font-semibold text-white/90 drop-shadow">
                  You
                </div>
              </div>
            )}
          </>
        ) : (
          /* Voice Call Center Avatar with Audio Waveform Glow */
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="relative mb-6">
              {callState === "connected" && (
                <div className="absolute -inset-4 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
              )}
              <div className="h-32 w-32 rounded-full bg-slate-900 border-2 border-emerald-500/50 text-emerald-400 font-bold text-4xl flex items-center justify-center shadow-2xl overflow-hidden relative z-10">
                {callPeer?.profilePic ? (
                  <img
                    src={callPeer.profilePic}
                    alt={callPeer.name}
                    className="h-full w-full object-cover"
                  />
                ) : callPeer?.name ? (
                  callPeer.name[0].toUpperCase()
                ) : (
                  <UserIcon className="h-14 w-14" />
                )}
              </div>
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">{callPeer?.name}</h3>
            <p className="text-sm font-medium text-slate-400 mb-3">
              {callState === "outgoing"
                ? "Ringing contact..."
                : callState === "connecting"
                ? "Establishing connection..."
                : "Voice Call Connected"}
            </p>

            {isRemoteMuted && (
              <span className="text-xs text-rose-400 flex items-center gap-1 font-medium bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30">
                <VolumeX className="h-3.5 w-3.5" />
                {callPeer?.name} is muted
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Floating Call Controls Dock */}
      <div className="p-6 pb-8 flex items-center justify-center gap-4 z-20 bg-gradient-to-t from-black/80 to-transparent">
        <button
          type="button"
          onClick={toggleMute}
          className={`h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer ${
            isMuted
              ? "bg-rose-600/25 text-rose-400 border border-rose-500/50 hover:bg-rose-600/35"
              : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/60"
          }`}
          title={isMuted ? "Unmute microphone" : "Mute microphone"}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {callType === "video" && (
          <button
            type="button"
            onClick={toggleCamera}
            className={`h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer ${
              isCameraOff
                ? "bg-rose-600/25 text-rose-400 border border-rose-500/50 hover:bg-rose-600/35"
                : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/60"
            }`}
            title={isCameraOff ? "Turn on camera" : "Turn off camera"}
            aria-label={isCameraOff ? "Turn on camera" : "Turn off camera"}
          >
            {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => endCall("Call ended by user")}
          className="h-14 w-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="End call"
          aria-label="End call"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

export default CallModal;
