import axios from "axios";

const rawApiUrl = import.meta.env.VITE_API_URL || "";
// Strip potential variable name prefix (e.g. "VITE_API_URL=") and trim whitespace/newlines
const sanitizedEnvUrl = rawApiUrl
  .replace(/^VITE_API_URL\s*=\s*/i, "")
  .trim()
  .replace(/\/+$/, "");

// If running in production on Render or a remote domain, fallback to the deployed backend
const isProductionDomain =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("onrender.com") || window.location.hostname !== "localhost");

const defaultApiUrl = isProductionDomain
  ? "https://chat-application-ewnk.onrender.com/api"
  : "http://localhost:5000/api";

const isLocalEnvUrl =
  sanitizedEnvUrl.includes("localhost") || sanitizedEnvUrl.includes("127.0.0.1");

// In production domains, do not use localhost even if it was baked into the build
const resolvedApiUrl =
  sanitizedEnvUrl && sanitizedEnvUrl.startsWith("http") && !(isProductionDomain && isLocalEnvUrl)
    ? sanitizedEnvUrl
    : defaultApiUrl;

const API = axios.create({
  baseURL: resolvedApiUrl,
  timeout: 45000, // 45s timeout to handle Render cold starts while avoiding indefinite hangs
});

// Automatically attach JWT token to every outgoing request if available
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("chat_token");
  if (token && token !== "undefined" && token !== "null") {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
