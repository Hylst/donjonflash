// ============================================================
// DONJONFLASH — Canvas Renderer (Multi-Class Sprites, Spells, Chests)
// Rendu riche, net, sans brouillard aveuglant.
// Créateur : Hylst - Geoffroy avec l'aide d'une IA
// ============================================================

import type { GameState, Wall, Enemy, Player, Particle, FloatingText, Door, GoldKey, BreakableChest, ConsumableItem, Projectile } from './types';
import { dims } from './dimensions';
import floorUrl from '../assets/floor.jpg';
import wallUrl from '../assets/wall.jpg';

const ATTACK_RANGE = 80;

const tex = {
  floorImg: null as HTMLImageElement | null,
  wallImg: null as HTMLImageElement | null,
  floorPattern: null as CanvasPattern | null,
  wallPattern: null as CanvasPattern | null,
  started: false,
};

function loadTextures(ctx: CanvasRenderingContext2D): void {
  if (!tex.started) {
    tex.started = true;
    const fi = new Image();
    fi.src = floorUrl;
    fi.onload = () => { tex.floorImg = fi; tex.floorPattern = ctx.createPattern(fi, 'repeat'); };
    const wi = new Image();
    wi.src = wallUrl;
    wi.onload = () => { tex.wallImg = wi; tex.wallPattern = ctx.createPattern(wi, 'repeat'); };
  }
  if (tex.floorImg && !tex.floorPattern) tex.floorPattern = ctx.createPattern(tex.floorImg, 'repeat');
  if (tex.wallImg && !tex.wallPattern) tex.wallPattern = ctx.createPattern(tex.wallImg, 'repeat');
}

let bgCanvas: HTMLCanvasElement | null = null;
let bgCtx: CanvasRenderingContext2D | null = null;
let bgW = 0, bgH = 0;

function ensureBackground(ctx: CanvasRenderingContext2D): void {
  loadTextures(ctx);
  if (!bgCanvas || bgW !== dims.w || bgH !== dims.h) {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = dims.w;
    bgCanvas.height = dims.h;
    bgCtx = bgCanvas.getContext('2d')!;
    bgW = dims.w; bgH = dims.h;
    renderBackground(bgCtx);
  }
}

function renderBackground(ctx: CanvasRenderingContext2D): void {
  const { w, h, pad } = dims;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#181824';
  ctx.fillRect(0, 0, w, h);

  if (tex.floorPattern) {
    ctx.save();
    ctx.fillStyle = tex.floorPattern;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(14,16,24,0.4)';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  } else {
    for (let x = pad; x < w - pad; x += 44) {
      for (let y = pad; y < h - pad; y += 44) {
        const b = 22 + Math.random() * 12;
        ctx.fillStyle = `rgb(${b},${b},${b + 5})`;
        ctx.fillRect(x + 1, y + 1, 42, 42);
      }
    }
  }

  // Central compass
  ctx.save();
  ctx.strokeStyle = 'rgba(0,255,160,0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 140, 0, Math.PI * 2);
  ctx.arc(w / 2, h / 2, 80, 0, Math.PI * 2);
  ctx.moveTo(w / 2 - 160, h / 2); ctx.lineTo(w / 2 + 160, h / 2);
  ctx.moveTo(w / 2, h / 2 - 160); ctx.lineTo(w / 2, h / 2 + 160);
  ctx.stroke();
  ctx.restore();
}

// --- Light sources ---
interface Light { x: number; y: number; r: number; color: string; intensity: number; }

function getTorches(): { x: number; y: number; phase: number }[] {
  const { w, h, pad } = dims;
  return [
    { x: pad + 26, y: pad + 22, phase: 0 },
    { x: w - pad - 26, y: pad + 22, phase: 1.1 },
    { x: pad + 26, y: h - pad - 22, phase: 2.2 },
    { x: w - pad - 26, y: h - pad - 22, phase: 3.3 },
    { x: w / 2 - 120, y: pad + 22, phase: 4.4 },
    { x: w / 2 + 120, y: pad + 22, phase: 5.5 },
    { x: pad + 26, y: h / 2, phase: 0.6 },
    { x: w - pad - 26, y: h / 2, phase: 3.9 },
  ];
}

function buildLights(state: GameState, time: number): Light[] {
  const lights: Light[] = [];
  const flicker = (ph: number) => 0.85 + Math.sin(time * 8 + ph) * 0.1 + Math.sin(time * 14 + ph * 2) * 0.05;

  for (const t of getTorches()) {
    const f = flicker(t.phase);
    lights.push({ x: t.x, y: t.y, r: 210 * f, color: 'rgba(255,165,65,', intensity: 0.95 * f });
  }

  // Player light
  lights.push({ x: state.player.x, y: state.player.y, r: 250, color: 'rgba(120,255,185,', intensity: 0.85 });

  if (state.goldKey && !state.goldKey.collected) {
    lights.push({ x: state.goldKey.x, y: state.goldKey.y, r: 180, color: 'rgba(255,225,85,', intensity: 0.9 });
  }

  // Enemies
  for (const e of state.enemies) {
    if (e.health <= 0 || e.spawnTimer > 0.2) continue;
    const col = e.type === 'tank' ? 'rgba(255,60,40,'
      : e.type === 'fast' ? 'rgba(255,200,30,'
      : e.type === 'shooter' ? 'rgba(210,90,255,'
      : 'rgba(255,100,55,';
    lights.push({ x: e.x, y: e.y, r: e.size * 4.5, color: col, intensity: 0.45 });
  }

  // Active Magical Projectiles (Fireballs!)
  for (const p of state.projectiles) {
    if (p.type === 'fireball') {
      lights.push({ x: p.x, y: p.y, r: 200, color: 'rgba(255,80,10,', intensity: 1.0 });
    }
  }

  return lights;
}

