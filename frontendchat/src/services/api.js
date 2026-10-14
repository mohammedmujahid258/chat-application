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

const resolvedApiUrl =
  sanitizedEnvUrl && sanitizedEnvUrl.startsWith("http")
    ? sanitizedEnvUrl
    : defaultApiUrl;

const API = axios.create({
  baseURL: resolvedApiUrl,
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
