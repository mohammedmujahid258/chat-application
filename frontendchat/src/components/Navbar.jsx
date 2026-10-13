import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import {
  MessageSquare,
  LogOut,
  User as UserIcon,
  Settings,
  Phone,
  Sun,
  Moon,
  ShieldCheck,
} from "lucide-react";
import CallHistoryModal from "./CallHistoryModal.jsx";

const Navbar = () => {
  const { authUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showCallHistory, setShowCallHistory] = useState(false);

  return (
    <>
      <header className="h-14 sm:h-16 border-b border-[var(--border-subtle)] bg-[var(--bg-header)] px-4 sm:px-6 backdrop-blur-md flex items-center justify-between sticky top-0 z-30 transition-colors">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
            <MessageSquare className="h-5 w-5 fill-white/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)]">
                ChatSphere
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <ShieldCheck className="h-2.5 w-2.5" />
                Encrypted
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] hidden sm:block">
              Real-Time Messaging & Calling
            </p>
          </div>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-slate-700" />
            )}
          </button>

          {authUser && (
            <>
              {/* Call History Button */}
              <button
                type="button"
                onClick={() => setShowCallHistory(true)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] transition-all cursor-pointer"
                title="Call History"
                aria-label="View call history"
              >
                <Phone className="h-3.5 w-3.5 text-emerald-500" />
                <span className="hidden md:inline">Calls</span>
              </button>

              {/* User Profile Pill */}
              <Link
                to="/profile"
                className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs transition-all"
                title="Profile Settings"
              >
                <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-semibold text-xs border border-emerald-500/30 overflow-hidden shrink-0">
                  {authUser.profilePic ? (
                    <img
                      src={authUser.profilePic}
                      alt={authUser.name}
                      className="h-full w-full object-cover"
                    />
                  ) : authUser.name ? (
                    authUser.name[0].toUpperCase()
                  ) : (
                    <UserIcon className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="hidden lg:block text-left max-w-[120px]">
                  <span className="block text-xs font-semibold text-[var(--text-primary)] truncate">
                    {authUser.name}
                  </span>
                </div>
              </Link>

              {/* Account Settings Icon */}
              <Link
                to="/profile"
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-xl transition-colors hidden sm:flex"
                title="Account Settings"
                aria-label="Account Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>

              {/* Logout Button */}
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors border border-transparent hover:border-rose-500/20 cursor-pointer"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Persistent Call History Modal */}
      <CallHistoryModal
        isOpen={showCallHistory}
        onClose={() => setShowCallHistory(false)}
      />
    </>
  );
};

export default Navbar;
