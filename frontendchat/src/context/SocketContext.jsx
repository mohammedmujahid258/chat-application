import { createContext, useContext, useEffect, useState } from "react";
import io from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { authUser, token } = useAuth();

  const userId = authUser ? String(authUser.id || authUser._id || "") : null;

  useEffect(() => {
    if (!userId || !token) {
      setOnlineUsers([]);
      setSocket((currentSocket) => {
        currentSocket?.disconnect();
        return null;
      });
      return undefined;
    }

    const rawSocketUrl = import.meta.env.VITE_SOCKET_URL || "";
    const sanitizedSocketUrl = rawSocketUrl
      .replace(/^VITE_SOCKET_URL\s*=\s*/i, "")
      .trim()
      .replace(/\/+$/, "");

    const isProductionDomain =
      typeof window !== "undefined" &&
      (window.location.hostname.includes("onrender.com") || window.location.hostname !== "localhost");

    const defaultSocketUrl = isProductionDomain
      ? "https://chat-application-ewnk.onrender.com"
      : "http://localhost:5000";

    const isLocalSocketUrl =
      sanitizedSocketUrl.includes("localhost") || sanitizedSocketUrl.includes("127.0.0.1");

    const socketUrl =
      sanitizedSocketUrl && sanitizedSocketUrl.startsWith("http") && !(isProductionDomain && isLocalSocketUrl)
        ? sanitizedSocketUrl
        : defaultSocketUrl;

    const newSocket = io(socketUrl, {
      auth: { token },
      query: { userId },
      reconnection: true,
    });

    const handleOnlineUsers = (users) => {
      setOnlineUsers((users || []).map((id) => String(id)));
    };

    const handleUserStatusChanged = ({ userId: changedId, isOnline: changedOnline }) => {
      const targetId = String(changedId || "");
      if (!targetId) return;
      setOnlineUsers((prev) => {
        if (changedOnline) {
          return prev.includes(targetId) ? prev : [...prev, targetId];
        } else {
          return prev.filter((id) => id !== targetId);
        }
      });
    };

    const handleDisconnect = () => {
      // Do not keep showing stale users while this client is disconnected.
      setOnlineUsers([]);
    };

    newSocket.on("getOnlineUsers", handleOnlineUsers);
    newSocket.on("userStatusChanged", handleUserStatusChanged);
    newSocket.on("disconnect", handleDisconnect);
    setSocket(newSocket);

    return () => {
      newSocket.off("getOnlineUsers", handleOnlineUsers);
      newSocket.off("userStatusChanged", handleUserStatusChanged);
      newSocket.off("disconnect", handleDisconnect);
      newSocket.disconnect();
    };
  }, [userId, token]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};
