import mongoose from "mongoose";

const callLogSchema = new mongoose.Schema(
  {
    callId: {
      type: String,
      default: "",
      index: true,
    },
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    isGroupCall: {
      type: Boolean,
      default: false,
    },
    callType: {
      type: String,
      enum: ["voice", "video"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "initiated",
        "ringing",
        "connected",
        "rejected",
        "missed",
        "ended",
        "busy",
        "failed",
      ],
      default: "initiated",
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number,
      default: 0, // duration in seconds
    },
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        leftAt: {
          type: Date,
          default: null,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const CallLog = mongoose.model("CallLog", callLogSchema);
export default CallLog;
