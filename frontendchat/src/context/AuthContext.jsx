import { createContext, useContext, useState, useEffect } from "react";
import API from "../services/api.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("chat_user");
      if (!savedUser || savedUser === "undefined" || savedUser === "null") {
        return null;
      }
      return JSON.parse(savedUser);
    } catch (error) {
      console.error("Failed to parse saved user from localStorage:", error);
      localStorage.removeItem("chat_user");
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    const savedToken = localStorage.getItem("chat_token");
    if (!savedToken || savedToken === "undefined" || savedToken === "null") {
      return null;
    }
    return savedToken;
  });

  const [loading, setLoading] = useState(true);

  const logout = async () => {
    try {
      await API.post("/auth/logout").catch(() => {});
    } finally {
      localStorage.removeItem("chat_token");
      localStorage.removeItem("chat_user");
      setToken(null);
      setAuthUser(null);
    }
  };

  // Validate existing token with /auth/me on initial load
  useEffect(() => {
    const verifyUser = async () => {
      const storedToken = localStorage.getItem("chat_token");
      if (!storedToken || storedToken === "undefined" || storedToken === "null") {
        localStorage.removeItem("chat_token");
        localStorage.removeItem("chat_user");
        setToken(null);
        setAuthUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await API.get("/auth/me");
        if (res.data?.user) {
          setAuthUser(res.data.user);
          localStorage.setItem("chat_user", JSON.stringify(res.data.user));
        } else {
          logout();
        }
      } catch (error) {
        console.error("Token verification failed:", error);
        logout();
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, []);

  const login = async (email, password) => {
    const res = await API.post("/auth/login", { email, password });
    const { token: receivedToken, user } = res.data;

    if (receivedToken) {
      localStorage.setItem("chat_token", receivedToken);
      setToken(receivedToken);
    }
    if (user) {
      localStorage.setItem("chat_user", JSON.stringify(user));
      setAuthUser(user);
    }
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await API.post("/auth/register", { name, email, password });
    return res.data;
  };

  const updateUser = (updatedUser) => {
    if (updatedUser) {
      setAuthUser(updatedUser);
      localStorage.setItem("chat_user", JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        authUser,
        token,
        loading,
        login,
        register,
        updateUser,
        logout,
        isAuthenticated: !!authUser && !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