function applyLighting(ctx: CanvasRenderingContext2D, lights: Light[]): void {
  const { w, h } = dims;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const amb = ctx.createLinearGradient(0, 0, 0, h);
  amb.addColorStop(0, 'rgb(115,117,140)');
  amb.addColorStop(0.5, 'rgb(104,106,128)');
  amb.addColorStop(1, 'rgb(92,94,116)');
  ctx.fillStyle = amb;
  ctx.fillRect(0, 0, w, h);

  for (const l of lights) {
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.65, 'rgba(220,220,220,0.85)');
    g.addColorStop(1, 'rgba(120,120,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); ctx.fill();
  }

  ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.95);
    g.addColorStop(0, l.color + (0.2 * l.intensity) + ')');
    g.addColorStop(0.5, l.color + (0.07 * l.intensity) + ')');
    g.addColorStop(1, l.color + '0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(l.x, l.y, l.r * 0.95, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// --- Breakable Chests ---
function renderChest(ctx: CanvasRenderingContext2D, chest: BreakableChest): void {
  const { x, y, size, hitTimer, health, maxHealth, opened } = chest;
  const isHit = hitTimer > 0;

  ctx.save();
  ctx.translate(x, y);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(2, size * 0.45, size * 0.55, size * 0.25, 0, 0, Math.PI * 2); ctx.fill();

  const half = size / 2;
  if (!opened) {
    // Breakable states
    const cg = ctx.createLinearGradient(-half, -half, half, half);
    cg.addColorStop(0, isHit ? '#ffcc88' : '#8b5a2b'); cg.addColorStop(1, '#4a2e18');
    ctx.fillStyle = cg;
    roundRect(ctx, -half, -half, size, size, 4); ctx.fill();

    // Iron bands
    ctx.fillStyle = '#3a3d4d';
    ctx.fillRect(-half + 6, -half, 5, size); ctx.fillRect(half - 11, -half, 5, size);

    // Golden lock
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();

    // Fissures if damaged
    if (health < maxHealth) {
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-half + 4, -half + 4); ctx.lineTo(0, 5); ctx.lineTo(half - 4, -half + 10); ctx.stroke();
    }
  } else {
    // Shattered opened wooden bottom
    ctx.fillStyle = '#3a2e18';
    roundRect(ctx, -half, -2, size, half + 2, 4); ctx.fill();
  }

  ctx.restore();
}

