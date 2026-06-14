import { useEffect, useRef, useCallback, useState } from 'react';
import type { GameState, Keys, HeroClass, SpellScroll, Difficulty } from './game/types';
import { createGameState, update, rescale } from './game/engine';
import { render } from './game/renderer';
import { dims } from './game/dimensions';
import { toggleMute, getMuteState } from './game/audio';
import t1Url from './assets/onboarding_1.jpg';
import t2Url from './assets/onboarding_2.jpg';
import t3Url from './assets/onboarding_3.jpg';

interface Hud {
  status: GameState['status'];
  selectedClass: HeroClass;
  selectedDifficulty: Difficulty;
  heroLevel: number;
  xp: number;
  xpNext: number;
  roomLevel: number;
  roomName: string;
  roomModifier: GameState['roomModifier'];
  score: number;
  combo: number;
  comboPct: number;
  health: number;
  maxHealth: number;
  enemyCount: number;
  chestCount: number;
  goldKey: boolean;
  doorOpen: boolean;
  activeScroll: SpellScroll | null;
  hasteActive: boolean;
  hasteTime: number;
  hasteMax: number;
  shieldActive: boolean;
  shieldTime: number;
  shieldMax: number;
  isMuted: boolean;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState>(createGameState());
  const keysRef = useRef<Keys>({ up: false, down: false, left: false, right: false, space: false, spell: false, enter: false });
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const hudAccumRef = useRef<number>(0);
  const [showTouch, setShowTouch] = useState(false);
  const [onboardingSlide, setOnboardingSlide] = useState<number>(0);
  const [hud, setHud] = useState<Hud>({
    status: 'menu', selectedClass: 'warrior', selectedDifficulty: 'easy', heroLevel: 1, xp: 0, xpNext: 100, roomLevel: 0, roomName: '', roomModifier: 'none', score: 0, combo: 0, comboPct: 0,
    health: 7, maxHealth: 7, enemyCount: 0, chestCount: 0, goldKey: false, doorOpen: false, activeScroll: null, hasteActive: false, hasteTime: 0, hasteMax: 1, shieldActive: false, shieldTime: 0, shieldMax: 1, isMuted: false,
  });

  const gameLoop = useCallback((timestamp: number) => {
    const state = stateRef.current;
    const keys = keysRef.current;

    let dt = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;
    if (dt > 0.1) dt = 0.016;
    if (dt <= 0) dt = 0.016;

    update(state, dt, keys);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) render(ctx, state, timestamp / 1000);
    }

