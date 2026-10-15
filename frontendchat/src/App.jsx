import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import { CallProvider } from "./context/CallContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import CallModal from "./components/CallModal.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Chat from "./pages/Chat.jsx";
import Profile from "./pages/Profile.jsx";

const PublicRoute = ({ children }) => {
  const { authUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-app)] text-[var(--text-primary)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }
  if (authUser) return <Navigate to="/" replace />;
  return children;
};

const FallbackRoute = () => {
  const { authUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--bg-app)] text-[var(--text-primary)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }
  return authUser ? <Navigate to="/" replace /> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <CallProvider>
              <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col font-sans transition-colors duration-200">
                <Navbar />
                <CallModal />
                <div className="flex-1 flex flex-col">
                  <Routes>
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <Chat />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/login"
                      element={
                        <PublicRoute>
                          <Login />
                        </PublicRoute>
                      }
                    />
                    <Route
                      path="/register"
                      element={
                        <PublicRoute>
                          <Register />
                        </PublicRoute>
                      }
                    />
                    <Route path="*" element={<FallbackRoute />} />
                  </Routes>
                </div>
              </div>
            </CallProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
