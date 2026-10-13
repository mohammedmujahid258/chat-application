import { useState, useRef } from "react";
import API from "../services/api.js";
import {
  Users,
  X,
  Camera,
  Search,
  Check,
  Loader2,
  User as UserIcon,
} from "lucide-react";

export const CreateGroupModal = ({ isOpen, onClose, availableUsers = [], onGroupCreated }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupPicFile, setGroupPicFile] = useState(null);
  const [groupPicPreview, setGroupPicPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file for the group picture.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Group picture size exceeds 5MB limit.");
      return;
    }

    setGroupPicFile(file);
    const previewUrl = URL.createObjectURL(file);
    setGroupPicPreview(previewUrl);
    setError(null);
  };

  const toggleSelectUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a group name");
      return;
    }

    if (selectedUserIds.length === 0) {
      setError("Please select at least one member for the group");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      if (description.trim()) {
        formData.append("description", description.trim());
      }
      formData.append("members", JSON.stringify(selectedUserIds));
      if (groupPicFile) {
        formData.append("groupPic", groupPicFile);
      }

      const res = await API.post("/groups", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (onGroupCreated) {
        onGroupCreated(res.data.group);
      }

      onClose();
    } catch (err) {
      console.error("Failed to create group:", err);
      setError(err.response?.data?.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = availableUsers.filter((u) =>
    (u.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Create New Group</h3>
              <p className="text-xs text-[var(--text-secondary)]">Start a group conversation</p>
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

        {/* Form Body */}
        <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Group Picture & Name */}
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              <div className="h-16 w-16 rounded-full border-2 border-emerald-500/40 bg-[var(--bg-input)] flex items-center justify-center overflow-hidden">
                {groupPicPreview ? (
                  <img src={groupPicPreview} alt="Group preview" className="h-full w-full object-cover" />
                ) : (
                  <Users className="h-7 w-7 text-emerald-500" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Upload group picture"
                aria-label="Upload group picture"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            <div className="flex-1">
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                Group Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g. Product Team"
                required
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Members Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">
                Add Members ({selectedUserIds.length} selected)
              </label>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-app)]">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--text-secondary)]">No contacts available</div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = selectedUserIds.includes(user._id);
                  return (
                    <div
                      key={user._id}
                      onClick={() => toggleSelectUser(user._id)}
                      className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected ? "bg-emerald-500/10" : "hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-[var(--bg-input)] text-emerald-500 font-semibold flex items-center justify-center text-xs overflow-hidden shrink-0 border border-[var(--border-subtle)]">
                          {user.profilePic ? (
                            <img src={user.profilePic} alt={user.name} className="h-full w-full object-cover" />
                          ) : (
                            user.name?.[0]?.toUpperCase() || <UserIcon className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{user.name}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] truncate">{user.email}</p>
                        </div>
                      </div>

                      <div
                        className={`h-5 w-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-[var(--border-subtle)] bg-[var(--bg-input)]"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || selectedUserIds.length === 0 || !name.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>Create Group ({selectedUserIds.length} members)</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;
