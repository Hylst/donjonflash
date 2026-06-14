// ============================================================
// DONJONFLASH — Procedural Chiptune Audio Engine & SFX
// Créateur : Hylst - Geoffroy avec l'aide d'une IA
// ============================================================

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let isMuted = false;
let isMusicPlaying = false;
let musicTimer: number | null = null;

export function initAudio(): void {
  if (ctx) return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  ctx = new AudioCtx();

  masterGain = ctx.createGain();
  masterGain.gain.value = 0.6; // comfortable master volume

  musicGain = ctx.createGain();
  musicGain.gain.value = 0.35;

  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.7;

  musicGain.connect(masterGain);
  sfxGain.connect(masterGain);
  masterGain.connect(ctx.destination);
}

export function toggleMute(): boolean {
  isMuted = !isMuted;
  if (masterGain) {
    masterGain.gain.value = isMuted ? 0 : 0.6;
  }
  return isMuted;
}

export function getMuteState(): boolean {
  return isMuted;
}

// ============================================================================
// SOUND FX (SFX)
// ============================================================================

function playTone(freq: number, type: OscillatorType, duration: number, gainVal = 0.5, slideFreq?: number): void {
  if (!ctx || !sfxGain || isMuted) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideFreq) {
    osc.frequency.exponentialRampToValueAtTime(slideFreq, ctx.currentTime + duration);
  }

  gain.gain.setValueAtTime(gainVal, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(sfxGain);

  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, gainVal = 0.5, filterFreq = 1000): void {
  if (!ctx || !sfxGain || isMuted) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);
  filter.frequency.linearRampToValueAtTime(80, ctx.currentTime + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainVal, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);

  noise.start();
  noise.stop(ctx.currentTime + duration);
}

export const sfx = {
  // ⚔ Physical Sword sweep
  swordSweep: () => playNoise(0.12, 0.4, 2500),

  // 🏹 Arrow release
  bowRelease: () => playTone(600, 'sine', 0.15, 0.5, 200),

  // 🗡️ Whirling daggers fan
  daggersFan: () => {
    playTone(850, 'triangle', 0.08, 0.4, 1200);
    setTimeout(() => playTone(950, 'triangle', 0.08, 0.3, 1400), 40);
  },

  // 🔥 Fireball Salvo
  fireballSalvo: () => {
    playNoise(0.25, 0.7, 800);
    playTone(300, 'sawtooth', 0.25, 0.6, 80);
  },

  // ❄️ Ice Glacial Nova
  iceNova: () => {
    playTone(1200, 'sine', 0.35, 0.6, 2400);
    playNoise(0.35, 0.5, 3500);
  },

  // 💥 Impact on Enemy / Chest break
  hitEnemy: () => {
    playTone(150, 'square', 0.1, 0.5, 60);
    playNoise(0.1, 0.3, 600);
  },

  // 💎 Breakable wooden chest shatter
  chestBreak: () => playNoise(0.2, 0.6, 1200),

  // 💚 Loot picked up
  pickupLoot: () => {
    playTone(520, 'sine', 0.08, 0.4, 880);
    setTimeout(() => playTone(880, 'sine', 0.12, 0.5, 1200), 70);
  },

  // 💀 Enemy Bolt projectile Incantation
  enemyShoot: () => playTone(450, 'sawtooth', 0.15, 0.4, 150),

  // ❌ Player Wounded
  playerHurt: () => {
    playTone(180, 'sawtooth', 0.2, 0.7, 50);
    playNoise(0.25, 0.6, 500);
  },

  // 🏆 Next Door opened / Victory
  victoryStep: () => {
    const tones = [440, 554.37, 659.25, 880];
    tones.forEach((f, i) => {
      setTimeout(() => playTone(f, 'triangle', 0.25, 0.5), i * 100);
    });
  },

  // 💀 Complete Game Over
  gameOver: () => {
    const tones = [300, 270, 240, 180];
    tones.forEach((f, i) => {
      setTimeout(() => playTone(f, 'sawtooth', 0.35, 0.6, i === 3 ? 60 : undefined), i * 180);
    });
  },
};

// ============================================================================
// PROCEDURAL DUNGEON-SYNTH BGM
// ============================================================================

// Immersive epic dungeon Phrygian scale
const scale = [220, 233.08, 261.63, 293.66, 329.63, 349.23, 392.00, 440];

export function startMusic(): void {
  initAudio();
  if (!ctx || !musicGain || isMusicPlaying) return;
  isMusicPlaying = true;
  if (ctx.state === 'suspended') void ctx.resume();

  let step = 0;
  const tempoMs = 180; // (~166 bpm 8-bit tracker)

  const loop = () => {
    if (!isMusicPlaying || !ctx || !musicGain || isMuted) {
      if (isMusicPlaying) musicTimer = window.setTimeout(loop, tempoMs);
      return;
    }

    // 1) Bass ostinato step (8-step rhythmic pattern)
    if (step % 2 === 0) {
      const bassFreq = scale[step % 4 === 0 ? 0 : 2] / 2; // Drop an octave
      const bassOsc = ctx.createOscillator();
      const bassEnv = ctx.createGain();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassFreq, ctx.currentTime);
      bassEnv.gain.setValueAtTime(0.4, ctx.currentTime);
      bassEnv.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.17);
      bassOsc.connect(bassEnv); bassEnv.connect(musicGain);
      bassOsc.start(); bassOsc.stop(ctx.currentTime + 0.17);
    }

    // 2) Rich Harmony Chord step (Pad)
    if (step % 4 === 0) {
      const root = scale[step % 8 === 0 ? 0 : 2];
      const fifth = root * 1.5;
      [root, fifth].forEach(f => {
        const chordOsc = ctx!.createOscillator();
        const chordEnv = ctx!.createGain();
        chordOsc.type = 'triangle';
        chordOsc.frequency.setValueAtTime(f, ctx!.currentTime);
        chordEnv.gain.setValueAtTime(0.15, ctx!.currentTime);
        chordEnv.gain.exponentialRampToValueAtTime(0.01, ctx!.currentTime + 0.35);
        chordOsc.connect(chordEnv); chordEnv.connect(musicGain!);
        chordOsc.start(); chordOsc.stop(ctx!.currentTime + 0.35);
      });
    }

    // 3) Arpeggiator Lead melody step
    const melStep = [0, 2, 4, 1, 3, 5, 2, 7][step % 8];
    const leadFreq = scale[melStep];
    const leadOsc = ctx.createOscillator();
    const leadEnv = ctx.createGain();
    leadOsc.type = 'square';
    leadOsc.frequency.setValueAtTime(leadFreq, ctx.currentTime);
    leadEnv.gain.setValueAtTime(0.2, ctx.currentTime);
    leadEnv.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.12);
    leadOsc.connect(leadEnv); leadEnv.connect(musicGain);
    leadOsc.start(); leadOsc.stop(ctx.currentTime + 0.12);

    // 4) Chiptune Snare hit step
    if (step % 4 === 2) {
      playNoise(0.08, 0.25, 4000);
    }

    step++;
    musicTimer = window.setTimeout(loop, tempoMs);
  };

  musicTimer = window.setTimeout(loop, tempoMs);
}

export function stopMusic(): void {
  isMusicPlaying = false;
  if (musicTimer !== null) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}
