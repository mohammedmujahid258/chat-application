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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/groups", groupRoutes);

app.get("/", (req, res) => {
  res.send("Chat application Backened is running");
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
