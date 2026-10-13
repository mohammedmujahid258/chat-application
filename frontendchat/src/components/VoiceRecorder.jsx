import { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  Trash2,
  Send,
  Play,
  Pause,
  AlertCircle,
} from "lucide-react";

export const VoiceRecorder = ({ onSendVoice, disabled = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const [liveVolume, setLiveVolume] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const previewAudioRef = useRef(null);
  const waveformPeaksRef = useRef([]);

  // Clean up all media tracks and timers
  const cleanupStreams = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.error("AudioContext close error:", e);
      }
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error("Error stopping media track:", e);
        }
      });
      streamRef.current = null;
    }

    if (previewAudioUrl) {
      URL.revokeObjectURL(previewAudioUrl);
      setPreviewAudioUrl(null);
    }
  };

  useEffect(() => {
    return () => {
      cleanupStreams();
    };
  }, []);

  // Monitor preview audio playback
  useEffect(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setPreviewCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPreviewPlaying(false);
      setPreviewCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [previewAudioUrl]);

  // Request mic permission and begin recording
  const startRecording = async () => {
    setErrorMessage(null);
    setRecordedBlob(null);
    if (previewAudioUrl) {
      URL.revokeObjectURL(previewAudioUrl);
      setPreviewAudioUrl(null);
    }
    audioChunksRef.current = [];
    waveformPeaksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage("Your browser does not support audio recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Setup Web Audio Analyser for live visual waveform
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalized = Math.min(1, average / 128);
        setLiveVolume(normalized);
        waveformPeaksRef.current.push(Number(normalized.toFixed(2)));

        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // Configure MediaRecorder
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/ogg;codecs=opus";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "";
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalMimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: finalMimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewAudioUrl(url);
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingDuration(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMessage("Microphone permission denied. Please enable microphone access.");
      } else {
        setErrorMessage("Could not access microphone.");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    cleanupStreams();
    setIsRecording(false);
    setRecordedBlob(null);
    setRecordingDuration(0);
    setErrorMessage(null);
  };

  const handleSend = () => {
    if (!recordedBlob) return;
    const finalDuration = recordingDuration || 1;

    // Resample waveform peaks to standard 28 bars
    const rawPeaks = waveformPeaksRef.current;
    const targetCount = 28;
    const sampledWaveform = [];
    if (rawPeaks.length > 0) {
      const step = rawPeaks.length / targetCount;
      for (let i = 0; i < targetCount; i++) {
        const index = Math.min(rawPeaks.length - 1, Math.floor(i * step));
        sampledWaveform.push(rawPeaks[index]);
      }
    }

    const file = new File([recordedBlob], `voice_message_${Date.now()}.webm`, {
      type: recordedBlob.type || "audio/webm",
    });

    if (onSendVoice) {
      onSendVoice({
        file,
        duration: finalDuration,
        waveform: sampledWaveform,
      });
    }

    cancelRecording();
  };

  const togglePreviewPlay = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (isPreviewPlaying) {
      audio.pause();
      setIsPreviewPlaying(false);
    } else {
      audio.play().then(() => setIsPreviewPlaying(true));
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // State 1: In active live recording mode
  if (isRecording) {
    return (
      <div className="flex items-center gap-3 bg-[var(--bg-app)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-2xl animate-in fade-in max-w-full">
        {/* Pulsing Red Recording Indicator */}
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="font-mono text-xs font-semibold text-rose-400">
            {formatTimer(recordingDuration)}
          </span>
        </div>

        {/* Live Visualizer Bars */}
        <div className="flex items-center gap-[3px] h-5 px-2">
          {[0.2, 0.4, 0.7, 1.0, 0.8, 0.5, 0.3].map((factor, idx) => {
            const heightMultiplier = Math.max(0.15, Math.min(1, liveVolume * factor * 2));
            return (
              <span
                key={idx}
                className="w-1 bg-emerald-500 rounded-full transition-all duration-75"
                style={{ height: `${Math.round(heightMultiplier * 20)}px` }}
              />
            );
          })}
        </div>

        {/* Cancel Trash Button */}
        <button
          type="button"
          onClick={cancelRecording}
          className="p-1.5 text-[var(--text-secondary)] hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
          title="Discard recording"
          aria-label="Discard recording"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        {/* Stop & Review Button */}
        <button
          type="button"
          onClick={stopRecording}
          className="h-8 w-8 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center cursor-pointer shadow-md transition-transform active:scale-95"
          title="Stop recording"
          aria-label="Stop recording"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>
      </div>
    );
  }

  // State 2: Recorded blob preview mode (Listen before sending)
  if (previewAudioUrl && recordedBlob) {
    return (
      <div className="flex items-center gap-2.5 bg-[var(--bg-app)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-2xl animate-in fade-in">
        <audio ref={previewAudioRef} src={previewAudioUrl} />

        <button
          type="button"
          onClick={togglePreviewPlay}
          className="h-7 w-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer shrink-0 shadow-sm"
          title={isPreviewPlaying ? "Pause preview" : "Play preview"}
          aria-label={isPreviewPlaying ? "Pause preview" : "Play preview"}
        >
          {isPreviewPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 ml-0.5 fill-current" />}
        </button>

        <span className="font-mono text-xs text-[var(--text-primary)] min-w-[36px]">
          {formatTimer(Math.round(previewCurrentTime || recordingDuration))}
        </span>

        <button
          type="button"
          onClick={cancelRecording}
          className="p-1.5 text-[var(--text-secondary)] hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
          title="Discard recording"
          aria-label="Discard recording"
        >
          <Trash2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={handleSend}
          className="h-8 w-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer shadow-md transition-transform active:scale-95"
          title="Send voice message"
          aria-label="Send voice message"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // State 3: Default Mic Button Trigger
  return (
    <div className="relative">
      {errorMessage && (
        <div className="absolute bottom-12 right-0 p-2.5 rounded-xl bg-rose-950/90 border border-rose-800 text-rose-300 text-xs w-60 z-30 shadow-xl flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <button
        type="button"
        onClick={startRecording}
        disabled={disabled}
        className="h-10 w-10 rounded-xl bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-emerald-500 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-40 shrink-0"
        title="Record voice message"
        aria-label="Record voice message"
      >
        <Mic className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
      </button>
    </div>
  );
};

export default VoiceRecorder;
