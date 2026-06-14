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
// PROCEDURAL DUNGEON-SYNTH BGM — Enhanced
// ============================================================================

// Phrygian dominant scale (exotic dungeon feel)
const scale = [196, 207.65, 233.08, 261.63, 277.18, 311.13, 349.23, 392];
const bassScale = [98, 116.54, 130.81, 146.83];

// Chord progressions (root note indices in scale)
const progRoots = [0, 3, 2, 5, 0, 4, 1, 3];

export function startMusic(): void {
  initAudio();
  if (!ctx || !musicGain || isMusicPlaying) return;
  isMusicPlaying = true;
  if (ctx.state === 'suspended') void ctx.resume();

  let step = 0;
  const tempoMs = 160;

  const loop = () => {
    if (!isMusicPlaying || !ctx || !musicGain || isMuted) {
      if (isMusicPlaying) musicTimer = window.setTimeout(loop, tempoMs);
      return;
    }
    const now = ctx.currentTime;
    const barPos = step % 16;

    // 1) Kick drum (beats 0, 4, 8, 12)
    if (barPos % 4 === 0) {
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(150, now);
      kickOsc.frequency.exponentialRampToValueAtTime(30, now + 0.08);
      kickGain.gain.setValueAtTime(0.6, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      kickOsc.connect(kickGain); kickGain.connect(musicGain);
      kickOsc.start(now); kickOsc.stop(now + 0.15);
    }

    // 2) Hi-hat (every 2 steps, tighter on offbeats)
    if (barPos % 2 === 0) {
      const hhVol = barPos % 4 === 2 ? 0.18 : 0.12;
      playNoiseInMusic(0.04, hhVol, 7000);
    }

    // 3) Snare (beats 4, 12)
    if (barPos === 4 || barPos === 12) {
      playNoiseInMusic(0.1, 0.3, 3500);
      const snOsc = ctx.createOscillator();
      const snGain = ctx.createGain();
      snOsc.type = 'triangle';
      snOsc.frequency.setValueAtTime(220, now);
      snGain.gain.setValueAtTime(0.25, now);
      snGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      snOsc.connect(snGain); snGain.connect(musicGain);
      snOsc.start(now); snOsc.stop(now + 0.08);
    }

    // 4) Bass with filter sweep (every step, pattern varies)
    const bassPattern = [0, 0, 2, 0, 3, 3, 2, 0, 0, 0, 2, 3, 0, 1, 2, 0];
    const bassNote = bassScale[bassPattern[barPos]];
    const bassOsc = ctx.createOscillator();
    const bassFilter = ctx.createBiquadFilter();
    const bassEnv = ctx.createGain();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(bassNote, now);
    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(800, now);
    bassFilter.frequency.exponentialRampToValueAtTime(200, now + 0.12);
    bassEnv.gain.setValueAtTime(0.35, now);
    bassEnv.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
    bassOsc.connect(bassFilter); bassFilter.connect(bassEnv); bassEnv.connect(musicGain);
    bassOsc.start(now); bassOsc.stop(now + 0.14);

    // 5) Harmony chord pad (every 8 steps, with delay tail)
    if (barPos % 8 === 0) {
      const rootIdx = progRoots[(step >> 4) % progRoots.length];
      const root = scale[rootIdx];
      const third = scale[Math.min(rootIdx + 2, 7)];
      const fifth = root * 1.5;
      for (const f of [root, third, fifth]) {
        const cOsc = ctx!.createOscillator();
        const cGain = ctx!.createGain();
        cOsc.type = 'triangle';
        cOsc.frequency.setValueAtTime(f, now);
        cGain.gain.setValueAtTime(0.1, now);
        cGain.gain.exponentialRampToValueAtTime(0.005, now + 0.7);
        cOsc.connect(cGain); cGain.connect(musicGain!);
        cOsc.start(now); cOsc.stop(now + 0.7);
      }
    }

    // 6) Arpeggio lead with echo (delay effect)
    const arpPattern = [0, 2, 4, 7, 4, 2, 5, 3, 0, 3, 5, 7, 5, 3, 2, 0];
    const arpIdx = arpPattern[barPos];
    const rootIdx = progRoots[(step >> 4) % progRoots.length];
    const leadNote = scale[Math.min((rootIdx + arpIdx) % 8, 7)];
    playArpNote(leadNote, 0.16, 'square', 0.18, now);
    // Echo/delay at half volume, offset by 2 steps
    if (barPos % 2 === 0) {
      playArpNote(leadNote * 1.002, 0.1, 'square', 0.06, now + tempoMs / 2000);
    }

    // 7) Second harmony arp (softer, offset)
    if (barPos % 2 === 1) {
      const harmNote = scale[Math.min((rootIdx + arpIdx + 3) % 8, 7)];
      playArpNote(harmNote, 0.08, 'triangle', 0.07, now);
    }

    step++;
    musicTimer = window.setTimeout(loop, tempoMs);
  };

  musicTimer = window.setTimeout(loop, tempoMs);
}

function playArpNote(freq: number, dur: number, type: OscillatorType, vol: number, when: number): void {
  if (!ctx || !musicGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  gain.gain.setValueAtTime(vol, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
  osc.connect(gain); gain.connect(musicGain);
  osc.start(when); osc.stop(when + dur);
}

function playNoiseInMusic(dur: number, vol: number, filterFreq: number): void {
  if (!ctx || !musicGain) return;
  const now = ctx.currentTime;
  const bufferSize = ctx.sampleRate * dur;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(filterFreq, now);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  noise.connect(filter); filter.connect(gain); gain.connect(musicGain);
  noise.start(now); noise.stop(now + dur);
}

export function stopMusic(): void {
  isMusicPlaying = false;
  if (musicTimer !== null) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}