    hudAccumRef.current += dt;
    if (hudAccumRef.current >= 0.07) {
      hudAccumRef.current = 0;
      setHud({
        status: state.status,
        selectedClass: state.selectedClass,
        selectedDifficulty: state.selectedDifficulty,
        heroLevel: state.player.heroLevel,
        xp: state.player.xp,
        xpNext: state.player.xpNext,
        roomLevel: state.roomLevel,
        roomName: state.roomName,
        roomModifier: state.roomModifier,
        score: state.score,
        combo: state.combo,
        comboPct: state.combo > 0 ? Math.max(0, state.comboTimer / 2.4) : 0,
        health: state.player.health,
        maxHealth: state.player.maxHealth,
        enemyCount: state.enemies.filter(e => e.health > 0 && e.dyingTimer <= 0).length,
        chestCount: state.chests.filter(c => !c.opened).length,
        goldKey: !!state.goldKey,
        doorOpen: !!(state.door && state.door.open && state.door.animProgress >= 1),
        activeScroll: state.player.activeScroll,
        hasteActive: state.player.activeBuffs.some(b => b.type === 'speed'),
        hasteTime: state.player.activeBuffs.find(b => b.type === 'speed')?.duration ?? 0,
        hasteMax: state.player.activeBuffs.find(b => b.type === 'speed')?.maxDuration ?? 1,
        shieldActive: state.player.activeBuffs.some(b => b.type === 'shield'),
        shieldTime: state.player.activeBuffs.find(b => b.type === 'shield')?.duration ?? 0,
        shieldMax: state.player.activeBuffs.find(b => b.type === 'shield')?.maxDuration ?? 1,
        isMuted: getMuteState(),
      });
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const cssW = Math.max(320, Math.floor(rect.width));
    const cssH = Math.max(240, Math.floor(rect.height));
    let pxW = Math.min(2400, Math.floor(cssW * dpr));
    let pxH = Math.min(1500, Math.floor(cssH * dpr));
    if (canvas.width !== pxW || canvas.height !== pxH) {
      const oldW = dims.w, oldH = dims.h;
      canvas.width = pxW; canvas.height = pxH;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      dims.w = pxW; dims.h = pxH;
      dims.pad = Math.max(36, Math.min(96, Math.round(Math.min(pxW, pxH) * 0.075)));
      dims.pillarSize = Math.max(34, Math.min(76, Math.round(Math.min(pxW, pxH) * 0.062)));
      rescale(oldW, oldH, stateRef.current);
    }
    void pxW; void pxH;
  }, []);

  useEffect(() => {
    setShowTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    resize();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    if (containerRef.current) ro.observe(containerRef.current);

    const handleKeyDown = (e: KeyboardEvent) => {
      const k = keysRef.current;
      const st = stateRef.current;
      switch (e.code) {
        case 'ArrowUp': case 'KeyW': case 'KeyZ': k.up = true; break;
        case 'ArrowDown': case 'KeyS': k.down = true; break;
        case 'ArrowLeft': case 'KeyA': case 'KeyQ': k.left = true; break;
        case 'ArrowRight': case 'KeyD': k.right = true; break;
        case 'Space': k.space = true; e.preventDefault(); break;
        case 'ShiftLeft': case 'ShiftRight': case 'KeyF': case 'KeyE': k.spell = true; e.preventDefault(); break;
        case 'Escape': case 'KeyP':
          if (st.status === 'playing') st.status = 'paused';
          else if (st.status === 'paused') st.status = 'playing';
          e.preventDefault();
          break;
        case 'Enter': k.enter = true; e.preventDefault(); break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const k = keysRef.current;
      switch (e.code) {
        case 'ArrowUp': case 'KeyW': case 'KeyZ': k.up = false; break;
        case 'ArrowDown': case 'KeyS': k.down = false; break;
        case 'ArrowLeft': case 'KeyA': case 'KeyQ': k.left = false; break;
        case 'ArrowRight': case 'KeyD': k.right = false; break;
        case 'Space': k.space = false; break;
        case 'ShiftLeft': case 'ShiftRight': case 'KeyF': case 'KeyE': k.spell = false; break;
        case 'Enter': k.enter = false; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      ro.disconnect();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameLoop, resize]);

  const selectHeroClass = (cls: HeroClass) => () => {
    stateRef.current.selectedClass = cls;
    setHud(h => ({ ...h, selectedClass: cls }));
  };

  const selectDifficulty = (diff: Difficulty) => () => {
    stateRef.current.selectedDifficulty = diff;
    setHud(h => ({ ...h, selectedDifficulty: diff }));
  };

  const startTutorial = () => {
    stateRef.current.status = 'onboarding';
    setOnboardingSlide(0);
    setHud(h => ({ ...h, status: 'onboarding' }));
  };

  const nextSlideOrPlay = () => {
    if (onboardingSlide < 2) {
      setOnboardingSlide(s => s + 1);
    } else {
      keysRef.current.enter = true;
      setTimeout(() => { keysRef.current.enter = false; }, 100);
    }
  };

  const togglePause = () => {
    const st = stateRef.current;
    if (st.status === 'playing') st.status = 'paused';
    else if (st.status === 'paused') st.status = 'playing';
  };

  const muteAudio = () => {
    toggleMute();
    setHud(h => ({ ...h, isMuted: getMuteState() }));
  };

  const touch = (action: keyof Keys, val: boolean) => (e: React.TouchEvent) => {
    e.preventDefault();
    keysRef.current[action] = val;
  };

  const playing = hud.status === 'playing';
  const paused = hud.status === 'paused';
  const menu = hud.status === 'menu';
  const onboarding = hud.status === 'onboarding';
  const hearts = Array.from({ length: hud.maxHealth });

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-[#06060e] overflow-hidden select-none relative font-mono text-emerald-100" style={{ fontFamily: 'Orbitron, monospace' }}>
      {/* ===== 1) MENU RECRUITMENT OVERLAY ===== */}
      {menu && (
        <div className="absolute inset-0 z-40 bg-[#070812]/95 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-8 overflow-y-auto">
          {/* Top Title */}
          <div className="text-center mt-2 sm:mt-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-2xl shadow-[0_0_20px_rgba(0,255,150,0.3)] animate-pulse mb-2">
              ⚔️
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_22px_rgba(0,255,150,0.5)] leading-tight">
              DONJONFLASH
            </h1>
            <p className="text-xs sm:text-sm text-slate-300/90 tracking-widest mt-1 uppercase">
              Action RPG Tactique · Rendu 360° · SFX 8-Bit
            </p>
          </div>

          {/* Hero Selection Cards */}
          <div className="w-full max-w-5xl my-3">
            <h2 className="text-center text-xs sm:text-sm tracking-widest text-amber-300 uppercase mb-3 flex items-center justify-center gap-2">
              <span className="h-px w-8 bg-amber-400/50" /> CHOISISSEZ VOTRE CLASSE <span className="h-px w-8 bg-amber-400/50" />
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <HeroCard
                active={hud.selectedClass === 'warrior'} onClick={selectHeroClass('warrior')}
                icon="🛡️" name="Guerrier Sanctifié" hp="7 PV (+2/NV)" spd="Modérée"
                wpn="Épée Lourde (Balayage + Armure + Crit)" spell="Boules de Feu 🔥 ×2"
                accent="from-rose-500/20 to-red-900/40 border-rose-500/50 shadow-rose-500/20"
              />
              <HeroCard
                active={hud.selectedClass === 'ranger'} onClick={selectHeroClass('ranger')}
                icon="🏹" name="Ranger de l'Ombre" hp="5 PV (+1/NV)" spd="Rapide"
                wpn="Arc (Double Tir NV3, Perçant NV6)" spell="Nova de Gel ❄️"
                accent="from-emerald-500/20 to-teal-900/40 border-emerald-500/50 shadow-emerald-500/20"
              />
              <HeroCard
                active={hud.selectedClass === 'rogue'} onClick={selectHeroClass('rogue')}
                icon="🗡️" name="Filou Vif-Argent" hp="4 PV (+1/NV)" spd="Maximale"
                wpn="Dagues (×1 NV1, ×2 NV5, ×3 NV10)" spell="Boules de Feu 🔥"
                accent="from-cyan-500/20 to-blue-900/40 border-cyan-500/50 shadow-cyan-500/20"
              />
            </div>
          </div>

          {/* Difficulty Selector */}
          <div className="w-full max-w-5xl my-2">
            <h2 className="text-center text-xs sm:text-sm tracking-widest text-slate-400 uppercase mb-2 flex items-center justify-center gap-2">
              <span className="h-px w-6 bg-slate-500/50" /> DIFFICULTÉ <span className="h-px w-6 bg-slate-500/50" />
            </h2>
            <div className="flex justify-center gap-3">
              {([
                { key: 'easy' as Difficulty, label: 'Facile', icon: '🌱', desc: 'Mode standard', color: 'from-emerald-500/20 to-green-900/40 border-emerald-500/50 text-emerald-300' },
                { key: 'normal' as Difficulty, label: 'Normal', icon: '⚔️', desc: '-25% tir, -20% PV', color: 'from-amber-500/20 to-orange-900/40 border-amber-500/50 text-amber-300' },
                { key: 'hard' as Difficulty, label: 'Difficile', icon: '💀', desc: '-50% tir, -40% PV', color: 'from-red-500/20 to-rose-900/40 border-red-500/50 text-red-300' },
              ]).map(d => (
                <button key={d.key} onClick={selectDifficulty(d.key)}
                  className={`px-4 py-2 rounded-xl border bg-gradient-to-b ${d.color} transition-all cursor-pointer text-center ${hud.selectedDifficulty === d.key ? 'ring-2 ring-white/60 scale-105' : 'opacity-60 hover:opacity-90'}`}>
                  <div className="text-lg">{d.icon}</div>
                  <div className="font-bold text-xs sm:text-sm">{d.label}</div>
                  <div className="text-[10px] opacity-70">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="text-center mb-2 w-full max-w-2xl flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => {
                keysRef.current.enter = true;
                setTimeout(() => { keysRef.current.enter = false; }, 100);
              }}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 active:scale-95 hover:brightness-110 text-slate-950 font-black text-base sm:text-lg tracking-wider uppercase transition-all shadow-[0_0_30px_rgba(255,200,50,0.5)] cursor-pointer"
            >
              JOUER (ENTRÉE) ▶
            </button>
            <button
              onClick={startTutorial}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 active:scale-95 hover:brightness-110 text-slate-950 font-black text-base sm:text-lg tracking-wider uppercase transition-all shadow-[0_0_30px_rgba(0,255,160,0.5)] cursor-pointer"
            >
              TUTORIEL & RÈGLES ▶
            </button>
          </div>
          <div className="text-[10px] text-slate-500 tracking-wide mt-4 text-center">
            Hylst - Geoffroy · avec l'aide d'une IA · v6.0 Donjon Évolutif & Expérience
          </div>
        </div>
      )}

      {/* ===== 2) ONBOARDING TUTORIAL OVERLAY ===== */}
      {onboarding && (
        <div className="absolute inset-0 z-40 bg-[#070812]/95 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-8 overflow-y-auto">
          {/* Progress dots */}
          <div className="flex items-center gap-2 mt-2">
            {[0, 1, 2].map(i => (
              <span key={i} className={`h-2.5 rounded-full transition-all ${i === onboardingSlide ? 'w-10 bg-emerald-400 shadow-[0_0_10px_#34d399]' : 'w-3 bg-slate-700'}`} />
            ))}
          </div>

          {/* Carrousel card */}
          <div className="w-full max-w-3xl rounded-3xl p-6 sm:p-8 bg-[#111322]/90 border-2 border-emerald-500/40 shadow-[0_0_40px_rgba(0,255,150,0.2)] flex flex-col items-center my-4">
            {onboardingSlide === 0 && (
              <>
                <h2 className="text-2xl sm:text-3xl font-black text-emerald-300 tracking-tight mb-4 text-center">1. L'EXPLORATION DU DONJON</h2>
                <div className="w-full max-w-lg overflow-hidden rounded-2xl border-2 border-emerald-400/30 shadow-lg mb-6">
                  <img src={t1Url} alt="Le Donjon" className="w-full h-auto block object-cover hover:scale-105 transition-all duration-500" />
                </div>
                <p className="text-sm sm:text-base text-slate-300 text-center leading-relaxed font-sans max-w-xl">
                  Chaque salle génère une architecture de dalles et colonnes de pierre. Nettoyez entièrement les vagues géométriques pour faire apparaître <strong className="text-amber-300">la Clé d'Or 🗝️</strong> qui déverrouillera l'immense arche de sortie.
                </p>
              </>
            )}

            {onboardingSlide === 1 && (
              <>
                <h2 className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight mb-4 text-center">2. L'ARSENAL HÉROÏQUE</h2>
                <div className="w-full max-w-lg overflow-hidden rounded-2xl border-2 border-amber-400/30 shadow-lg mb-6">
                  <img src={t2Url} alt="L'Arsenal" className="w-full h-auto block object-cover hover:scale-105 transition-all duration-500" />
                </div>
                <p className="text-sm sm:text-base text-slate-300 text-center leading-relaxed font-sans max-w-xl">
                  Appuyez sur <strong className="text-emerald-400">ESPACE</strong> pour déclencher votre capacité physique primaire à volonté : Balayage d'épée lourde rotative, décochage de flèches d'or perforantes, ou lancers d'éventails de dagues tournoyantes tactiques.
                </p>
              </>
            )}

            {onboardingSlide === 2 && (
              <>
                <h2 className="text-2xl sm:text-3xl font-black text-cyan-300 tracking-tight mb-4 text-center">3. MAGIE ET BUTINS ANCIENS</h2>
                <div className="w-full max-w-lg overflow-hidden rounded-2xl border-2 border-cyan-400/30 shadow-lg mb-6">
                  <img src={t3Url} alt="Le Butin" className="w-full h-auto block object-cover hover:scale-105 transition-all duration-500" />
                </div>
                <p className="text-sm sm:text-base text-slate-300 text-center leading-relaxed font-sans max-w-xl">
                  Brisez <strong className="text-amber-400">les coffres en bois 💎</strong> avec vos armes pour découvrir du butin ! Appuyez sur <strong className="text-cyan-400">SHIFT ou F</strong> pour activer vos parchemins magiques (Boules de Feu explosives ou Novas de Gel total).
                </p>
              </>
            )}
          </div>

          {/* Action Navigation */}
          <div className="flex items-center gap-4 w-full max-w-md mb-2">
            <button
              onClick={nextSlideOrPlay}
              className="flex-1 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 active:scale-95 text-slate-950 font-black text-base sm:text-lg tracking-wider uppercase transition-all shadow-[0_0_25px_rgba(255,200,50,0.4)] cursor-pointer"
            >
              {onboardingSlide < 2 ? 'SUIVANT ▶' : 'ENTRER DANS LE DONJON (ENTRÉE) ⚔️'}
            </button>
          </div>
        </div>
      )}

      {/* ===== HEADER HUD IN GAME ===== */}
      <header className="relative z-20 flex-shrink-0 border-b border-emerald-500/20 bg-gradient-to-b from-[#0e101c] to-[#080912] backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2 sm:py-2.5">
          {/* Brand + Room & Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Pause & Mute active Toggle */}
            {(playing || paused) && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={togglePause}
                  className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl border active:scale-95 flex items-center justify-center text-sm font-black transition-all cursor-pointer ${paused ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_15px_gold]' : 'bg-slate-900/90 text-slate-300 border-slate-700'}`}
                  title="Pause / Tuto (Échap)"
                >
                  {paused ? '▶' : '⏸️'}
                </button>
                <button
                  onClick={muteAudio}
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-300 active:scale-95 flex items-center justify-center text-base cursor-pointer"
                  title={hud.isMuted ? 'Réactiver Son' : 'Couper Son'}
                >
                  {hud.isMuted ? '🔇' : '🔊'}
                </button>
              </div>
            )}

            <div className="min-w-0 tracking-tight ml-1 sm:ml-2">
              <div className="flex items-baseline gap-2 truncate">
                <span className="font-black text-emerald-300 text-sm sm:text-lg leading-none drop-shadow-[0_0_14px_rgba(0,255,150,0.5)]">
                  DONJONFLASH
                </span>
                {(playing || paused) && (
                  <span className="text-xs sm:text-sm font-bold text-emerald-400 truncate">
                    Salle {hud.roomLevel} <span className="text-emerald-500 font-normal">({hud.roomName})</span>
                    {hud.roomModifier === 'trapped' && <span className="text-orange-400 ml-1">🔥</span>}
                    {hud.roomModifier === 'treasure' && <span className="text-amber-300 ml-1">💎</span>}
                    {hud.roomModifier === 'reinforced' && <span className="text-red-400 ml-1">🛡️</span>}
                  </span>
                )}
              </div>
              <div className="text-[10px] sm:text-xs text-slate-400 truncate mt-0.5">
                {hud.selectedClass === 'warrior' ? 'Guerrier' : hud.selectedClass === 'ranger' ? 'Ranger' : 'Filou'}
                {' · '}
                <span className={hud.selectedDifficulty === 'hard' ? 'text-red-400' : hud.selectedDifficulty === 'normal' ? 'text-amber-400' : 'text-emerald-400'}>
                  {hud.selectedDifficulty === 'easy' ? 'Facile' : hud.selectedDifficulty === 'normal' ? 'Normal' : 'Difficile'}
                </span>
                {' · Hylst - Geoffroy'}
              </div>
            </div>
          </div>

          {/* Central XP Bar & Score & Spell Indicator */}
          <div className="flex items-center gap-4 sm:gap-8 flex-shrink-0">
            {/* XP Gauge & Level */}
            {(playing || paused) && (
              <div className="hidden md:flex flex-col items-center">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-400 tracking-wider">
                  <span>🌟 NV {hud.heroLevel}</span>
                  <span className="text-[10px] text-slate-400 font-normal">({hud.xp}/{hud.xpNext} XP)</span>
                </div>
                <div className="relative block w-28 sm:w-36 h-2 rounded-full bg-amber-950/80 border border-amber-800/60 overflow-hidden mt-0.5 shadow-[0_0_8px_rgba(255,215,0,0.2)]">
                  <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-yellow-300 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (hud.xp / hud.xpNext) * 100)}%` }} />
                </div>
              </div>
            )}

            {/* Score */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                <span className="text-amber-400 text-base sm:text-xl">★</span>
                <span className="font-black text-amber-300 text-base sm:text-2xl tabular-nums leading-none drop-shadow-[0_0_12px_rgba(255,200,60,0.5)]">
                  {hud.score.toLocaleString('fr-FR')}
                </span>
              </div>
              {hud.combo >= 2 && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[9px] sm:text-xs font-black text-cyan-300 leading-none">
                    COMBO ×{hud.combo}
                  </span>
                  <span className="relative block w-12 sm:w-16 h-1.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 overflow-hidden">
                    <span className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full shadow-[0_0_8px_cyan]" style={{ width: `${hud.comboPct * 100}%` }} />
                  </span>
                </div>
              )}
            </div>

            {/* Consumable Spell Scroll Slot */}
            {(playing || paused) && hud.activeScroll && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 shadow-inner">
                <span className="text-2xl filter drop-shadow">{hud.activeScroll.icon}</span>
                <div className="text-left leading-tight">
                  <div className="text-[11px] text-slate-400 font-bold uppercase leading-none">{hud.activeScroll.name}</div>
                  <div className="text-xs font-black text-amber-300 tracking-wider">CHARGES : {hud.activeScroll.count} <span className="text-[9px] text-slate-400 font-normal">(Touche F)</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Right Gauges */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {/* Buff Halos UI */}
            <div className="flex items-center gap-1.5">
              {hud.hasteActive && (
                <div className="flex flex-col items-center">
                  <span className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-[10px] shadow-[0_0_10px_cyan] animate-spin" title={`Hâte +35% (${hud.hasteTime.toFixed(1)}s)`}>⚡</span>
                  <div className="w-6 sm:w-7 h-1 mt-0.5 rounded-full bg-cyan-900/80 overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full transition-all duration-200" style={{ width: `${(hud.hasteTime / hud.hasteMax) * 100}%` }} />
                  </div>
                </div>
              )}
              {hud.shieldActive && (
                <div className="flex flex-col items-center">
                  <span className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-amber-500/20 border border-amber-400 flex items-center justify-center text-[10px] shadow-[0_0_10px_gold] animate-pulse" title={`Invincibilité (${hud.shieldTime.toFixed(1)}s)`}>🛡️</span>
                  <div className="w-6 sm:w-7 h-1 mt-0.5 rounded-full bg-amber-900/80 overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all duration-200" style={{ width: `${(hud.shieldTime / hud.shieldMax) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Lifes / Hearts Jauge */}
            <div className="flex items-center gap-1">
              {hearts.map((_, i) => (
                <span key={i} className={`text-base sm:text-xl transition-all duration-200 ${i < hud.health ? 'scale-100 opacity-100' : 'scale-75 opacity-30'}`} style={{ filter: i < hud.health ? 'drop-shadow(0 0 6px rgba(255,50,70,0.65))' : 'none' }}>
                  {i < hud.health ? '❤️' : '🖤'}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="h-[2px] bg-gradient-to-r from-emerald-500/10 via-emerald-400/60 to-emerald-500/10" />
      </header>

      {/* ===== GAMEPLAY CANVAS MATRIX ===== */}
      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="absolute inset-0 block touch-none"
          style={{ cursor: (playing && !showTouch) ? 'none' : 'default' }}
        />

        {/* Tactical Touch Commands overlay */}
        {showTouch && (playing || paused) && (
          <div className="pointer-events-none absolute inset-0 z-30">
            <div className="absolute bottom-5 left-5 pointer-events-auto">
              <div className="relative w-36 h-36 sm:w-40 sm:h-40">
                <DPad dir="up" className="top-0 left-1/2 -translate-x-1/2" onTouch={touch}>▲</DPad>
                <DPad dir="down" className="bottom-0 left-1/2 -translate-x-1/2" onTouch={touch}>▼</DPad>
                <DPad dir="left" className="left-0 top-1/2 -translate-y-1/2" onTouch={touch}>◀</DPad>
                <DPad dir="right" className="right-0 top-1/2 -translate-y-1/2" onTouch={touch}>▶</DPad>
              </div>
            </div>
            <div className="absolute bottom-5 right-5 pointer-events-auto flex flex-col items-end gap-3">
              {hud.activeScroll && (
                <button
                  onTouchStart={touch('spell', true)} onTouchEnd={touch('spell', false)}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-500/30 active:bg-amber-400/70 border-2 border-amber-300/60 text-amber-200 text-2xl flex items-center justify-center shadow-[0_0_20px_rgba(255,200,50,0.4)] touch-none cursor-pointer"
                >
                  {hud.activeScroll.icon}
                  <span className="absolute top-1 right-2 text-[10px] font-black">{hud.activeScroll.count}</span>
                </button>
              )}
              <button
                onTouchStart={touch('space', true)} onTouchEnd={touch('space', false)}
                className="w-22 h-22 sm:w-26 sm:h-26 rounded-full bg-emerald-500/30 active:bg-emerald-400/70 border-2 border-emerald-300/60 text-emerald-100 text-4xl flex items-center justify-center shadow-[0_0_26px_rgba(0,255,150,0.45)] touch-none cursor-pointer"
              >
                {hud.selectedClass === 'warrior' ? '⚔' : hud.selectedClass === 'ranger' ? '🏹' : '🗡️'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HeroCard({ active, onClick, icon, name, hp, spd, wpn, spell, accent }: {
  active: boolean; onClick: () => void; icon: string; name: string; hp: string; spd: string; wpn: string; spell: string; accent: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-3xl p-6 bg-gradient-to-b border-2 transition-all cursor-pointer flex flex-col justify-between ${accent} ${active ? 'scale-105 brightness-125 ring-4 ring-emerald-400 shadow-2xl' : 'opacity-80 hover:opacity-100 hover:scale-102'}`}
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-4xl filter drop-shadow-md">{icon}</span>
          <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider ${active ? 'bg-emerald-400 text-slate-950 shadow-[0_0_12px_#34d399]' : 'bg-slate-800/80 text-slate-300'}`}>
            {active ? '✓ ACTIF' : 'CHOISIR'}
          </span>
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-3">{name}</h3>

        <div className="space-y-2 text-xs text-slate-300/90 font-sans tracking-wide">
          <div className="flex items-center gap-2 font-black text-amber-300">
            <span>❤️</span> {hp} · <span>⚡</span> {spd}
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-emerald-400 font-bold block text-[10px] tracking-widest uppercase mb-1">ARMEMENT PRIMAIRE :</span>
            {wpn}
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-cyan-400 font-bold block text-[10px] tracking-widest uppercase mb-1">CAPACITÉ SECONDAIRE :</span>
            {spell}
          </div>
        </div>
      </div>

      <div className="mt-6 text-center">
        <span className={`text-[11px] font-black tracking-widest block uppercase ${active ? 'text-emerald-300 animate-pulse' : 'text-slate-500'}`}>
          {active ? 'Prêt au combat' : 'Cliquez pour recruter'}
        </span>
      </div>
    </div>
  );
}

function DPad({ dir, className, onTouch, children }: {
  dir: keyof Keys; className: string; onTouch: (d: keyof Keys, v: boolean) => (e: React.TouchEvent) => void; children: React.ReactNode;
}) {
  return (
    <button
      onTouchStart={onTouch(dir, true)} onTouchEnd={onTouch(dir, false)}
      className={`absolute w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/10 active:bg-white/40 border border-white/25 text-white text-xl flex items-center justify-center shadow-lg touch-none cursor-pointer ${className}`}
    >{children}</button>
  );
}
