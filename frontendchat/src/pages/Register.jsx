import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  MessageSquare,
  User,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Video,
  Mic,
} from "lucide-react";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim() || !email.trim() || password.length < 6) {
      setError("Please provide a valid name, email, and password (at least 6 characters).");
      return;
    }

    try {
      setIsSubmitting(true);
      await register(name.trim(), email.trim(), password);
      setSuccess("Account created successfully! Logging you in...");

      // Automatically sign in upon registration
      setTimeout(async () => {
        try {
          await login(email.trim(), password);
          navigate("/");
        } catch {
          navigate("/login");
        }
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create account. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[var(--bg-app)]">
      <div className="w-full max-w-4xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">
        {/* Left Branding Showcase (Desktop) */}
        <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-teal-950/90 text-white border-r border-[var(--border-subtle)] relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Logo */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight">ChatSphere</h3>
                <p className="text-xs text-emerald-400 font-medium">Join the Community</p>
              </div>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="relative z-10 my-10 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Private Profile</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Control your custom avatar, online status, and privacy settings.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Crystal Clear Video & Audio</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  High-fidelity direct and group calls right inside your browser.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                <Mic className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Rich Media & Files</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Send images, videos, documents, reactions, and voice messages.
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Free forever • No credit card required</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Fast Setup
            </span>
          </div>
        </div>

        {/* Right Form Card */}
        <div className="p-6 sm:p-10 flex flex-col justify-center">
          <div className="mb-8">
            <div className="lg:hidden inline-flex h-12 w-12 rounded-2xl bg-emerald-500/20 text-emerald-400 items-center justify-center mb-4 border border-emerald-500/30">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Create an Account
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5">
              Get started with real-time conversations in seconds.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-4.5">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  autoComplete="name"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-1">Must be at least 6 characters long.</p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 sm:py-3 px-4 mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-[var(--text-secondary)] mt-8">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-emerald-500 hover:text-emerald-400 font-semibold transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