// --- Consumable Loot Items ---
function renderConsumable(ctx: ConsumableItem, cctx: CanvasRenderingContext2D): void {
  const { x, y, type, bob } = ctx;
  const bobY = y + Math.sin(bob) * 5;

  cctx.save();
  cctx.translate(x, bobY);

  // Sparkle glow
  const g = cctx.createRadialGradient(0, 0, 0, 0, 0, 22);
  g.addColorStop(0, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  cctx.fillStyle = g;
  cctx.beginPath(); cctx.arc(0, 0, 22, 0, Math.PI * 2); cctx.fill();

  cctx.font = '22px serif'; cctx.textAlign = 'center';
  cctx.shadowColor = '#ffffff'; cctx.shadowBlur = 10;

  if (type === 'health_potion') cctx.fillText('❤️', 0, 7);
  else if (type === 'speed_potion') cctx.fillText('⚡', 0, 7);
  else if (type === 'shield_potion') cctx.fillText('🛡️', 0, 7);
  else if (type === 'scroll_fireball') cctx.fillText('📜', 0, 7);
  else if (type === 'scroll_nova') cctx.fillText('❄️', 0, 7);
  else if (type === 'food') cctx.fillText('🍖', 0, 7);

  cctx.shadowBlur = 0;
  cctx.restore();
}

// --- Walls ---
function renderWall(ctx: CanvasRenderingContext2D, wall: Wall, time: number): void {
  const isPillar = wall.type === 'pillar';
  const isWater = wall.type === 'water';

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(wall.x + 6, wall.y + 6, wall.width, wall.height);

  if (isWater) {
    ctx.save(); ctx.translate(wall.x, wall.y);
    ctx.fillStyle = '#0a1b2a'; ctx.fillRect(0, 0, wall.width, wall.height);
    const a = (time * 2) % 30;
    ctx.fillStyle = 'rgba(0,180,255,0.15)';
    for (let yy = 10; yy < wall.height; yy += 25) {
      ctx.fillRect(Math.sin(time + yy) * 15 + a, yy, wall.width * 0.6, 10);
    }
    ctx.strokeStyle = '#3a6e8f'; ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, wall.width - 4, wall.height - 4);
    ctx.restore();
    return;
  }

  if (tex.wallPattern) {
    ctx.save();
    const pat = ctx.createPattern(tex.wallImg!, 'repeat')!;
    ctx.fillStyle = pat;
    ctx.translate(wall.x, wall.y); ctx.fillRect(0, 0, wall.width, wall.height);
    ctx.restore();
    ctx.fillStyle = isPillar ? 'rgba(30,34,50,0.5)' : 'rgba(22,26,40,0.58)';
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
  } else {
    const g = ctx.createLinearGradient(wall.x, wall.y, wall.x + wall.width, wall.y + wall.height);
    g.addColorStop(0, '#3e3e54'); g.addColorStop(1, '#28283a');
    ctx.fillStyle = g; ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(wall.x, wall.y, wall.width, 3); ctx.fillRect(wall.x, wall.y, 3, wall.height);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(wall.x + wall.width - 3, wall.y, 3, wall.height); ctx.fillRect(wall.x, wall.y + wall.height - 3, wall.width, 3);

  if (isPillar) {
    const cx = wall.x + wall.width / 2, cy = wall.y + wall.height / 2;
    const pulse = 0.5 + Math.sin(time * 2 + wall.x * 0.02) * 0.5;
    ctx.save();
    ctx.shadowColor = '#00ffd0'; ctx.shadowBlur = 12;
    ctx.strokeStyle = `rgba(0,255,208,${0.35 + pulse * 0.5})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 10, cy - 10, 20, 20); ctx.strokeRect(cx - 5, cy - 5, 10, 10);
    ctx.restore();
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
  ctx.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.width - 1, wall.height - 1);
}

function renderTorch(ctx: CanvasRenderingContext2D, t: { x: number; y: number; phase: number }, time: number): void {
  const flicker = 0.8 + Math.sin(time * 9 + t.phase) * 0.12 + Math.sin(time * 14 + t.phase * 2) * 0.08;
  ctx.fillStyle = '#2b231d'; ctx.fillRect(t.x - 3.5, t.y - 2, 7, 14);
  ctx.fillStyle = '#4a3c32'; ctx.fillRect(t.x - 4, t.y - 2, 8, 3);
  const flameH = (14 + Math.sin(time * 11 + t.phase) * 3.5) * flicker;
  const fg = ctx.createLinearGradient(t.x, t.y - flameH, t.x, t.y + 4);
  fg.addColorStop(0, `rgba(255,230,130,${flicker})`);
  fg.addColorStop(0.45, `rgba(255,140,30,${flicker * 0.9})`); fg.addColorStop(1, 'rgba(180,30,0,0)');
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.moveTo(t.x - 5, t.y + 2);
  ctx.quadraticCurveTo(t.x - 2 + Math.sin(time * 7) * 2, t.y - flameH * 0.6, t.x, t.y - flameH);
  ctx.quadraticCurveTo(t.x + 2 + Math.sin(time * 10 + 1) * 2, t.y - flameH * 0.6, t.x + 5, t.y + 2); ctx.fill();
  ctx.fillStyle = `rgba(255,250,210,${flicker * 0.95})`;
  ctx.beginPath(); ctx.arc(t.x, t.y - 2, 2.5, 0, Math.PI * 2); ctx.fill();
}

// --- Magical Projectiles (Arrows, Daggers, Fireballs) ---
function renderProjectiles(ctx: CanvasRenderingContext2D, projectiles: Projectile[], time: number): void {
  for (const p of projectiles) {
    const { x, y, type, angle, radius } = p;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);

    if (type === 'arrow') {
      // 🏹 Piercing Golden Thorn Arrow
      ctx.shadowColor = '#ffd866'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffd866'; ctx.fillRect(-10, -1.5, 20, 3);
      // Arrowhead
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(16, 0); ctx.lineTo(10, 4); ctx.fill();
      // Feathers
      ctx.fillStyle = '#ff5500';
      ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-6, 0); ctx.lineTo(-10, 4); ctx.fill();
    } else if (type === 'dagger') {
      // 🗡️ Whirling Trickster Dagger
      ctx.rotate(time * 25);
      ctx.shadowColor = '#7dffc4'; ctx.shadowBlur = 8;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
      ctx.fillStyle = '#7dffc4'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'fireball') {
      // 🔥 Blazing Fireball Core
      const pulse = 1 + Math.sin(time * 15) * 0.15;
      ctx.scale(pulse, pulse);
      const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.4, '#ffdd33'); fg.addColorStop(0.8, '#ff3300'); fg.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'enemy_bolt') {
      // 💀 Cursed Violet Arcane Bolt
      ctx.shadowColor = '#cc66ff'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#cc66ff'; ctx.beginPath(); ctx.ellipse(0, 0, radius, radius * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(2, 0, 3, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }
}

// --- Epic Multi-Class High-End Heroes ---
function renderPlayer(ctx: CanvasRenderingContext2D, player: Player, time: number): void {
  const { x: px, y: py, radius: r, facing, invincibleTimer, trail, activeBuffs, isAttacking, heroClass } = player;

  // Trail
  for (let i = 0; i < trail.length; i++) {
    const a = (i / trail.length) * 0.18;
    const tcol = heroClass === 'warrior' ? 'rgba(80,255,160,' : heroClass === 'ranger' ? 'rgba(255,210,60,' : 'rgba(0,240,255,';
    ctx.fillStyle = tcol + a + ')';
    ctx.beginPath(); ctx.arc(trail[i].x, trail[i].y, r * (i / trail.length) * 0.8, 0, Math.PI * 2); ctx.fill();
  }

  const blink = invincibleTimer > 0 && Math.sin(time * 24) > 0;
  ctx.save();
  if (blink) ctx.globalAlpha = 0.45;
  ctx.translate(px, py);

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(0, r * 0.8, r * 1.1, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();

  // Active Potion Buff Halo
  for (const b of activeBuffs) {
    ctx.save();
    ctx.rotate(time * 6);
    ctx.strokeStyle = b.type === 'speed' ? '#00eeff' : '#ffd700';
    ctx.lineWidth = 2.5; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // Feet
  const footStep = player.moving ? Math.sin(player.walkPhase) * 7 : 0;
  ctx.fillStyle = heroClass === 'warrior' ? '#565a6e' : heroClass === 'ranger' ? '#4a3820' : '#1d222e';
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
  for (const sgn of [-1, 1]) {
    ctx.save(); ctx.rotate(facing); ctx.translate(sgn * 7, footStep * sgn);
    roundRect(ctx, -3.5, -2, 7, 10, 3); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // Cape (Warrior & Ranger) or Trickster Scarf
  ctx.save();
  ctx.rotate(facing);
  if (heroClass === 'warrior') {
    // 🛡️ Scarlet Great Cape
    const capeW = 16 + Math.sin(player.capeWave) * 3; const capeL = 22 + (player.moving ? 6 : 0);
    const capeSwing = player.moving ? Math.sin(player.walkPhase) * 0.2 : Math.sin(time * 2) * 0.08;
    ctx.rotate(Math.PI + capeSwing);
    const capeGrad = ctx.createLinearGradient(0, 0, 0, capeL);
    capeGrad.addColorStop(0, '#a81414'); capeGrad.addColorStop(1, '#ff3b3b');
    ctx.fillStyle = capeGrad;
    ctx.beginPath(); ctx.moveTo(-8, 5);
    ctx.quadraticCurveTo(-capeW / 2, capeL * 0.6, -capeW / 2 + Math.sin(player.capeWave * 1.5) * 4, capeL);
    ctx.lineTo(capeW / 2 + Math.sin(player.capeWave * 1.5) * 4, capeL);
    ctx.quadraticCurveTo(capeW / 2, capeL * 0.6, 8, 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5e0b0b'; ctx.lineWidth = 1; ctx.stroke();
  } else if (heroClass === 'ranger') {
    // 🏹 Forest Green Cape
    const capeW = 14 + Math.sin(player.capeWave) * 2; const capeL = 20 + (player.moving ? 5 : 0);
    ctx.rotate(Math.PI + Math.sin(time) * 0.08);
    const capeGrad = ctx.createLinearGradient(0, 0, 0, capeL);
    capeGrad.addColorStop(0, '#1c4a18'); capeGrad.addColorStop(1, '#3add33');
    ctx.fillStyle = capeGrad;
    ctx.beginPath(); ctx.moveTo(-7, 5);
    ctx.quadraticCurveTo(-capeW / 2, capeL * 0.6, -capeW / 2 + Math.sin(player.capeWave) * 3, capeL);
    ctx.lineTo(capeW / 2 + Math.sin(player.capeWave) * 3, capeL);
    ctx.quadraticCurveTo(capeW / 2, capeL * 0.6, 7, 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#0e2b0b'; ctx.lineWidth = 1; ctx.stroke();
  } else {
    // 🗡️ Whirling Shadow Scarf
    ctx.rotate(Math.PI + Math.sin(time * 4) * 0.2);
    ctx.fillStyle = '#00ffcc'; ctx.fillRect(-5, 6, 10, 14);
  }
  ctx.restore();

  // Torso / Suit Armor
  ctx.save();
  ctx.rotate(facing);
  const torso = ctx.createRadialGradient(0, -2, 0, 0, 0, r);
  if (heroClass === 'warrior') {
    torso.addColorStop(0, '#597587'); torso.addColorStop(0.6, '#283e4d'); torso.addColorStop(1, '#13222e');
  } else if (heroClass === 'ranger') {
    torso.addColorStop(0, '#608a38'); torso.addColorStop(0.6, '#395e19'); torso.addColorStop(1, '#1b3009');
  } else {
    torso.addColorStop(0, '#384d66'); torso.addColorStop(0.6, '#182433'); torso.addColorStop(1, '#090e17');
  }
  ctx.fillStyle = torso;
  roundRect(ctx, -r * 0.8, -r * 0.7, r * 1.6, r * 1.4, 6); ctx.fill();
  ctx.strokeStyle = heroClass === 'warrior' ? '#7498ad' : heroClass === 'ranger' ? '#a5e55e' : '#00ffcc';
  ctx.lineWidth = 1.5;
  roundRect(ctx, -r * 0.8, -r * 0.7, r * 1.6, r * 1.4, 6); ctx.stroke();

  // Pauldrons
  ctx.fillStyle = heroClass === 'warrior' ? '#e5b83b' : heroClass === 'ranger' ? '#8c5e2b' : '#33ffcc';
  ctx.beginPath(); ctx.arc(-r * 0.8, 0, 4.5, 0, Math.PI * 2); ctx.arc(r * 0.8, 0, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Head
  ctx.save();
  ctx.rotate(facing);
  const hgrad = ctx.createRadialGradient(0, -2, 0, 0, 0, r * 0.65);
  hgrad.addColorStop(0, heroClass === 'warrior' ? '#8cb5cf' : heroClass === 'ranger' ? '#558028' : '#222f3e');
  hgrad.addColorStop(1, heroClass === 'warrior' ? '#253d4f' : heroClass === 'ranger' ? '#22380d' : '#0d131a');
  ctx.fillStyle = hgrad;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();

  // Glowing Eyes/Visor
  ctx.fillStyle = heroClass === 'warrior' ? '#00ffaa' : heroClass === 'ranger' ? '#ffd866' : '#00eeff';
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
  if (heroClass === 'warrior') {
    ctx.beginPath(); ctx.ellipse(3, 0, 4, 7, 0, -Math.PI / 3, Math.PI / 3); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(3, -3, 2.2, 0, Math.PI * 2); ctx.arc(3, 3, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.restore(); // translate

  // Class-specific weapon representations
  if (heroClass === 'warrior') {
    if (isAttacking) renderWarriorSword(ctx, player);
    else {
      ctx.save(); ctx.translate(px, py); ctx.rotate(facing);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(r * 0.85, 2); ctx.lineTo(r * 0.85 + 24, 2); ctx.stroke();
      ctx.restore();
    }
  } else if (heroClass === 'ranger') {
    // 🏹 Equiped Bow
    ctx.save(); ctx.translate(px, py); ctx.rotate(facing);
    ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(r * 0.9, -15); ctx.quadraticCurveTo(r * 0.9 + 12, 0, r * 0.9, 15); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(r * 0.9 - 1, -14); ctx.lineTo(r * 0.9 - 1, 14); ctx.stroke();
    ctx.restore();
  } else {
    // 🗡️ Double Daggers
    ctx.save(); ctx.translate(px, py); ctx.rotate(facing);
    ctx.strokeStyle = '#7dffc4'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(r * 0.8, -8); ctx.lineTo(r * 0.8 + 10, -8); ctx.moveTo(r * 0.8, 8); ctx.lineTo(r * 0.8 + 10, 8); ctx.stroke();
    ctx.restore();
  }
}

function renderWarriorSword(ctx: CanvasRenderingContext2D, player: Player): void {
  const { attackProgress: prog, attackCombo: combo, attackAngle: startA } = player;
  const dir = combo === 2 ? -1 : 1;
  const curA = startA + dir * prog * (Math.PI * 0.75);

  ctx.save();
  ctx.translate(player.x, player.y);

  for (let g = 0; g < 4; g++) {
    const gp = Math.max(0, prog - g * 0.08);
    const ga = startA + dir * gp * (Math.PI * 0.75);
    const a = (1 - g / 4) * 0.25;
    const grad = ctx.createRadialGradient(0, 0, 12, 0, 0, ATTACK_RANGE);
    grad.addColorStop(0, `rgba(255,255,230,${a})`);
    grad.addColorStop(0.6, `rgba(150,255,220,${a * 0.7})`);
    grad.addColorStop(1, 'rgba(0,255,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, ATTACK_RANGE, Math.min(ga - 0.45, ga), Math.max(ga - 0.45, ga));
    ctx.closePath(); ctx.fill();
  }

  const bladeLen = ATTACK_RANGE * 0.95;
  ctx.save();
  ctx.rotate(curA);
  ctx.shadowColor = '#8affe5'; ctx.shadowBlur = 18;
  ctx.strokeStyle = 'rgba(210,255,240,0.5)';
  ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(bladeLen, 0); ctx.stroke();

  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(bladeLen, 0); ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffd866'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(14, -9); ctx.lineTo(14, 9); ctx.stroke();
  ctx.restore();

  ctx.restore();
}

// --- Enemies ---
function renderEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, time: number): void {
  const { x: cx, y: cy, size: baseSize, type, hitTimer, angle: ang, walkPhase, id, frozenTimer } = enemy;

  if (enemy.spawnTimer > 0) {
    const sp = 1 - enemy.spawnTimer / 0.7;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(time * 6);
    ctx.strokeStyle = `rgba(255,80,60,${0.6 * (1 - sp)})`;
    ctx.lineWidth = 2.5; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.arc(0, 0, baseSize * (1.5 - sp * 0.5), 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }

  let scale = 1; let alpha = 1;
  if (enemy.spawnTimer > 0) { const sp = Math.max(0, 1 - enemy.spawnTimer / 0.7); scale = sp; alpha = sp; }
  if (enemy.dyingTimer > 0) { const dp = enemy.dyingTimer / 0.4; scale = dp; alpha = dp; }

  const s = baseSize * scale;
  const half = s / 2;
  const isHit = hitTimer > 0.1;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = alpha;

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(0, half * 0.9, half * 1.1, half * 0.45, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.rotate(ang);

  let c1 = '#ff6a4a', c2 = '#8a1d12', border = 'rgba(255,120,90,0.7)';
  if (frozenTimer && frozenTimer > 0) {
    // ❄️ Glacial frozen tint
    c1 = '#a0eeff'; c2 = '#0088aa'; border = '#ffffff';
  } else if (type === 'tank') {
    c1 = isHit ? '#ffb0a0' : '#e23a2a'; c2 = '#5e0e08'; border = 'rgba(255,90,70,0.8)';
  } else if (type === 'fast') {
    c1 = isHit ? '#fff09a' : '#f4b520'; c2 = '#7a5402'; border = 'rgba(255,220,60,0.8)';
  } else if (type === 'shooter') {
    c1 = isHit ? '#e6c0ff' : '#b24bf0'; c2 = '#3c0e60'; border = 'rgba(210,120,255,0.8)';
  } else {
    if (isHit) c1 = '#ffd0b0';
  }

  if (type === 'normal') {
    const legStep = Math.sin(walkPhase) * 6;
    ctx.fillStyle = '#4a251e'; ctx.strokeStyle = '#1a0d0a'; ctx.lineWidth = 1;
    for (const sgn of [-1, 1]) {
      roundRect(ctx, legStep * sgn - 4, sgn * 8 - 3, 10, 6, 2); ctx.fill(); ctx.stroke();
    }
    const body = ctx.createLinearGradient(-half, -half, half, half);
    body.addColorStop(0, c1); body.addColorStop(1, c2);
    ctx.fillStyle = body; roundRect(ctx, -half, -half, s, s, 5); ctx.fill();
    ctx.strokeStyle = border; ctx.lineWidth = 2; roundRect(ctx, -half, -half, s, s, 5); ctx.stroke();
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(half - 2, -10, 12, 3); ctx.fillRect(half - 2, 7, 12, 3);
  } else if (type === 'fast') {
    const wingSwing = Math.sin(walkPhase) * 0.6;
    ctx.fillStyle = c1; ctx.strokeStyle = '#591100'; ctx.lineWidth = 1.5;
    for (const sgn of [-1, 1]) {
      ctx.save(); ctx.translate(-2, sgn * half * 0.5); ctx.rotate(sgn * (Math.PI / 4 + wingSwing));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-12, sgn * 24, 12, sgn * 28); ctx.lineTo(16, sgn * 10); ctx.closePath();
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.ellipse(2, 0, half * 1.1, half * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
  } else if (type === 'tank') {
    const armStep = Math.sin(walkPhase) * 5;
    ctx.fillStyle = c1; ctx.strokeStyle = '#2e0c08'; ctx.lineWidth = 2;
    for (const sgn of [-1, 1]) {
      roundRect(ctx, armStep * sgn - 6, sgn * (half + 3) - 7, half * 1.6, 14, 4);
      ctx.fill(); ctx.stroke();
    }
    const crag = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
    crag.addColorStop(0, c1); crag.addColorStop(1, c2);
    ctx.fillStyle = crag; roundRect(ctx, -half, -half, s, s, 6); ctx.fill();
    ctx.strokeStyle = border; ctx.lineWidth = 2.5; roundRect(ctx, -half, -half, s, s, 6); ctx.stroke();
    ctx.fillStyle = '#ffea00';
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, 0); ctx.lineTo(-4, 6); ctx.fill();
  } else if (type === 'shooter') {
    const a = time * 3 + id;
    ctx.fillStyle = '#e085ff'; ctx.shadowColor = '#e085ff'; ctx.shadowBlur = 8;
    for (const i of [0, 1, 2]) {
      const ra = a + i * (Math.PI * 2 / 3);
      ctx.fillText('⬡', Math.cos(ra) * (half + 8), Math.sin(ra) * (half + 8));
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(0, 0, half, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffd866'; ctx.fillRect(half - 2, -3, 16, 6);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(half + 14, 0, 5, 0, Math.PI * 2); ctx.fill();
  }

  // Eyes
  const eyeX = half * 0.45;
  ctx.fillStyle = (frozenTimer && frozenTimer > 0) ? '#ffffff' : isHit ? '#ffffff' : type === 'fast' ? '#ffffff' : '#ffeaab';
  ctx.shadowColor = '#ff5500'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(eyeX, -5, 3.2, 0, Math.PI * 2); ctx.arc(eyeX, 5, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#260000';
  ctx.beginPath(); ctx.arc(eyeX + 1.2, -5, 1.5, 0, Math.PI * 2); ctx.arc(eyeX + 1.2, 5, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore(); // rotate
  ctx.restore(); // translate

  // Tank HP gauge
  if (type === 'tank' && enemy.maxHealth > 1 && enemy.dyingTimer <= 0) {
    const bw = baseSize * 1.4, bh = 5;
    const bx = cx - bw / 2, by = cy - baseSize * 0.8 - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = '#3a0d0a'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#ff4433'; ctx.fillRect(bx, by, bw * (enemy.health / enemy.maxHealth), bh);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function renderDoor(ctx: CanvasRenderingContext2D, door: Door, time: number): void {
  const { open, animProgress, x, y, width, height } = door;

  ctx.save();
  for (const sgn of [-1, 1]) {
    const tx = x + (sgn < 0 ? -18 : width + 18), ty = y + height * 0.4;
    renderTorch(ctx, { x: tx, y: ty, phase: sgn < 0 ? 0.2 : 4.1 }, time);
  }

  ctx.fillStyle = '#323447'; roundRect(ctx, x - 12, y - 12, width + 24, height + 12, 8); ctx.fill();
  ctx.strokeStyle = open ? '#7dffc4' : '#ffd84d'; ctx.lineWidth = 3;
  ctx.shadowColor = open ? '#00ff95' : '#ffd84d'; ctx.shadowBlur = 15;
  roundRect(ctx, x - 12, y - 12, width + 24, height + 12, 8); ctx.stroke();
  ctx.shadowBlur = 0;

  if (!open) {
    const g = ctx.createLinearGradient(x, y, x, y + height);
    g.addColorStop(0, '#212230'); g.addColorStop(1, '#0e0e17');
    ctx.fillStyle = g; roundRect(ctx, x, y, width, height, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,216,77,0.9)'; ctx.font = '26px serif'; ctx.textAlign = 'center';
    ctx.fillText('🔒', x + width / 2, y + height / 2 + 10);
  } else {
    const halfW = width / 2, off = animProgress * halfW;
    ctx.save(); ctx.globalAlpha = 1 - animProgress;
    for (const sgn of [-1, 1]) {
      const gx = x + (sgn < 0 ? -off : halfW + off);
      const g = ctx.createLinearGradient(gx, y, gx, y + height);
      g.addColorStop(0, '#212230'); g.addColorStop(1, '#0e0e17');
      ctx.fillStyle = g; ctx.fillRect(gx, y, halfW, height);
    }
    ctx.restore();

    if (animProgress > 0.2) {
      const a = (animProgress - 0.2) * 1.25;
      ctx.save();
      const divineBeam = ctx.createLinearGradient(x, y, x, y + height + 140);
      divineBeam.addColorStop(0, `rgba(140,255,220,${a})`);
      divineBeam.addColorStop(0.6, `rgba(80,255,180,${a * 0.5})`); divineBeam.addColorStop(1, 'rgba(0,255,140,0)');
      ctx.fillStyle = divineBeam; ctx.beginPath();
      ctx.moveTo(x + 5, y); ctx.lineTo(x + width - 5, y);
      ctx.lineTo(x + width + 45, y + height + 140); ctx.lineTo(x - 45, y + height + 140);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c4ffeb'; ctx.shadowColor = '#47ffc2'; ctx.shadowBlur = 24;
      ctx.fillRect(x, y, width, height);
      ctx.restore();
    }
  }

  ctx.fillStyle = '#1c1d28'; roundRect(ctx, x + width / 2 - 30, y - 24, 60, 20, 4); ctx.fill();
  ctx.fillStyle = open ? '#7dffc4' : '#ffd84d'; ctx.font = 'bold 11px Orbitron, monospace'; ctx.textAlign = 'center';
  ctx.fillText('SORTIE', x + width / 2, y - 10);
  ctx.restore();
}

function renderKey(ctx: CanvasRenderingContext2D, key: GoldKey, time: number): void {
  if (key.collected) return;
  const a = key.spawnAnim, bob = Math.sin(time * 3) * 6, x = key.x, y = key.y + bob;

  const beam = ctx.createLinearGradient(x, y - 130, x, y + 20);
  beam.addColorStop(0, 'rgba(255,225,95,0)'); beam.addColorStop(1, `rgba(255,225,95,${0.15 * a})`);
  ctx.fillStyle = beam; ctx.fillRect(x - 20, y - 130, 40, 150);

  const halo = ctx.createRadialGradient(x, y, 0, x, y, 62);
  halo.addColorStop(0, `rgba(255,225,95,${0.32 * a})`); halo.addColorStop(1, 'rgba(255,225,95,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, 62, 0, Math.PI * 2); ctx.fill();

  ctx.save(); ctx.translate(x, y); ctx.rotate(time * 1.5);
  ctx.strokeStyle = `rgba(255,225,95,${0.35 * a})`; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();

  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
  ctx.shadowColor = '#ffd84d'; ctx.shadowBlur = 12;

  const hg = ctx.createRadialGradient(0, -6, 0, 0, -6, 12);
  hg.addColorStop(0, '#fff4b2'); hg.addColorStop(0.7, '#ffd84d'); hg.addColorStop(1, '#b8860b');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, -6, 12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#9a6b00'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#0c0c14'; ctx.beginPath(); ctx.arc(0, -6, 5, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#ffd84d'; ctx.fillRect(-2.5, 6, 5, 22); ctx.fillRect(2.5, 20, 8, 3.5); ctx.fillRect(2.5, 14, 6, 3.5);
  ctx.strokeStyle = '#9a6b00'; ctx.lineWidth = 0.6; ctx.strokeRect(-2.5, 6, 5, 22);

  for (const [sx, sy] of [[-20, -18], [18, -12], [-16, 24], [20, 20], [0, -30]]) {
    const ss = 0.8 + Math.abs(Math.sin(time * 4 + sx)) * 1.5;
    ctx.fillStyle = `rgba(255,255,255,${0.7 * a})`; ctx.beginPath(); ctx.arc(sx, sy, ss, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    const a = p.life / p.maxLife;
    ctx.globalAlpha = a; ctx.fillStyle = p.color;

    if (p.shape === 'shard') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation || 0);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
    } else if (p.shape === 'spark') {
      ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.7; ctx.lineCap = 'round';
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 8; }
      const len = Math.hypot(p.vx, p.vy) * 0.035, ang = Math.atan2(p.vy, p.vx);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(ang) * len, p.y - Math.sin(ang) * len);
      ctx.stroke(); ctx.shadowBlur = 0;
    } else if (p.shape === 'slash') {
      ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 1.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 4, (p.rotation || 0) - 0.5, (p.rotation || 0) + 0.5); ctx.stroke();
    } else if (p.shape === 'star') {
      ctx.font = `${Math.round(p.size * 4)}px Orbitron, monospace`; ctx.fillText('✨', p.x, p.y);
    } else if (p.shape === 'rune') {
      ctx.font = `${Math.round(p.size * 3.5)}px Orbitron, monospace`; ctx.fillText('⚡', p.x, p.y);
    } else {
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
  }
  ctx.globalAlpha = 1;
}

function renderFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[]): void {
  ctx.textAlign = 'center';
  for (const ft of texts) {
    const a = Math.min(1, ft.life / ft.maxLife);
    ctx.globalAlpha = a; ctx.font = `bold ${ft.size}px Orbitron, monospace`;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(ft.text, ft.x + 1.5, ft.y + 1.5);
    ctx.fillStyle = ft.color; ctx.shadowColor = ft.color; ctx.shadowBlur = 10;
    ctx.fillText(ft.text, ft.x, ft.y); ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

function renderEmbers(ctx: CanvasRenderingContext2D, time: number): void {
  for (let i = 0; i < 30; i++) {
    const seed = i * 61.3;
    const x = (seed * 8.1 + time * (12 + (i % 5) * 4)) % (dims.w + 60) - 30;
    const y = dims.h - ((seed * 3.7 + time * (26 + (i % 7) * 7)) % (dims.h + 60));
    const a = 0.15 + Math.sin(time * 2 + i) * 0.1;
    ctx.fillStyle = `rgba(255,190,85,${a})`;
    ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * 0.5, 0, Math.PI * 2); ctx.fill();
  }
}

// --- Overlays ---
function renderTransition(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.roomTransition <= 0) return;
  ctx.fillStyle = `rgba(6,7,14,${state.roomTransition})`; ctx.fillRect(0, 0, dims.w, dims.h);

  if (state.roomTransition > 0.3) {
    const a = Math.min(1, (state.roomTransition - 0.3) * 3);
    ctx.globalAlpha = a; ctx.textAlign = 'center';

    ctx.fillStyle = '#7dffc4'; ctx.font = 'bold 44px Orbitron, monospace';
    ctx.shadowColor = '#00e088'; ctx.shadowBlur = 20;
    ctx.fillText(`SALLE ${state.roomLevel} — ${state.roomName.toUpperCase()}`, dims.w / 2, dims.h / 2 - 10);
    ctx.shadowBlur = 0;

    const diff = state.roomLevel === 1 ? 'Très Facile (Initiation)' : state.roomLevel <= 3 ? 'Facile' : state.roomLevel <= 6 ? 'Moyen' : state.roomLevel <= 10 ? 'Difficile' : 'Infernal';
    const dc = state.roomLevel === 1 ? '#00ffaa' : state.roomLevel <= 3 ? '#7dffc4' : state.roomLevel <= 6 ? '#ffce5a' : state.roomLevel <= 10 ? '#ff7a55' : '#ff0044';
    ctx.fillStyle = dc; ctx.font = '16px Orbitron, monospace';
    ctx.fillText(`Difficulté : ${diff}`, dims.w / 2, dims.h / 2 + 30);
    ctx.globalAlpha = 1;
  }
}

function renderFlash(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.damageFlash > 0) {
    ctx.fillStyle = `rgba(255,0,40,${state.damageFlash * 0.25})`; ctx.fillRect(0, 0, dims.w, dims.h);
  }
  if (state.healFlash > 0) {
    ctx.fillStyle = `rgba(0,255,150,${state.healFlash * 0.18})`; ctx.fillRect(0, 0, dims.w, dims.h);
  }
  if (state.novaFlash > 0) {
    ctx.fillStyle = `rgba(0,240,255,${state.novaFlash * 0.25})`; ctx.fillRect(0, 0, dims.w, dims.h);
  }
}

// --- Total Render Matrix ---
export function render(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  ensureBackground(ctx);
  if (state.status === 'menu' || state.status === 'onboarding') return;
  ctx.save();
  if (state.screenShake.intensity > 0.5) ctx.translate(state.screenShake.x, state.screenShake.y);

  ctx.drawImage(bgCanvas!, 0, 0);
  renderEmbers(ctx, time);

  for (const t of getTorches()) renderTorch(ctx, t, time);
  for (const wall of state.walls) renderWall(ctx, wall, time);
  for (const chest of state.chests) renderChest(ctx, chest);
  for (const it of state.items) renderConsumable(it, ctx);

  if (state.door) renderDoor(ctx, state.door, time);
  if (state.goldKey && !state.goldKey.collected) renderKey(ctx, state.goldKey, time);

  renderProjectiles(ctx, state.projectiles, time);
  for (const enemy of state.enemies) renderEnemy(ctx, enemy, time);
  renderPlayer(ctx, state.player, time);

  renderParticles(ctx, state.particles);
  applyLighting(ctx, buildLights(state, time));
  renderFloatingTexts(ctx, state.floatingTexts);

  ctx.restore();

  renderFlash(ctx, state);
  renderTransition(ctx, state);
  if (state.status === 'paused') renderPaused(ctx);
}

function renderPaused(ctx: CanvasRenderingContext2D): void {
  const { w, h } = dims;
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,16,0.88)';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#00ffcc';
  ctx.font = 'bold 52px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 20;
  ctx.fillText('JEU EN PAUSE', w / 2, h / 2 - 90);
  ctx.shadowBlur = 0;

  const rules = [
    'RAPPEL DES RÈGLES ET CONTRÔLES TACTIQUES',
    '•  ZQSD / Flèches : Déplacer votre personnage armuré',
    '•  ESPACE / Attaque : Utiliser votre arme primaire (Balayage, Tir, Dagues)',
    '•  SHIFT / F : Réciter le parchemin de sort actif (Boule de Feu 🔥 / Nova ❄️)',
    '•  COFFRES : Brisez les coffres en bois pour découvrir des potions de buffs ou de vie',
    '•  SORTIE : Nettoyez les maudits pour faire apparaître la clé d\'Or et ouvrir la sortie !',
  ];
  ctx.fillStyle = '#e0ffd0';
  ctx.font = '15px Orbitron, monospace';
  rules.forEach((r, i) => {
    ctx.fillStyle = i === 0 ? '#ffd700' : '#a3bdce';
    ctx.font = i === 0 ? 'bold 16px Orbitron, monospace' : '15px Orbitron, monospace';
    ctx.fillText(r, w / 2, h / 2 - 20 + i * 30);
  });

  ctx.fillStyle = '#ffffff';
  ctx.font = '15px Orbitron, monospace';
  ctx.fillText('▶  APPUYEZ SUR ÉCHAP POUR REPRENDRE L\'AVENTURE  ◀', w / 2, h / 2 + 180);
  ctx.restore();
}
