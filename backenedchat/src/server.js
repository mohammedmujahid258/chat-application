import express from "express";
import "dotenv/config";
import cors from "cors";
import connectDB from "../config/database.js";
import { app, server, isOriginAllowed } from "../config/socket.js";
import authRoutes from "../routes/auth.route.js";
import userRoutes from "../routes/user.route.js";
import messageRoutes from "../routes/message.route.js";
import callRoutes from "../routes/call.route.js";
import groupRoutes from "../routes/group.route.js";
import User from "../models/Users.model.js";

const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Handle invalid JSON in request body gracefully without leaking stack traces or returning HTML
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      message: "Invalid JSON payload in request body",
    });
  }
  next(err);
});

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/groups", groupRoutes);

app.get("/", (req, res) => {
  res.send("Chat application Backened is running");
});

// Global fallback error handler for API requests to return JSON rather than HTML stack traces
app.use((err, req, res, next) => {
  console.error("API error:", err.message);
  res.status(err.status || 500).json({
    message: "Server error",
  });
});

const startServer = async () => {
  try {
    await connectDB();

    // On startup, no sockets are connected yet. Clear any stale online statuses
    await User.updateMany({ isOnline: true }, { isOnline: false });

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exitCode = 1;
  }
};

startServer();
