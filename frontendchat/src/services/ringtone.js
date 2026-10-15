/**
 * Ringtone Service for ChatSphere
 * Handles incoming call audio playback, loop repetition, autoplay policy detection,
 * Web Audio API synthesizer fallback, and mute control.
 */

class RingtoneService {
  constructor() {
    this.audio = null;
    this.audioContext = null;
    this.synthInterval = null;
    this.synthTimeouts = [];
    this.isPlaying = false;
    this.isMuted = false;
    this.autoplayBlocked = false;
    this.onBlockedCallback = null;
    this.interactionHandler = null;
  }

  /**
   * Initializes or returns the cached HTMLAudioElement instance.
   */
  getAudioElement() {
    if (!this.audio && typeof window !== "undefined") {
      this.audio = new Audio("/sounds/ringtone.wav");
      this.audio.loop = true;
      this.audio.preload = "auto";
      this.audio.volume = 0.9;

      // In case of error loading .wav, fall back to .mp3
      this.audio.addEventListener("error", () => {
        console.warn("Ringtone WAV load error, falling back to MP3");
        if (this.audio && !this.audio.src.endsWith("ringtone.mp3")) {
          this.audio.src = "/sounds/ringtone.mp3";
          if (this.isPlaying && !this.isMuted) {
            this.audio.play().catch((e) => console.warn("Fallback audio play error:", e));
          }
        }
      });
    }
    return this.audio;
  }

