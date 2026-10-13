import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import API from "../services/api.js";
import {
  User,
  Mail,
  Camera,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Save,
  Trash2,
} from "lucide-react";

const Profile = () => {
  const { authUser, updateUser } = useAuth();

  const [name, setName] = useState(authUser?.name || "");
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(authUser?.profilePic || "");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select a valid image file (PNG, JPG, WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Image size exceeds 5MB limit.");
      return;
    }

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemovePhoto(false);
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setImagePreview("");
    setRemovePhoto(true);
    setErrorMsg("");
    setSuccessMsg("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!name.trim()) {
      setErrorMsg("Name cannot be empty.");
      return;
    }

    try {
      setIsSaving(true);

      const formData = new FormData();
      formData.append("name", name.trim());
      if (removePhoto) {
        formData.append("removeProfilePic", "true");
      } else if (selectedFile) {
        formData.append("profilePic", selectedFile);
      }

      const res = await API.put("/users/profile", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const updated = res.data.user;
      updateUser(updated);
      setSelectedFile(null);
      setRemovePhoto(false);
      setImagePreview(updated.profilePic || "");
      setSuccessMsg("Profile updated successfully!");
    } catch (err) {
      console.error("Failed to update profile:", err);
      setErrorMsg(err.response?.data?.message || "Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--bg-app)] p-4 sm:p-6 lg:p-8 flex items-center justify-center transition-colors">
      <div className="w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Header with back button */}
        <div className="flex items-center justify-between pb-6 border-b border-[var(--border-subtle)] mb-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2.5 rounded-xl bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-[var(--border-subtle)]"
              title="Back to Chat"
              aria-label="Back to Chat"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                Profile Settings
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Manage your account information and avatar
              </p>
            </div>
          </div>
        </div>

        {/* Feedback alerts */}
        {successMsg && (
          <div className="mb-6 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar upload section */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative group">
              <div className="h-28 w-28 rounded-full border-2 border-emerald-500/40 bg-[var(--bg-input)] flex items-center justify-center overflow-hidden shadow-xl shadow-emerald-600/10">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt={name || "User avatar"}
                    className="h-full w-full object-cover"
                    onError={() => setImagePreview("")}
                  />
                ) : (
                  <span className="text-3xl font-bold text-emerald-500">
                    {name ? name[0].toUpperCase() : <User className="h-10 w-10" />}
                  </span>
                )}
              </div>

              {/* Upload overlay button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-xs"
                title="Change profile picture"
                aria-label="Change profile picture"
              >
                <Camera className="h-6 w-6 mb-1 text-emerald-300" />
                <span className="text-[10px] font-semibold text-slate-100">Change</span>
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />

            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-emerald-500 hover:text-emerald-400 font-semibold cursor-pointer"
              >
                Upload Photo
              </button>
              {imagePreview && (
                <>
                  <span className="text-[var(--text-secondary)]">•</span>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Remove</span>
                  </button>
                </>
              )}
            </div>

            <p className="text-[11px] text-[var(--text-secondary)] mt-1 text-center">
              JPG, PNG or WEBP, max 5MB
            </p>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Full Name"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[var(--text-primary)]">
                  Email Address
                </label>
                <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </span>
              </div>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
                <input
                  type="email"
                  value={authUser?.email || ""}
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] opacity-80 cursor-not-allowed select-none"
                />
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                Your email address is linked to your account and cannot be modified.
              </p>
            </div>
          </div>

          {/* Save button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
