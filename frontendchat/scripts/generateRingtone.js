// Script to generate a pleasant, melodic WhatsApp-style incoming call ringtone WAV file.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLE_RATE = 44100;
const DURATION = 4.8; // seconds
const TOTAL_SAMPLES = Math.floor(SAMPLE_RATE * DURATION);

// Left and Right channel float arrays
const leftChannel = new Float32Array(TOTAL_SAMPLES);
const rightChannel = new Float32Array(TOTAL_SAMPLES);

// Note frequencies (Hz)
const notes = {
  E5: 659.25,
  F_sharp5: 739.99,
  G_sharp5: 830.61,
  A5: 880.00,
  B5: 987.77,
  C_sharp6: 1108.73,
  D_sharp6: 1244.51,
  E6: 1318.51,
  F_sharp6: 1479.98,
  G_sharp6: 1661.22,
};

// Melodic sequence: [timeInSeconds, [chordFreqs], duration, pan (-1 left, 1 right), decayTime]
const sequence = [
  // Phrase 1 (Bright marimba opening)
  [0.00, [notes.G_sharp5, notes.E6], 0.40, -0.2, 0.38],
  [0.22, [notes.B5], 0.35, -0.1, 0.32],
  [0.44, [notes.E5, notes.G_sharp5], 0.35, 0.0, 0.35],
  [0.66, [notes.C_sharp6], 0.35, 0.15, 0.32],
  [0.88, [notes.D_sharp6], 0.35, -0.15, 0.32],
  [1.10, [notes.B5, notes.E6], 0.50, 0.25, 0.45],
  [1.42, [notes.G_sharp5, notes.C_sharp6], 0.65, 0.0, 0.55],

  // Phrase 2 (Ascending harmonic response)
  [2.10, [notes.A5, notes.F_sharp6], 0.40, 0.2, 0.38],
  [2.32, [notes.C_sharp6], 0.35, 0.1, 0.32],
  [2.54, [notes.F_sharp5, notes.A5], 0.35, 0.0, 0.35],
  [2.76, [notes.D_sharp6], 0.35, -0.15, 0.32],
  [2.98, [notes.E6], 0.35, 0.15, 0.32],
  [3.20, [notes.C_sharp6, notes.F_sharp6], 0.50, -0.25, 0.45],
  [3.52, [notes.B5, notes.G_sharp6], 0.85, 0.0, 0.70],
];

// Synthesize each note into audio buffers
sequence.forEach(([startTime, freqs, _dur, pan, decay]) => {
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const noteDuration = decay * 4; // synthesize until quiet
  const noteSamples = Math.floor(noteDuration * SAMPLE_RATE);

  // Equal power panning
  const angle = ((pan + 1) * Math.PI) / 4;
  const gainL = Math.cos(angle);
  const gainR = Math.sin(angle);

  for (let i = 0; i < noteSamples; i++) {
    const idx = startSample + i;
    if (idx >= TOTAL_SAMPLES) break;

    const t = i / SAMPLE_RATE;

    // Amplitude envelope: quick percussive attack + exponential decay
    const attack = Math.min(1.0, t / 0.005);
    const env = attack * Math.exp(-t / decay);

    // Strike click (wooden mallet transient)
    const strike = t < 0.012 ? (Math.random() * 2 - 1) * Math.exp(-t / 0.003) * 0.15 : 0;

    let sampleVal = 0;
    freqs.forEach((freq) => {
      // Harmonic additive synthesis: fundamental + 2nd harmonic + 3rd harmonic
      const wave =
        Math.sin(2 * Math.PI * freq * t) +
        0.32 * Math.sin(2 * Math.PI * freq * 2 * t) +
        0.12 * Math.sin(2 * Math.PI * freq * 3 * t) +
        0.05 * Math.sin(2 * Math.PI * freq * 4 * t);
      sampleVal += wave * 0.45;
    });

    const finalSample = (sampleVal * env + strike) * 0.45;

    leftChannel[idx] += finalSample * gainL;
    rightChannel[idx] += finalSample * gainR;
  }
});

// Normalize buffer to -1.5 dB peak
let maxPeak = 0;
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  const absL = Math.abs(leftChannel[i]);
  const absR = Math.abs(rightChannel[i]);
  if (absL > maxPeak) maxPeak = absL;
  if (absR > maxPeak) maxPeak = absR;
}

const targetPeak = 0.85; // ~ -1.5 dB
const normFactor = maxPeak > 0 ? targetPeak / maxPeak : 1;

for (let i = 0; i < TOTAL_SAMPLES; i++) {
  leftChannel[i] *= normFactor;
  rightChannel[i] *= normFactor;
}

// Convert float PCM to 16-bit signed integer WAV buffer
const numChannels = 2;
const bytesPerSample = 2;
const blockAlign = numChannels * bytesPerSample;
const byteRate = SAMPLE_RATE * blockAlign;
const dataSize = TOTAL_SAMPLES * blockAlign;
const buffer = Buffer.alloc(44 + dataSize);

// Write WAV Header
buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16); // Subchunk1Size
buffer.writeUInt16LE(1, 20); // PCM format
buffer.writeUInt16LE(numChannels, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(byteRate, 28);
buffer.writeUInt16LE(blockAlign, 32);
buffer.writeUInt16LE(16, 34); // BitsPerSample
buffer.write("data", 36);
buffer.writeUInt32LE(dataSize, 40);

// Write samples
let offset = 44;
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  // Clamp samples
  const sL = Math.max(-1, Math.min(1, leftChannel[i]));
  const sR = Math.max(-1, Math.min(1, rightChannel[i]));

  const intL = sL < 0 ? sL * 32768 : sL * 32767;
  const intR = sR < 0 ? sR * 32768 : sR * 32767;

  buffer.writeInt16LE(Math.floor(intL), offset);
  buffer.writeInt16LE(Math.floor(intR), offset + 2);
  offset += 4;
}

// Save output files to public directory
const outDir = path.resolve(__dirname, "../public/sounds");
fs.mkdirSync(outDir, { recursive: true });

const wavPath = path.join(outDir, "ringtone.wav");
fs.writeFileSync(wavPath, buffer);
console.log(`Successfully generated ringtone WAV: ${wavPath} (${buffer.length} bytes)`);

// Also write ringtone.mp3 as a duplicate asset in case browser queries either filename
const mp3Path = path.join(outDir, "ringtone.mp3");
fs.writeFileSync(mp3Path, buffer);
console.log(`Successfully generated ringtone asset: ${mp3Path}`);