  /**
   * Synthesize WhatsApp-like marimba ringtone via Web Audio API (robust fallback)
   */
  startSynthFallback() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext || this.audioContext.state === "closed") {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(() => {});
      }

      const ctx = this.audioContext;
      const notes = {
        E5: 659.25,
        F_sharp5: 739.99,
        G_sharp5: 830.61,
        A5: 880.0,
        B5: 987.77,
        C_sharp6: 1108.73,
        D_sharp6: 1244.51,
        E6: 1318.51,
        F_sharp6: 1479.98,
        G_sharp6: 1661.22,
      };

      const sequence = [
        [0.00, [notes.G_sharp5, notes.E6], 0.38],
        [0.22, [notes.B5], 0.32],
        [0.44, [notes.E5, notes.G_sharp5], 0.35],
        [0.66, [notes.C_sharp6], 0.32],
        [0.88, [notes.D_sharp6], 0.32],
        [1.10, [notes.B5, notes.E6], 0.45],
        [1.42, [notes.G_sharp5, notes.C_sharp6], 0.55],
        [2.10, [notes.A5, notes.F_sharp6], 0.38],
        [2.32, [notes.C_sharp6], 0.32],
        [2.54, [notes.F_sharp5, notes.A5], 0.35],
        [2.76, [notes.D_sharp6], 0.32],
        [2.98, [notes.E6], 0.32],
        [3.20, [notes.C_sharp6, notes.F_sharp6], 0.45],
        [3.52, [notes.B5, notes.G_sharp6], 0.70],
      ];

      const playPhrase = () => {
        if (!this.isPlaying || this.isMuted) return;

        const startTime = ctx.currentTime + 0.05;

        sequence.forEach(([delay, freqs, decay]) => {
          const tid = setTimeout(() => {
            if (!this.isPlaying || this.isMuted) return;
            const t = ctx.currentTime;

            freqs.forEach((freq) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();

              osc.type = "sine";
              osc.frequency.setValueAtTime(freq, t);

              // Harmonic
              const osc2 = ctx.createOscillator();
              const gain2 = ctx.createGain();
              osc2.type = "triangle";
              osc2.frequency.setValueAtTime(freq * 2, t);

              // Envelope
              gain.gain.setValueAtTime(0.0001, t);
              gain.gain.exponentialRampToValueAtTime(0.3, t + 0.005);
              gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);

              gain2.gain.setValueAtTime(0.0001, t);
              gain2.gain.exponentialRampToValueAtTime(0.08, t + 0.005);
              gain2.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.7);

              osc.connect(gain);
              gain.connect(ctx.destination);
              osc2.connect(gain2);
              gain2.connect(ctx.destination);

              osc.start(t);
              osc.stop(t + decay);
              osc2.start(t);
              osc2.stop(t + decay);
            });
          }, delay * 1000);

          this.synthTimeouts.push(tid);
        });
      };

      playPhrase();
      this.synthInterval = setInterval(playPhrase, 4800);
    } catch (e) {
      console.warn("Web Audio API synth error:", e);
    }
  }

  stopSynthFallback() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    this.synthTimeouts.forEach((tid) => clearTimeout(tid));
    this.synthTimeouts = [];

    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        this.audioContext.suspend().catch(() => {});
      } catch (e) {
        // Ignore
      }
    }
  }

  /**
   * Start playing incoming call ringtone.
   * @param {Object} options
   * @param {Function} options.onAutoplayBlocked - Callback when autoplay policy prevents instant audio playback
   */
  start({ onAutoplayBlocked } = {}) {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.autoplayBlocked = false;
    this.onBlockedCallback = onAutoplayBlocked || null;

    if (this.isMuted) {
      return;
    }

    const audio = this.getAudioElement();
    if (!audio) return;

    audio.currentTime = 0;
    audio.loop = true;
    audio.volume = 0.9;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.autoplayBlocked = false;
          if (this.onBlockedCallback) {
            this.onBlockedCallback(false);
          }
          this.removeInteractionListener();
        })
        .catch((err) => {
          console.warn("Ringtone audio.play() blocked or failed:", err.name, err.message);

          if (err.name === "NotAllowedError" || err.name === "AbortError") {
            this.autoplayBlocked = true;
            if (this.onBlockedCallback) {
              this.onBlockedCallback(true);
            }
            this.attachInteractionListener();
          } else {
            // If file playback had a decode or network issue, start synth fallback
            this.startSynthFallback();
          }
        });
    }
  }

  /**
   * Attaches a one-time global user interaction listener to resume audio if blocked by browser policy
   */
  attachInteractionListener() {
    this.removeInteractionListener();

    this.interactionHandler = () => {
      if (this.isPlaying && this.autoplayBlocked && !this.isMuted) {
        this.unlockAudio();
      }
    };

    window.addEventListener("click", this.interactionHandler, { once: true, passive: true });
    window.addEventListener("keydown", this.interactionHandler, { once: true, passive: true });
    window.addEventListener("touchstart", this.interactionHandler, { once: true, passive: true });
  }

  removeInteractionListener() {
    if (this.interactionHandler) {
      window.removeEventListener("click", this.interactionHandler);
      window.removeEventListener("keydown", this.interactionHandler);
      window.removeEventListener("touchstart", this.interactionHandler);
      this.interactionHandler = null;
    }
  }

  /**
   * Explicitly unlock and play audio upon user interaction (e.g. clicking "Enable Sound" button)
   */
  unlockAudio() {
    if (!this.isPlaying) return;

    this.autoplayBlocked = false;
    if (this.onBlockedCallback) {
      this.onBlockedCallback(false);
    }
    this.removeInteractionListener();

    if (this.isMuted) return;

    const audio = this.getAudioElement();
    if (audio) {
      audio.play().catch((err) => {
        console.warn("Unlocking audio with HTMLAudioElement failed, falling back to Web Audio synth:", err);
        this.startSynthFallback();
      });
    } else {
      this.startSynthFallback();
    }
  }

  /**
   * Stop ringtone immediately (call answered, rejected, cancelled, timeout, or component unmount)
   */
  stop() {
    this.isPlaying = false;
    this.autoplayBlocked = false;
    this.removeInteractionListener();
    this.stopSynthFallback();

    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch (e) {
        console.error("Error stopping ringtone audio:", e);
      }
    }

    if (this.onBlockedCallback) {
      this.onBlockedCallback(false);
    }
  }

  /**
   * Toggle mute for the current ringtone without rejecting the call
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      if (this.audio) this.audio.pause();
      this.stopSynthFallback();
    } else if (this.isPlaying) {
      const audio = this.getAudioElement();
      if (audio) {
        audio.play().catch(() => this.startSynthFallback());
      }
    }
    return this.isMuted;
  }

  getIsMuted() {
    return this.isMuted;
  }

  getIsPlaying() {
    return this.isPlaying;
  }

  getIsAutoplayBlocked() {
    return this.autoplayBlocked;
  }
}

// Export singleton instance
export const ringtoneService = new RingtoneService();
export default ringtoneService;
