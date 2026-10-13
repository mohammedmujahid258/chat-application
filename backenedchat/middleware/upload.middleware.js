import multer from "multer";

// Keep the file in memory so it can be uploaded directly to Cloudinary.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    // Videos
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/ogg",
    "video/x-matroska",
    // Documents
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "application/x-zip-compressed",
    // Audio / Voice
    "audio/webm",
    "audio/ogg",
    "audio/mp3",
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/m4a",
    "audio/mp4",
    "audio/aac",
    "audio/x-m4a",
    "audio/opus",
  ];

  const mime = (file.mimetype || "").toLowerCase();
  const name = (file.originalname || "").toLowerCase();

  const isAudioExtension = /\.(webm|ogg|mp3|wav|m4a|aac|opus)$/i.test(name);
  const isImageExtension = /\.(jpe?g|png|gif|webp|svg)$/i.test(name);
  const isVideoExtension = /\.(mp4|webm|mov|ogg|mkv)$/i.test(name);
  const isDocExtension = /\.(pdf|txt|csv|docx?|xlsx?|pptx?|zip)$/i.test(name);

  if (
    allowedMimes.includes(mime) ||
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/") ||
    isAudioExtension ||
    isImageExtension ||
    isVideoExtension ||
    isDocExtension
  ) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type (${file.mimetype || "unknown"}). Please upload an image, video, audio, or supported document.`), false);
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB maximum
  fileFilter,
});
