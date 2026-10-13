import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        sender:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User",
            required:true,
        },
        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: function () {
                return !this.group;
            },
            default: null,
        },
        group: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            default: null,
            index: true,
        },
        content: {
            type: String,
            default: "",
            trim: true,
        },
        fileUrl: {
            type: String,
            default: "",
        },
        fileName: {
            type: String,
            default: "",
        },
        fileType: {
            type: String,
            default: "",
        },
        fileSize: {
            type: Number,
            default: 0,
        },
        duration: {
            type: Number,
            default: 0,
        },
        waveform: {
            type: [Number],
            default: [],
        },
        seen: {
            type: Boolean,
            default: false,
        },
        seenAt: {
            type: Date,
            default: null,
        },
        seenBy: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                seenAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        isEdited: {
            type: Boolean,
            default: false,
        },
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
        pinnedAt: {
            type: Date,
            default: null,
        },
        pinnedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        reactions: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true,
                },
                emoji: {
                    type: String,
                    required: true,
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);
const Message = mongoose.model("Message", messageSchema);
export default Message
