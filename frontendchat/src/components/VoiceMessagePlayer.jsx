import { useState, useRef, useEffect } from "react";
import { Play, Pause, AlertCircle, Loader2 } from "lucide-react";

/**
 * Global tracker to ensure only one audio message plays at a time
 */
let currentlyPlayingAudio = null;

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

export const VoiceMessagePlayer = ({
  audioUrl,
  fileUrl,
  duration = 0,
  waveform = [],
  isMine = false,
}) => {
  const effectiveAudioUrl = audioUrl || fileUrl || "";
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const audioRef = useRef(null);

  // Sync duration if prop updates
  useEffect(() => {
    if (duration && (!totalDuration || totalDuration === 0)) {
      setTotalDuration(duration);
    }
  }, [duration]);

  // Generate fallback waveform bars if empty
  const defaultBars = [
    30, 50, 75, 40, 90, 60, 45, 80, 100, 70, 40, 85, 95, 60, 50, 70, 90, 40,
    30, 65, 80, 55, 35, 75, 60, 45, 30,
  ];
  const bars =
    Array.isArray(waveform) && waveform.length > 5
      ? waveform.map((v) => Math.max(15, Math.min(100, Math.round(v * 100))))
      : defaultBars;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setError(null);

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (currentlyPlayingAudio === audio) {
        currentlyPlayingAudio = null;
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      if (currentlyPlayingAudio === audio) {
        currentlyPlayingAudio = null;
      }
    };

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = () => {
      if (
        effectiveAudioUrl &&
        effectiveAudioUrl.includes("res.cloudinary.com") &&
        !audio.src.endsWith(".mp3")
      ) {
        const mp3Fallback = effectiveAudioUrl.replace(/\.[a-zA-Z0-9]+(\?.*)?$/, ".mp3$1");
        if (audio.src !== mp3Fallback) {
          audio.src = mp3Fallback;
          audio.load();
          return;
        }
      }
      setError("Failed to load audio");
      setIsLoading(false);
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
      if (currentlyPlayingAudio === audio) {
        audio.pause();
        currentlyPlayingAudio = null;
      }
    };
  }, [effectiveAudioUrl]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || error) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (currentlyPlayingAudio === audio) {
        currentlyPlayingAudio = null;
      }
    } else {
      if (currentlyPlayingAudio && currentlyPlayingAudio !== audio) {
        currentlyPlayingAudio.pause();
      }
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          currentlyPlayingAudio = audio;
        })
        .catch((err) => {
          console.error("Audio playback error:", err);
          setError("Playback blocked or failed");
          setIsPlaying(false);
        });
    }
  };

  const handleSeek = (index) => {
    const audio = audioRef.current;
    if (!audio || !totalDuration) return;
    const seekPercentage = index / bars.length;
    const targetTime = seekPercentage * totalDuration;
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const togglePlaybackRate = () => {
    const rates = [1, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const progressFraction = totalDuration > 0 ? currentTime / totalDuration : 0;

  return (
    <div className="flex items-center gap-2.5 sm:gap-3 py-1 px-1 min-w-[210px] max-w-xs sm:min-w-[260px]">
      <audio ref={audioRef} src={effectiveAudioUrl} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlayPause}
        disabled={isLoading || Boolean(error)}
        className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md ${
          isMine
            ? "bg-white text-emerald-800 hover:bg-slate-100"
            : "bg-emerald-600 text-white hover:bg-emerald-500"
        }`}
        title={isPlaying ? "Pause voice message" : "Play voice message"}
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : error ? (
          <AlertCircle className="h-4 w-4 text-rose-300" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 ml-0.5 fill-current" />
        )}
      </button>

      {/* Waveform & Timing info */}
      <div className="flex-1 min-w-0">
        {/* Interactive Waveform Bars */}
        <div className="flex items-center gap-[2.5px] h-6 cursor-pointer" title="Seek position">
          {bars.map((barHeight, idx) => {
            const barFraction = idx / bars.length;
            const isFilled = barFraction <= progressFraction;

            return (
              <div
                key={idx}
                onClick={() => handleSeek(idx)}
                className={`flex-1 rounded-full transition-all duration-75 ${
                  isMine
                    ? isFilled
                      ? "bg-white"
                      : "bg-emerald-800/60 hover:bg-emerald-700/80"
                    : isFilled
                    ? "bg-emerald-500"
                    : "bg-slate-600/40 hover:bg-slate-500/60"
                }`}
                style={{
                  height: `${barHeight}%`,
                  minHeight: "4px",
                }}
              />
            );
          })}
        </div>

        {/* Timestamp and speed toggle */}
        <div className="flex items-center justify-between mt-1 text-[10px]">
          <span
            className={`font-mono font-medium ${
              isMine ? "text-emerald-100/90" : "text-[var(--text-secondary)]"
            }`}
          >
            {isPlaying ? formatTime(currentTime) : formatTime(totalDuration)}
          </span>

          <button
            type="button"
            onClick={togglePlaybackRate}
            className={`px-1.5 py-0.2 rounded-md font-bold text-[9px] cursor-pointer transition-colors ${
              isMine
                ? "bg-black/20 text-white hover:bg-black/30"
                : "bg-slate-700/50 text-[var(--text-primary)] hover:bg-slate-700"
            }`}
            title="Toggle playback speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceMessagePlayer;
