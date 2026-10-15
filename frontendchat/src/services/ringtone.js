/**
 * Ringtone Service for ChatSphere
 * Manages incoming call audio playback, loop repetition, autoplay policy detection,
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
      this.audio.volume = 0.95;

      // Backup loop listener if browser fails native loop attribute
      this.audio.addEventListener("ended", () => {
        if (this.isPlaying && !this.isMuted && this.audio) {
          this.audio.currentTime = 0;
          this.audio.play().catch((e) => console.warn("Ringtone loop replay error:", e));
        }
      });

      this.audio.addEventListener("error", (e) => {
        console.warn("Ringtone audio element error, falling back to Web Audio synth:", e);
        if (this.isPlaying && !this.isMuted) {
          this.startSynthFallback();
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
        A6: 1760.0,
        B6: 1975.53,
      };

      const sequence = [
        [0.00, [notes.G_sharp5, notes.E6], 0.35],
        [0.20, [notes.B5, notes.G_sharp6], 0.30],
        [0.40, [notes.E5, notes.B5], 0.30],
        [0.60, [notes.C_sharp6, notes.G_sharp6], 0.30],
        [0.80, [notes.D_sharp6, notes.B6], 0.30],
        [1.00, [notes.B5, notes.E6], 0.40],
        [1.30, [notes.G_sharp5, notes.C_sharp6], 0.50],
        [1.80, [notes.A5, notes.F_sharp6], 0.35],
        [2.00, [notes.C_sharp6, notes.A6], 0.30],
        [2.20, [notes.F_sharp5, notes.C_sharp6], 0.30],
        [2.40, [notes.D_sharp6, notes.B6], 0.30],
        [2.60, [notes.E6, notes.G_sharp6], 0.30],
        [2.80, [notes.C_sharp6, notes.F_sharp6], 0.40],
        [3.10, [notes.B5, notes.E6, notes.G_sharp6], 0.75],
      ];

      const playPhrase = () => {
        if (!this.isPlaying || this.isMuted) return;

        sequence.forEach(([delay, freqs, decay]) => {
          const tid = setTimeout(() => {
            if (!this.isPlaying || this.isMuted) return;
            const t = ctx.currentTime;

            freqs.forEach((freq) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();

              osc.type = "sine";
              osc.frequency.setValueAtTime(freq, t);

              // 2nd Harmonic for warm timbre
              const osc2 = ctx.createOscillator();
              const gain2 = ctx.createGain();
              osc2.type = "triangle";
              osc2.frequency.setValueAtTime(freq * 2, t);

              gain.gain.setValueAtTime(0.0001, t);
              gain.gain.exponentialRampToValueAtTime(0.35, t + 0.004);
              gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);

              gain2.gain.setValueAtTime(0.0001, t);
              gain2.gain.exponentialRampToValueAtTime(0.1, t + 0.004);
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
      this.synthInterval = setInterval(playPhrase, 4500);
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
   * Start playing incoming call ringtone continuously.
   * If already playing, maintains playback without restarting.
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
    if (!audio) {
      this.startSynthFallback();
      return;
    }

    audio.currentTime = 0;
    audio.loop = true;
    audio.volume = 0.95;

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
            // Audio file decode or network issue: use Web Audio API synth fallback
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
   * Explicitly unlock and play audio upon user interaction (e.g. clicking "Enable Sound" button or modal)
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
      audio.currentTime = 0;
      audio.loop = true;
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
      } else {
        this.startSynthFallback();
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
if (typeof window !== "undefined") {
  window.__ringtoneService = ringtoneService;
}
export default ringtoneService;
