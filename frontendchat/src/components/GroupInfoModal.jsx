import { useState } from "react";
import API from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import {
  Users,
  X,
  Shield,
  UserPlus,
  UserMinus,
  LogOut,
  Edit2,
  Check,
  User as UserIcon,
  AlertCircle,
  Loader2,
} from "lucide-react";

export const GroupInfoModal = ({
  isOpen,
  onClose,
  group,
  availableUsers = [],
  onGroupUpdated,
  onGroupLeft,
}) => {
  const { authUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group?.name || "");
  const [editDesc, setEditDesc] = useState(group?.description || "");
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !group) return null;

  const myId = String(authUser?._id || authUser?.id || "");
  const isAdmin =
    String(group.admin?._id || group.admin) === myId ||
    (group.admins || []).some((a) => String(a._id || a) === myId);

  const currentMemberIds = new Set((group.members || []).map((m) => String(m._id || m)));
  const usersAvailableToAdd = availableUsers.filter(
    (u) => !currentMemberIds.has(String(u._id))
  );

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await API.put(`/groups/${group._id}`, {
        name: editName.trim(),
        description: editDesc.trim(),
      });
      if (onGroupUpdated) onGroupUpdated(res.data.group);
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update group");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedToAdd.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await API.put(`/groups/${group._id}/members`, {
        members: selectedToAdd,
      });
      if (onGroupUpdated) onGroupUpdated(res.data.group);
      setSelectedToAdd([]);
      setShowAddMembers(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add members");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await API.delete(`/groups/${group._id}/members/${memberId}`);
      if (onGroupUpdated) onGroupUpdated(res.data.group);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove member");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm("Are you sure you want to leave this group?")) return;
    setLoading(true);
    setError(null);
    try {
      await API.post(`/groups/${group._id}/leave`);
      if (onGroupLeft) onGroupLeft(group._id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to leave group");
    } finally {
      setLoading(false);
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
        className="w-full max-w-md rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Group Info</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {group.members?.length || 0} members
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Group Avatar & Titles */}
          <div className="flex flex-col items-center text-center">
            <div className="h-20 w-20 rounded-full bg-[var(--bg-input)] border-2 border-emerald-500/40 flex items-center justify-center text-emerald-500 overflow-hidden shadow-lg mb-3">
              {group.groupPic ? (
                <img src={group.groupPic} alt={group.name} className="h-full w-full object-cover" />
              ) : (
                <Users className="h-9 w-9" />
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveDetails} className="w-full space-y-2 mt-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                  required
                />
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Group description"
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-emerald-500"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                  >
                    Save
                  </button>
                </div>
              </form>
            ) : (
              <div className="relative group/name">
                <div className="flex items-center justify-center gap-2">
                  <h4 className="text-lg font-bold text-[var(--text-primary)]">{group.name}</h4>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-emerald-500 cursor-pointer"
                      title="Edit group details"
                      aria-label="Edit group details"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {group.description && (
                  <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs">{group.description}</p>
                )}
              </div>
            )}
          </div>

          {/* Members List Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Members ({group.members?.length || 0})
              </span>
              {isAdmin && usersAvailableToAdd.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddMembers((prev) => !prev)}
                  className="text-xs font-semibold text-emerald-500 hover:text-emerald-400 flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{showAddMembers ? "Hide" : "Add Member"}</span>
                </button>
              )}
            </div>

            {/* Add member picker */}
            {showAddMembers && (
              <div className="mb-3 p-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-2">
                <p className="text-[11px] font-semibold text-[var(--text-secondary)]">Select contacts to add:</p>
                <div className="max-h-32 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                  {usersAvailableToAdd.map((u) => {
                    const isSelected = selectedToAdd.includes(u._id);
                    return (
                      <div
                        key={u._id}
                        onClick={() =>
                          setSelectedToAdd((prev) =>
                            isSelected ? prev.filter((id) => id !== u._id) : [...prev, u._id]
                          )
                        }
                        className={`p-2 flex items-center justify-between cursor-pointer rounded-xl text-xs ${
                          isSelected ? "bg-emerald-500/15" : "hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        <span className="text-[var(--text-primary)] font-medium">{u.name}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleAddMembers}
                  disabled={loading || selectedToAdd.length === 0}
                  className="w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs disabled:opacity-40"
                >
                  Confirm Add ({selectedToAdd.length})
                </button>
              </div>
            )}

            {/* Member rows */}
            <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-app)] max-h-56 overflow-y-auto">
              {(group.members || []).map((member) => {
                const memId = String(member._id || member);
                const isMemberAdmin =
                  String(group.admin?._id || group.admin) === memId ||
                  (group.admins || []).some((a) => String(a._id || a) === memId);
                const isMe = memId === myId;

                return (
                  <div
                    key={memId}
                    className="p-2.5 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-[var(--bg-input)] text-emerald-500 font-semibold flex items-center justify-center text-xs overflow-hidden shrink-0 border border-[var(--border-subtle)]">
                        {member.profilePic ? (
                          <img src={member.profilePic} alt={member.name} className="h-full w-full object-cover" />
                        ) : (
                          member.name?.[0]?.toUpperCase() || <UserIcon className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                            {member.name || "Member"} {isMe && "(You)"}
                          </p>
                          {isMemberAdmin && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-500 flex items-center gap-0.5">
                              <Shield className="h-2.5 w-2.5" />
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] truncate">{member.email}</p>
                      </div>
                    </div>

                    {isAdmin && !isMe && !isMemberAdmin && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(memId)}
                        disabled={loading}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                        title="Remove member"
                        aria-label={`Remove ${member.name}`}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave Group Action */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleLeaveGroup}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Leave Group</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupInfoModal;
