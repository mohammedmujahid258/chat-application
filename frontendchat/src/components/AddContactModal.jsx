import { useState, useEffect, useRef } from "react";
import API from "../services/api.js";
import {
  UserPlus,
  Search,
  X,
  Check,
  Loader2,
  User as UserIcon,
  Mail,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export const AddContactModal = ({
  isOpen,
  onClose,
  existingContactIds = [],
  onContactAdded,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Focus input on open & clear state on close
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setError(null);
      setSuccess(null);
      setHasSearched(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError(null);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await API.get("/users/search", {
          params: { q: trimmed },
        });
        const matched = res.data?.users || (Array.isArray(res.data) ? res.data : []);
        setResults(matched);
        setHasSearched(true);
      } catch (err) {
        console.error("User search failed:", err);
        setError(err.response?.data?.message || "Failed to search users. Please try again.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, isOpen]);

  if (!isOpen) return null;

  const handleAddContact = async (user) => {
    const userId = user._id || user.id;
    if (!userId) return;

    setAddingId(userId);
    setError(null);
    setSuccess(null);

    try {
      const res = await API.post(`/users/contacts/${userId}`);
      const addedContact = res.data?.contact || user;
      setSuccess(`Added ${user.name || "user"} to your contacts!`);

      if (typeof onContactAdded === "function") {
        onContactAdded(addedContact);
      }
    } catch (err) {
      console.error("Add contact failed:", err);
      setError(
        err.response?.data?.message ||
          "Failed to add contact. Please check your connection and try again."
      );
    } finally {
      setAddingId(null);
    }
  };

  const contactIdSet = new Set((existingContactIds || []).map(String));

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
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Add New Contact</h3>
              <p className="text-xs text-[var(--text-secondary)]">Search users by name or email</p>
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

        {/* Search Input */}
        <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a name or email address..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Feedback alerts */}
        {(error || success) && (
          <div className="px-4 pt-3">
            {error && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="flex-1">{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="flex-1">{success}</span>
              </div>
            )}
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="p-8 text-center text-xs text-[var(--text-secondary)] flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              <span>Searching users...</span>
            </div>
          ) : !query.trim() ? (
            <div className="p-8 text-center text-xs text-[var(--text-secondary)] flex flex-col items-center justify-center">
              <Search className="h-8 w-8 text-slate-500/40 mb-2" />
              <p className="font-semibold text-[var(--text-primary)]">Find someone to message</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Type a name or email address above to search for users.
              </p>
            </div>
          ) : results.length === 0 && hasSearched ? (
            <div className="p-8 text-center text-xs text-[var(--text-secondary)] flex flex-col items-center justify-center">
              <UserIcon className="h-8 w-8 text-slate-500/40 mb-2" />
              <p className="font-semibold text-[var(--text-primary)]">No matching users</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                No registered users found matching "{query}".
              </p>
            </div>
          ) : (
            results.map((user) => {
              const uId = String(user._id || user.id);
              const isAlreadyAdded = contactIdSet.has(uId);
              const isAdding = addingId === uId;

              return (
                <div
                  key={uId}
                  className="p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)]/50 hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-full bg-[var(--bg-input)] text-emerald-500 font-bold flex items-center justify-center border border-[var(--border-subtle)] overflow-hidden text-sm shadow-xs">
                        {user.profilePic ? (
                          <img
                            src={user.profilePic}
                            alt={user.name}
                            className="h-full w-full object-cover"
                          />
                        ) : user.name ? (
                          user.name[0].toUpperCase()
                        ) : (
                          <UserIcon className="h-5 w-5" />
                        )}
                      </div>
                      {user.isOnline && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[var(--bg-surface)]" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {user.name}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)] truncate flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3 shrink-0 opacity-60" />
                        <span className="truncate">{user.email}</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    {isAlreadyAdded ? (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 select-none shrink-0">
                        <Check className="h-3.5 w-3.5" />
                        <span>Added</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isAdding}
                        onClick={() => handleAddContact(user)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {isAdding ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Adding...</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3.5 w-3.5" />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
