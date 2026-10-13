import { useEffect, useState } from "react";
import API from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useCall } from "../context/CallContext.jsx";
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  X,
  Clock,
  User as UserIcon,
  Loader2,
  Users,
} from "lucide-react";

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

const formatCallTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const timeString = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return `Today, ${timeString}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${timeString}`;
};

export const CallHistoryModal = ({ isOpen, onClose }) => {
  const { authUser } = useAuth();
  const { startCall } = useCall();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const myId = authUser?._id || authUser?.id;

  useEffect(() => {
    if (!isOpen) return;

    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await API.get("/calls/history");
        setHistory(res.data.history || []);
      } catch (err) {
        console.error("Failed to load call history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCallback = (item) => {
    onClose();
    const otherUser =
      item.caller?._id === myId || item.caller?.id === myId
        ? item.receiver
        : item.caller;

    if (otherUser) {
      startCall({ targetUser: otherUser, type: item.callType || "voice" });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Call History</h3>
              <p className="text-xs text-[var(--text-secondary)]">Recent voice and video calls</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            aria-label="Close call history"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-[var(--border-subtle)]">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[var(--text-secondary)] gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              <span className="text-xs">Loading call logs...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-2xl bg-[var(--bg-input)] text-[var(--text-secondary)] flex items-center justify-center mb-3">
                <Clock className="h-6 w-6 stroke-1 text-[var(--text-secondary)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">No calls yet</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs">
                Your incoming, outgoing, and missed calls will appear here.
              </p>
            </div>
          ) : (
            history.map((item) => {
              const isCallerMe =
                item.caller?._id === myId || item.caller?.id === myId;
              const otherParty = isCallerMe ? item.receiver : item.caller;
              const isGroup = Boolean(item.isGroupCall || item.group);
              const displayName = isGroup
                ? item.group?.name || "Group Call"
                : otherParty?.name || "User";
              const displayPic = isGroup
                ? item.group?.groupPic
                : otherParty?.profilePic;

              const isMissed =
                item.status === "missed" ||
                item.status === "rejected" ||
                item.status === "failed";

              return (
                <div
                  key={item._id}
                  className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-[var(--bg-hover)] rounded-2xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-[var(--bg-input)] text-emerald-500 font-semibold flex items-center justify-center border border-[var(--border-subtle)] text-sm overflow-hidden shrink-0">
                      {displayPic ? (
                        <img src={displayPic} alt={displayName} className="h-full w-full object-cover" />
                      ) : isGroup ? (
                        <Users className="h-5 w-5" />
                      ) : displayName ? (
                        displayName[0].toUpperCase()
                      ) : (
                        <UserIcon className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {displayName}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] mt-0.5">
                        {isMissed ? (
                          <PhoneMissed className="h-3 w-3 text-rose-400 shrink-0" />
                        ) : isCallerMe ? (
                          <PhoneOutgoing className="h-3 w-3 text-teal-400 shrink-0" />
                        ) : (
                          <PhoneIncoming className="h-3 w-3 text-emerald-400 shrink-0" />
                        )}
                        <span className={isMissed ? "text-rose-400 font-medium" : ""}>
                          {isMissed ? "Missed call" : formatDuration(item.duration)}
                        </span>
                        <span>•</span>
                        <span>{formatCallTime(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {!isGroup && otherParty && (
                    <button
                      type="button"
                      onClick={() => handleCallback(item)}
                      className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-colors cursor-pointer border border-emerald-500/20 shrink-0"
                      title={`Call back (${item.callType || "voice"})`}
                      aria-label={`Call back ${displayName}`}
                    >
                      {item.callType === "video" ? (
                        <Video className="h-4 w-4" />
                      ) : (
                        <Phone className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CallHistoryModal;
