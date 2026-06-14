// ============================================================
// DONJONFLASH — Game Engine (Classes, Loot, Spells, Projectiles)
// Créateur : Hylst - Geoffroy avec l'aide d'une IA
// ============================================================

import type {
  Vec2,
  Player,
  Enemy,
  Wall,
  Door,
  GameState,
  Keys,
  Particle,
  FloatingText,
  BreakableChest,
  ConsumableItem,
  HeroClass,
  Difficulty,
} from './types';
import { dims } from './dimensions';
import { sfx, startMusic } from './audio';

const ATTACK_DURATION = 0.28;
const ATTACK_ARC = Math.PI * 0.75;
const COMBO_WINDOW = 2.4;

let nextEnemyId = 0;
let nextChestId = 0;
let nextItemId = 0;
let nextProjId = 0;

export function createGameState(): GameState {
  return {
    status: 'menu',
    selectedClass: 'warrior',
    selectedDifficulty: 'easy',
    roomLevel: 0,
    roomType: 'arena',
    roomModifier: 'none',
    roomName: 'Hall d\'Initiation',
    score: 0,
    combo: 0,
    comboTimer: 0,
    roomTransition: 0,
    screenShake: { x: 0, y: 0, intensity: 0, duration: 0 },
    damageFlash: 0,
    healFlash: 0,
    novaFlash: 0,
    flashColor: '#ff0000',
    enemies: [],
    chests: [],
    items: [],
    projectiles: [],
    particles: [],
    floatingTexts: [],
    player: createPlayer('warrior'),
    walls: [],
    door: null,
    goldKey: null,
    hitStop: 0,
    time: 0,
    trapTimer: 0,
  };
}

export function createPlayer(heroClass: HeroClass, difficulty: Difficulty = 'easy'): Player {
  let hp = 7;
  let spd = 250;
  let cd = 0.32;
  let scrollName: 'scroll_fireball' | 'scroll_nova' = 'scroll_fireball';
  let sTitle = 'Boule de Feu';
  let sIcon = '🔥';

  if (heroClass === 'ranger') {
    hp = 5;
    spd = 280;
    cd = 0.38;
    scrollName = 'scroll_nova';
    sTitle = 'Nova de Gel';
    sIcon = '❄️';
  } else if (heroClass === 'rogue') {
    hp = 4;
    spd = 320;
    cd = 0.22;
    scrollName = 'scroll_fireball';
    sTitle = 'Boule de Feu';
    sIcon = '🔥';
  }

  if (difficulty === 'normal') { hp = Math.max(1, Math.round(hp * 0.8)); cd *= 1.25; }
  else if (difficulty === 'hard') { hp = Math.max(1, Math.round(hp * 0.6)); cd *= 1.5; }

  const p: Player = {
    heroClass,
    heroLevel: 1,
    xp: 0,
    xpNext: 100, // 100 XP to reach level 2
    x: dims.w / 2,
    y: dims.h / 2,
    radius: Math.max(14, Math.min(20, Math.round(Math.min(dims.w, dims.h) * 0.024))),
    speed: spd,
    baseSpeed: spd,
    health: hp,
    maxHealth: hp,
    facing: -Math.PI / 2,
    isAttacking: false,
    attackAngle: 0,
    attackProgress: 0,
    attackCooldown: 0,
    baseCooldown: cd,
    attackCombo: 0,
    invincibleTimer: 0,
    trail: [],
    walkPhase: 0,
    moving: false,
    capeWave: 0,
    activeBuffs: [],
    activeScroll: {
      type: scrollName,
      name: sTitle,
      icon: sIcon,
      count: heroClass === 'warrior' ? 2 : 1,
    },
    secondaryCooldown: 0,
    bonusDamage: 0,
    armor: 0,
    critChance: 0,
    rogueCritMul: 1,
    rangerMultiShot: false,
    rangerPierceBonus: false,
  };
  return p;
}

// ============================================================================
// ARCHITECTURE & BREAKABLE CHESTS GENERATION
// ============================================================================

interface Layout {
  type: GameState['roomType'];
  modifier: GameState['roomModifier'];
  name: string;
  walls: Wall[];
  chests: BreakableChest[];
}

function generateArchitecture(level: number): Layout {
  const { w, h, pad } = dims;
  const walls: Wall[] = [];
  const chests: BreakableChest[] = [];

  walls.push({ x: 0, y: 0, width: w, height: pad, type: 'wall' });
  walls.push({ x: 0, y: h - pad, width: w, height: pad, type: 'wall' });
  walls.push({ x: 0, y: 0, width: pad, height: h, type: 'wall' });
  walls.push({ x: w - pad, y: 0, width: pad, height: h, type: 'wall' });

  const types: GameState['roomType'][] = ['arena', 'pillars', 'royal', 'cross', 'corridors', 'labyrinth'];
  const modifiers: GameState['roomModifier'][] = ['none', 'trapped', 'treasure', 'reinforced'];
  let type: GameState['roomType'];
  let modifier: GameState['roomModifier'] = 'none';
  let name = '';

  if (level === 1) { type = 'arena'; name = 'Hall d\'Initiation'; }
  else if (level === 2) { type = 'royal'; name = 'Antichambre de Pierre'; }
  else if (level === 3) { type = 'cross'; name = 'La Croisée Tactique'; }
  else if (level === 4) { type = 'pillars'; name = 'La Colonnade Oubliée'; }
  else if (level === 5) { type = 'corridors'; name = 'Les Couloirs d\'Embuscade'; }
  else if (level === 6) { type = 'labyrinth'; name = 'Le Dédale Sombre'; }
  else {
    type = types[Math.floor(Math.random() * types.length)];
    if (level > 6) {
      const modRoll = Math.random();
      if (level % 5 === 0) { modifier = 'none'; }
      else if (modRoll < 0.25) modifier = 'trapped';
      else if (modRoll < 0.50) modifier = 'treasure';
      else if (modRoll < 0.70) modifier = 'reinforced';
    }
    const prefixes: Record<GameState['roomModifier'], string[]> = {
      none: ['', ''],
      trapped: ['Piégée', 'Embrasée'],
      treasure: ['Au Trésor', 'des Richesses'],
      reinforced: ['Renforcée', 'des Champions'],
    };
    const baseNames: Record<GameState['roomType'], string[]> = {
      arena: ['Grande Arène', 'Fosse de Combat'],
      pillars: ['Salle des Piliers', 'Sanctuaire Soutenu'],
      royal: ['Bassin Royal', 'Hall des Rois'],
      cross: ['Carrefour Maudit', 'Les Quatre Voies'],
      corridors: ['Passages Étroits', 'Couloirs de la Mort'],
      labyrinth: ['Labyrinthe Infernal', 'Dédale Sombre'],
    };
    const modPrefix = prefixes[modifier];
    const base = baseNames[type][Math.floor(Math.random() * baseNames[type].length)];
    name = modifier !== 'none' ? `${modPrefix[0]} — ${base}` : base;
  }

  const roomW = w - pad * 2;
  const roomH = h - pad * 2;
  const cx = w / 2;
  const cy = h / 2;

  if (type === 'pillars') {
    const cols = 4; const rows = 2;
    const stepX = roomW / (cols + 1);
    const stepY = roomH / (rows + 1);
    const ps = Math.round(dims.pillarSize * 1.1);
    for (let c = 1; c <= cols; c++) {
      for (let r = 1; r <= rows; r++) {
        const px = pad + c * stepX;
        const py = pad + r * stepY;
        if (Math.hypot(px - cx, py - cy) > 130) {
          walls.push({ x: px - ps / 2, y: py - ps / 2, width: ps, height: ps, type: 'pillar' });
        }
      }
    }
  } else if (type === 'royal') {
    const bw = Math.round(roomW * 0.28);
    const bh = Math.round(roomH * 0.25);
    walls.push({ x: cx - bw / 2, y: cy - bh / 2, width: bw, height: bh, type: 'water' });

    const ps = dims.pillarSize;
    const gapX = bw / 2 + ps * 1.5;
    const gapY = bh / 2 + ps * 1.5;
    for (const [signX, signY] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      walls.push({ x: cx + signX * gapX - ps / 2, y: cy + signY * gapY - ps / 2, width: ps, height: ps, type: 'pillar' });
    }
  } else if (type === 'cross') {
    const thickX = Math.round(roomW * 0.26);
    const thickY = Math.round(roomH * 0.26);
    const cornerW = Math.round((roomW - thickX) / 2);
    const cornerH = Math.round((roomH - thickY) / 2);
    walls.push({ x: pad, y: pad, width: cornerW, height: cornerH, type: 'block' });
    walls.push({ x: w - pad - cornerW, y: pad, width: cornerW, height: cornerH, type: 'block' });
    walls.push({ x: pad, y: h - pad - cornerH, width: cornerW, height: cornerH, type: 'block' });
    walls.push({ x: w - pad - cornerW, y: h - pad - cornerH, width: cornerW, height: cornerH, type: 'block' });
  } else if (type === 'corridors') {
    const rowCount = 2;
    const stepY = roomH / (rowCount + 1);
    const wallThick = 40;
    for (let r = 1; r <= rowCount; r++) {
      const py = Math.round(pad + r * stepY - wallThick / 2);
      if (r === 1) {
        walls.push({ x: pad, y: py, width: Math.round(roomW * 0.38), height: wallThick, type: 'block' });
        walls.push({ x: w - pad - Math.round(roomW * 0.38), y: py, width: Math.round(roomW * 0.38), height: wallThick, type: 'block' });
      } else {
        walls.push({ x: cx - Math.round(roomW * 0.28), y: py, width: Math.round(roomW * 0.56), height: wallThick, type: 'block' });
      }
    }
  } else if (type === 'labyrinth') {
    const wt = 40;
    walls.push({ x: pad + 120, y: pad + 100, width: wt, height: roomH - 200, type: 'block' });
    walls.push({ x: pad + 120, y: cy - wt / 2, width: 180, height: wt, type: 'block' });
    walls.push({ x: w - pad - 240, y: pad + 100, width: 140, height: wt, type: 'block' });
    walls.push({ x: w - pad - 170, y: pad + 100, width: wt, height: roomH - 220, type: 'block' });
  }

  // Spawn 2 to 4 Breakable Wooden Chests / Barrels in safe nooks
  const chestSpots: Vec2[] = [
    { x: pad + 60, y: pad + 60 },
    { x: w - pad - 60, y: pad + 60 },
    { x: pad + 60, y: h - pad - 60 },
    { x: w - pad - 60, y: h - pad - 60 },
    { x: cx - 180, y: cy },
    { x: cx + 180, y: cy },
  ];
  const activeSpots = chestSpots.sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 3));
  if (modifier === 'treasure') {
    const extraSpots = chestSpots.sort(() => Math.random() - 0.5).slice(0, 3);
    for (const ep of extraSpots) {
      if (!activeSpots.includes(ep)) activeSpots.push(ep);
    }
  }
  const doorArea = { x: cx - 60, y: h - pad - 120, w: 120, h: 120 };

  for (const pos of activeSpots) {
    if (isPlacementValid(pos.x, pos.y, 22, walls, doorArea)) {
      chests.push({
        id: nextChestId++,
        x: pos.x,
        y: pos.y,
        size: 34,
        health: 2,
        maxHealth: 2,
        hitTimer: 0,
        opened: false,
      });
    }
  }

  return { type, modifier, name, walls, chests };
}

function createDoor(): Door {
  return {
    x: dims.w / 2 - 46,
    y: dims.h - dims.pad - 82,
    width: 92,
    height: 82,
    open: false,
    animProgress: 0,
  };
}

// ============================================================================
// SAFE SPAWN & PLACEMENT ("ANTI-COINCEMENT")
// ============================================================================

function isPlacementValid(x: number, y: number, radius: number, walls: Wall[], doorArea: { x: number; y: number; w: number; h: number }): boolean {
  const { w, h, pad } = dims;
  if (x - radius < pad + 10 || x + radius > w - pad - 10 ||
      y - radius < pad + 10 || y + radius > h - pad - 10) {
    return false;
  }
  const margin = 14;
  for (const wall of walls) {
    if (x + radius + margin > wall.x && x - radius - margin < wall.x + wall.width &&
        y + radius + margin > wall.y && y - radius - margin < wall.y + wall.height) {
      return false;
    }
  }
  if (x + radius + margin > doorArea.x && x - radius - margin < doorArea.x + doorArea.w &&
      y + radius + margin > doorArea.y && y - radius - margin < doorArea.y + doorArea.h) {
    return false;
  }
  return true;
}

function findSafeSpawn(radius: number, walls: Wall[], targetX?: number, targetY?: number): Vec2 {
  const doorArea = { x: dims.w / 2 - 60, y: dims.h - dims.pad - 120, w: 120, h: 120 };
  if (targetX !== undefined && targetY !== undefined) {
    if (isPlacementValid(targetX, targetY, radius, walls, doorArea)) return { x: targetX, y: targetY };
  }
  for (let p = 0; p < 200; p++) {
    const rx = dims.pad + 30 + Math.random() * (dims.w - dims.pad * 2 - 60);
    const ry = dims.pad + 30 + Math.random() * (dims.h - dims.pad * 2 - 60);
    if (isPlacementValid(rx, ry, radius, walls, doorArea)) return { x: rx, y: ry };
  }
  return { x: dims.w / 2, y: dims.h / 2 };
}

function generateEnemies(level: number, walls: Wall[], difficulty: Difficulty): Enemy[] {
  const hpMul = difficulty === 'hard' ? 2.0 : difficulty === 'normal' ? 1.5 : 1.0;
  const isBoss = level > 1 && level % 5 === 0;
  const baseCount = level === 1 ? 4 : Math.min(4 + Math.floor(level * 1.2), 16);
  const count = isBoss ? baseCount + 2 : baseCount;
  const enemies: Enemy[] = [];
  const eBaseSize = Math.max(22, Math.min(32, Math.round(Math.min(dims.w, dims.h) * 0.035)));

  for (let i = 0; i < count; i++) {
    let type: Enemy['type'] = 'normal';
    let hp = 1;
    let size = eBaseSize;
    let baseSpd = 55 + level * 5 + Math.random() * 20;

    if (level > 1) {
      const roll = Math.random();
      if (level >= 6 && roll < 0.12 + level * 0.015) {
        type = 'berserker';
        hp = 2;
        size = Math.round(eBaseSize * 0.9);
        baseSpd = 120 + level * 8 + Math.random() * 20;
      } else if (level >= 4 && roll < 0.16 + level * 0.02) {
        type = 'tank';
        hp = 2 + Math.floor(level / 3);
        size = Math.round(eBaseSize * 1.6);
        baseSpd = 42 + level * 3;
      } else if (level >= 5 && roll < 0.35) {
        type = 'shooter';
        hp = 2;
        size = Math.round(eBaseSize * 0.95);
        baseSpd = 52 + level * 4;
      } else if (level >= 2 && roll < 0.55) {
        type = 'fast';
        hp = 1;
        size = Math.round(eBaseSize * 0.75);
        baseSpd = 100 + level * 10 + Math.random() * 30;
      }
    }

    hp = Math.max(1, Math.round(hp * hpMul));
    const safeSpot = findSafeSpawn(size / 2 + 6, walls);
    enemies.push({
      id: nextEnemyId++,
      x: safeSpot.x, y: safeSpot.y,
      size,
      speed: baseSpd, baseSpeed: baseSpd,
      health: hp, maxHealth: hp,
      type,
      hitTimer: 0,
      angle: Math.random() * Math.PI * 2,
      spawnTimer: 0.7 + i * 0.08,
      dyingTimer: 0,
      walkPhase: Math.random() * Math.PI * 2,
      attackCooldown: 1 + Math.random(),
    });
  }

  if (isBoss) {
    const bossSize = Math.round(eBaseSize * 2.2);
    const bossHp = Math.max(1, Math.round((5 + Math.floor(level / 2)) * hpMul));
    const bossSpot = findSafeSpawn(bossSize / 2 + 6, walls, dims.w / 2, dims.h * 0.3);
    enemies.push({
      id: nextEnemyId++,
      x: bossSpot.x, y: bossSpot.y,
      size: bossSize,
      speed: 35 + level * 2, baseSpeed: 35 + level * 2,
      health: bossHp, maxHealth: bossHp,
      type: 'tank',
      hitTimer: 0,
      angle: Math.random() * Math.PI * 2,
      spawnTimer: 0.3,
      dyingTimer: 0,
      walkPhase: 0,
      attackCooldown: 2,
    });
  }

  return enemies;
}

export function initRoom(state: GameState, keepHealth = true): void {
  const layout = generateArchitecture(state.roomLevel);
  state.roomType = layout.type;
  state.roomModifier = layout.modifier;
  state.roomName = layout.name;
  state.walls = layout.walls;
  state.chests = layout.chests;
  state.items = [];
  state.projectiles = [];

  const safeSpot = findSafeSpawn(state.player.radius, state.walls, dims.w / 2, dims.h - dims.pad - 160);
  state.player.x = safeSpot.x;
  state.player.y = safeSpot.y;
  state.player.isAttacking = false;
  state.player.attackProgress = 0;
  state.player.trail = [];
  state.player.facing = -Math.PI / 2;

  if (!keepHealth) {
    state.player = createPlayer(state.selectedClass, state.selectedDifficulty);
  } else {
    state.player.attackCooldown = 0;
    state.player.secondaryCooldown = 0;
  }

  state.enemies = generateEnemies(state.roomLevel, state.walls, state.selectedDifficulty);
  if (state.roomModifier === 'reinforced') {
    for (const e of state.enemies) {
      e.health += 1;
      e.maxHealth += 1;
      e.speed *= 1.1;
      e.baseSpeed *= 1.1;
    }
  }
  state.door = null;
  state.goldKey = null;
  state.roomTransition = 1;
}

export function startRoom(state: GameState, level: number): void {
  state.roomLevel = level;
  state.status = 'playing';
  initRoom(state, false);
}

export function rescale(oldW: number, oldH: number, state: GameState): void {
  const newW = dims.w, newH = dims.h;
  if (oldW === newW && oldH === newH) return;
  const sx = newW / oldW, sy = newH / oldH;
  const p = state.player;
  p.x *= sx; p.y *= sy;
  for (const e of state.enemies) { e.x *= sx; e.y *= sy; }
  for (const c of state.chests) { c.x *= sx; c.y *= sy; }
  for (const it of state.items) { it.x *= sx; it.y *= sy; }
  for (const pr of state.projectiles) { pr.x *= sx; pr.y *= sy; }
  for (const pt of state.particles) { pt.x *= sx; pt.y *= sy; }
  if (state.goldKey) { state.goldKey.x *= sx; state.goldKey.y *= sy; }
  if (state.door) {
    state.door.x = newW / 2 - state.door.width / 2;
    state.door.y = newH - dims.pad - state.door.height;
  }
  const layout = generateArchitecture(state.roomLevel);
  state.walls = layout.walls;
}

// ============================================================================
// COLLISION HELPERS
// ============================================================================

function resolveWallCollision(entity: { x: number; y: number; radius: number }, walls: Wall[]): void {
  for (const wall of walls) {
    if (entity.x + entity.radius > wall.x && entity.x - entity.radius < wall.x + wall.width &&
        entity.y + entity.radius > wall.y && entity.y - entity.radius < wall.y + wall.height) {
      const closestX = Math.max(wall.x, Math.min(entity.x, wall.x + wall.width));
      const closestY = Math.max(wall.y, Math.min(entity.y, wall.y + wall.height));
      const dx = entity.x - closestX;
      const dy = entity.y - closestY;
      const dist = Math.hypot(dx, dy);

      if (dist > 0 && dist < entity.radius) {
        const overlap = entity.radius - dist;
        entity.x += (dx / dist) * overlap;
        entity.y += (dy / dist) * overlap;
      } else if (dist === 0) {
        const overlaps = [entity.x - wall.x, wall.x + wall.width - entity.x, entity.y - wall.y, wall.y + wall.height - entity.y];
        const m = Math.min(...overlaps);
        if (m === overlaps[0]) entity.x -= overlaps[0] + 0.5;
        else if (m === overlaps[1]) entity.x += overlaps[1] + 0.5;
        else if (m === overlaps[2]) entity.y -= overlaps[2] + 0.5;
        else entity.y += overlaps[3] + 0.5;
      }
    }
  }
}

function pointInArc(px: number, py: number, ox: number, oy: number, center: number, arcWidth: number, range: number): boolean {
  const dx = px - ox, dy = py - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range || dist < 4) return false;
  let diff = Math.atan2(dy, dx) - center;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) < arcWidth / 2;
}

function circleCircle(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean {
  const dx = x2 - x1, dy = y2 - y1;
  return dx * dx + dy * dy < (r1 + r2) * (r1 + r2);
}

function spawnLoot(state: GameState, x: number, y: number): void {
  // Spawn a fabulous loot item (Potions, Food, or Spell Scrolls)
  const types: ConsumableItem['type'][] = ['health_potion', 'speed_potion', 'shield_potion', 'scroll_fireball', 'scroll_nova', 'food'];
  const names: Record<ConsumableItem['type'], string> = {
    health_potion: 'Potion de Soin',
    speed_potion: 'Potion de Vitesse',
    shield_potion: 'Fiole d\'Invulnérabilité',
    scroll_fireball: 'Parchemin Feu',
    scroll_nova: 'Parchemin Gel',
    food: 'Gigot Rôti',
  };
  // Higher probability of food / health if player is wounded
  let chosen: ConsumableItem['type'];
  const roll = Math.random();
  if (state.player.health < state.player.maxHealth && roll < 0.45) {
    chosen = roll < 0.25 ? 'health_potion' : 'food';
  } else {
    chosen = types[Math.floor(Math.random() * types.length)];
  }

  // Scatter slightly
  const lx = x + (Math.random() - 0.5) * 26;
  const ly = y + (Math.random() - 0.5) * 26;

  state.items.push({
    id: nextItemId++,
    x: lx, y: ly,
    type: chosen,
    name: names[chosen],
    bob: Math.random() * Math.PI * 2,
  });
}

// ============================================================================
// FX SPAWNERS
// ============================================================================

const MAX_PARTICLES = 500;

function burst(particles: Particle[], x: number, y: number, count: number, color: string, speed = 160, size = 4.5, glow = true, shape: Particle['shape'] = 'circle'): void {
  const remaining = Math.min(count, Math.max(0, MAX_PARTICLES - particles.length));
  for (let i = 0; i < remaining; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = speed * (0.3 + Math.random() * 0.9);
    const lf = 0.4 + Math.random() * 0.6;
    particles.push({
      x, y,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: lf, maxLife: lf, color,
      size: size * (0.5 + Math.random() * 0.7),
      gravity: 0, glow,
      shape: shape === 'circle' ? (Math.random() < 0.4 ? 'spark' : 'circle') : shape,
      rotation: a, vr: (Math.random() - 0.5) * 12,
    });
  }
}

function shatter(particles: Particle[], x: number, y: number, color: string, baseSize: number): void {
  const remaining = Math.min(16, Math.max(0, MAX_PARTICLES - particles.length));
  for (let i = 0; i < remaining; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 140 + Math.random() * 240;
    const lf = 0.5 + Math.random() * 0.5;
    particles.push({
      x, y,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: lf, maxLife: lf, color,
      size: baseSize * (0.28 + Math.random() * 0.35),
      gravity: 240, glow: false, shape: 'shard',
      rotation: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 16,
    });
  }
}

function floatText(texts: FloatingText[], x: number, y: number, text: string, color: string, size = 16): void {
  if (texts.length > 20) { texts.splice(0, texts.length - 15); }
  texts.push({ x, y, text, life: 1.1, maxLife: 1.1, color, size, vy: -44 });
}

function shake(state: GameState, intensity: number, duration: number): void {
  if (state.screenShake.intensity < intensity) {
    state.screenShake.intensity = intensity;
    state.screenShake.duration = duration;
  }
}

function addXp(state: GameState, amount: number, x: number, y: number): void {
  const p = state.player;
  p.xp += amount;
  floatText(state.floatingTexts, x, y - 20, `+${amount} XP`, '#a0eeff', 15);

  if (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.heroLevel++;
    p.xpNext = Math.round(p.xpNext * 1.5);
    p.health = p.maxHealth;
    p.baseSpeed += 12;
    p.bonusDamage += 1;
    state.healFlash = 1.0;
    state.flashColor = '#ffd700';
    sfx.victoryStep();
    shake(state, 20, 0.4);
    burst(state.particles, p.x, p.y, 50, '#ffd700', 300, 6, true, 'star');
    let lvlText = `🌟 NIVEAU ${p.heroLevel} 🌟 !`;

    if (p.heroClass === 'warrior') {
      p.maxHealth += 2;
      p.health = p.maxHealth;
      p.armor += 1;
      if (p.heroLevel === 3) { lvlText = '🛡️ NIVEAU 3 — ARMURE +1 !'; }
      else if (p.heroLevel === 6) { p.critChance += 0.2; lvlText = '⚔️ NIVEAU 6 — COUP CRITIQUE !'; }
      else if (p.heroLevel === 10) { p.armor += 2; lvlText = '🛡️ NIVEAU 10 — PIÈGE D\'ACIER !'; }
      else { lvlText = `🌟 NIVEAU ${p.heroLevel} — +2 PV, +1 Armure !`; }
    } else if (p.heroClass === 'ranger') {
      p.maxHealth += 1;
      p.health = p.maxHealth;
      if (p.heroLevel === 3) { p.rangerMultiShot = true; lvlText = '🏹 NIVEAU 3 — DOUBLE TIR !'; }
      else if (p.heroLevel === 6) { p.rangerPierceBonus = true; lvlText = '🏹 NIVEAU 6 — FLÈCHE PERÇANTE !'; }
      else if (p.heroLevel === 10) { p.baseCooldown *= 0.85; lvlText = '🏹 NIVEAU 10 — TIR RAPIDE !'; }
      else { lvlText = `🌟 NIVEAU ${p.heroLevel} — +1 PV, +1 Dégâts !`; }
    } else if (p.heroClass === 'rogue') {
      p.maxHealth += 1;
      p.health = p.maxHealth;
      p.baseSpeed += 8;
      if (p.heroLevel === 3) { p.critChance += 0.15; lvlText = '🗡️ NIVEAU 3 — POISON !'; }
      else if (p.heroLevel === 6) { p.rogueCritMul = 2.5; lvlText = '🗡️ NIVEAU 6 — ASSASSINAT !'; }
      else if (p.heroLevel === 10) { p.baseCooldown *= 0.8; lvlText = '🗡️ NIVEAU 10 — LAMES JUMELLES !'; }
      else { lvlText = `🌟 NIVEAU ${p.heroLevel} — +1 PV, +Vitesse !`; }
    }

    floatText(state.floatingTexts, p.x, p.y - 40, lvlText, '#ffd700', 22);
  }
}

// ============================================================================
// MAIN UPDATE LOOP
// ============================================================================

export function update(state: GameState, dt: number, keys: Keys): void {
  state.time += dt;

  if (state.status === 'menu' || state.status === 'onboarding' || state.status === 'gameOver') {
    if (keys.enter) {
      state.roomLevel = 1;
      state.score = 0;
      state.combo = 0;
      nextEnemyId = 0; nextChestId = 0; nextItemId = 0; nextProjId = 0;
      state.player = createPlayer(state.selectedClass, state.selectedDifficulty);
      startMusic();
      startRoom(state, 1);
    }
    return;
  }

  // Handle Paused execution mode
  if (state.status === 'paused') {
    return;
  }

  if (state.hitStop > 0) { state.hitStop -= dt; dt *= 0.18; }
  if (state.roomTransition > 0) {
    state.roomTransition -= dt * 2.2;
    if (state.roomTransition < 0) state.roomTransition = 0;
    updateParticles(state, dt);
    return;
  }

  // Shake decay
  if (state.screenShake.duration > 0) {
    state.screenShake.duration -= dt;
    state.screenShake.intensity *= 0.88;
    state.screenShake.x = (Math.random() - 0.5) * state.screenShake.intensity * 2;
    state.screenShake.y = (Math.random() - 0.5) * state.screenShake.intensity * 2;
    if (state.screenShake.duration <= 0) { state.screenShake.x = 0; state.screenShake.y = 0; state.screenShake.intensity = 0; }
  }

  if (state.damageFlash > 0) state.damageFlash -= dt * 3.5;
  if (state.healFlash > 0) state.healFlash -= dt * 3;
  if (state.novaFlash > 0) state.novaFlash -= dt * 2.5;
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  const player = state.player;

  // ---- Manage Active Buffs (Potions Buffs) ----
  let hasteMult = 1;
  for (let b = player.activeBuffs.length - 1; b >= 0; b--) {
    const buff = player.activeBuffs[b];
    buff.duration -= dt;
    if (buff.type === 'speed') hasteMult = 1.35; // +35% speed & attack speed rate
    if (buff.type === 'shield') player.invincibleTimer = Math.max(player.invincibleTimer, 0.1);
    if (buff.duration <= 0) player.activeBuffs.splice(b, 1);
  }
  player.speed = player.baseSpeed * hasteMult;

  if (!state.trapTimer) state.trapTimer = 0;
  if (state.roomModifier === 'trapped') {
    state.trapTimer += dt;
    if (state.trapTimer >= 3 && player.invincibleTimer <= 0) {
      state.trapTimer = 0;
      const mitigated = Math.max(0, 1 - player.armor);
      if (mitigated > 0) {
        player.health -= mitigated;
        player.invincibleTimer = 0.8;
        state.damageFlash = 0.6;
        state.flashColor = '#ff6600';
        sfx.playerHurt();
        floatText(state.floatingTexts, player.x, player.y - 26, '🔥 PIÈGE! -1 PV', '#ff6600', 16);
        burst(state.particles, player.x, player.y, 10, '#ff6600', 120, 3, true, 'shard');
        if (player.health <= 0) {
          state.status = 'gameOver';
          sfx.gameOver();
          burst(state.particles, player.x, player.y, 60, '#33ff99', 350, 6, true);
          floatText(state.floatingTexts, player.x, player.y - 32, 'TERRASSÉ...', '#ff4466', 22);
          return;
        }
      }
    }
  } else {
    state.trapTimer = 0;
  }

  // ---- Player Movement ----
  let dx = 0, dy = 0;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  if (keys.up) dy -= 1;
  if (keys.down) dy += 1;

  player.moving = dx !== 0 || dy !== 0;
  if (player.moving) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    if (!player.isAttacking) player.facing = Math.atan2(dy, dx);
    player.walkPhase += dt * (player.heroClass === 'rogue' ? 18 : player.heroClass === 'ranger' ? 16 : 14) * hasteMult;
    player.capeWave += dt * 11;
  } else {
    player.walkPhase *= 0.85;
    player.capeWave += dt * 2;
  }

  player.x += dx * player.speed * dt;
  player.y += dy * player.speed * dt;
  resolveWallCollision(player, state.walls);

  if (player.moving) {
    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > 12) player.trail.shift();
  } else if (player.trail.length > 0) {
    player.trail.shift();
  }

  // ---- Primary Attack (Sword swing vs. Bow arrows vs. Rogue daggers) ----
  if (player.attackCooldown > 0) player.attackCooldown -= dt;

  if (keys.space && !player.isAttacking && player.attackCooldown <= 0) {
    player.attackAngle = player.facing;
    player.attackCooldown = player.baseCooldown / hasteMult;

    if (player.heroClass === 'warrior') {
      // 🛡️ Greatsword kinetic sweep
      sfx.swordSweep();
      player.isAttacking = true;
      player.attackProgress = 0;
      player.attackCombo = (player.attackCombo % 2) + 1;
    } else if (player.heroClass === 'ranger') {
      sfx.bowRelease();
      burst(state.particles, player.x + Math.cos(player.facing) * 16, player.y + Math.sin(player.facing) * 16, 6, '#ffd866', 100, 3, true, 'spark');
      const arrowDmg = 1 + player.bonusDamage;
      const arrows = player.rangerMultiShot ? [player.facing - 0.12, player.facing, player.facing + 0.12] : [player.facing];
      for (const ang of arrows) {
        state.projectiles.push({
          id: nextProjId++,
          x: player.x + Math.cos(player.facing) * 18,
          y: player.y + Math.sin(player.facing) * 18,
          vx: Math.cos(ang) * 750,
          vy: Math.sin(ang) * 750,
          type: 'arrow',
          friendly: true,
          damage: arrowDmg,
          piercing: player.rangerPierceBonus ? true : true,
          radius: 8,
          life: 1.4,
          angle: ang,
        });
      }
      shake(state, 4, 0.08);
      floatText(state.floatingTexts, player.x, player.y - 20, player.rangerMultiShot ? 'DOUBLE TIR 🏹🏹' : 'TIR 🏹', '#ffd866', 14);
    } else if (player.heroClass === 'rogue') {
      sfx.daggersFan();
      shake(state, 4, 0.08);
      const lvl = player.heroLevel;
      const nbDaggers = lvl >= 10 ? 3 : lvl >= 5 ? 2 : 1;
      const spread = nbDaggers === 3 ? 0.3 : nbDaggers === 2 ? 0.22 : 0;
      floatText(state.floatingTexts, player.x, player.y - 20, `DAGUES 🗡️ ×${nbDaggers}`, '#7dffc4', 14);
      for (let i = 0; i < nbDaggers; i++) {
        const angOffset = nbDaggers === 1 ? 0 : -spread + (spread * 2) * (i / (nbDaggers - 1));
        const shootAng = player.facing + angOffset;
        const isCrit = Math.random() < player.critChance;
        const daggerDmg = (2 + player.bonusDamage) * (isCrit ? player.rogueCritMul : 1);
        state.projectiles.push({
          id: nextProjId++,
          x: player.x + Math.cos(player.facing) * 14,
          y: player.y + Math.sin(player.facing) * 14,
          vx: Math.cos(shootAng) * 820,
          vy: Math.sin(shootAng) * 820,
          type: 'dagger',
          friendly: true,
          damage: daggerDmg,
          piercing: false,
          radius: 7,
          life: 0.85,
          angle: shootAng,
        });
        if (isCrit) {
          floatText(state.floatingTexts, player.x + Math.cos(shootAng) * 30, player.y - 24, `CRIT ×${player.rogueCritMul}!`, '#ff4444', 15);
        }
      }
    }
  }

  // Manage physical Warrior sword sweep interactions
  let hitRegistered = false;
  if (player.isAttacking && player.heroClass === 'warrior') {
    player.attackProgress += dt / ATTACK_DURATION;
    if (player.attackProgress >= 0.15 && player.attackProgress <= 0.55) {
      // Check enemies
      for (const enemy of state.enemies) {
        if (enemy.health <= 0 || enemy.spawnTimer > 0 || enemy.dyingTimer > 0 || enemy.hitTimer > 0.05) continue;
        if (pointInArc(enemy.x, enemy.y, player.x, player.y, player.attackAngle, ATTACK_ARC, 82 + enemy.size * 0.38)) {
          const isCrit = Math.random() < player.critChance;
          const dmg = (1 + player.bonusDamage) * (isCrit ? (player.heroClass === 'rogue' ? player.rogueCritMul : 2) : 1);
          enemy.health -= dmg;
          enemy.hitTimer = 0.22;
          hitRegistered = true;
          sfx.hitEnemy();

          if (isCrit) {
            floatText(state.floatingTexts, enemy.x, enemy.y - 16, `CRIT ×${player.heroClass === 'rogue' ? player.rogueCritMul : 2}!`, '#ff4444', 18);
            shake(state, 12, 0.18);
          }

          const kAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
          const kb = enemy.type === 'tank' ? 10 : 28;
          enemy.x += Math.cos(kAngle) * kb;
          enemy.y += Math.sin(kAngle) * kb;
          resolveWallCollision({ x: enemy.x, y: enemy.y, radius: enemy.size / 2 }, state.walls);

          const pColor = enemy.type === 'tank' ? '#ff5555' : enemy.type === 'berserker' ? '#ff3300' : enemy.type === 'fast' ? '#ffbb33' : enemy.type === 'shooter' ? '#cc66ff' : '#ff7755';
          burst(state.particles, enemy.x, enemy.y, 14, pColor, 180, 4, true, 'slash');
          shake(state, 8, 0.12);

          if (enemy.health <= 0) {
            enemy.dyingTimer = 0.4; enemy.health = 0;
            addXp(state, enemy.type === 'tank' ? 35 : enemy.type === 'berserker' ? 30 : enemy.type === 'shooter' ? 25 : enemy.type === 'fast' ? 20 : 15, enemy.x, enemy.y);
          }
        }
      }
      // Check breakable wooden chests
      for (const chest of state.chests) {
        if (chest.opened || chest.hitTimer > 0) continue;
        if (pointInArc(chest.x, chest.y, player.x, player.y, player.attackAngle, ATTACK_ARC, 80 + chest.size * 0.4)) {
          chest.health -= (1 + player.bonusDamage);
          chest.hitTimer = 0.2;
          hitRegistered = true;
          sfx.chestBreak();
          shatter(state.particles, chest.x, chest.y, '#b8860b', chest.size);
          shake(state, 6, 0.1);
          if (chest.health <= 0) {
            chest.opened = true;
            spawnLoot(state, chest.x, chest.y);
            addXp(state, 10, chest.x, chest.y);
            floatText(state.floatingTexts, chest.x, chest.y - 10, 'COFFRE OUVERT 💎', '#00ffcc', 16);
          }
        }
      }
    }
    if (player.attackProgress >= 1) { player.isAttacking = false; player.attackProgress = 0; }
  }

  // ---- Secondary Active Ability (Spell Scroll Casting) ----
  if (player.secondaryCooldown > 0) player.secondaryCooldown -= dt;

  if (keys.spell && player.activeScroll && player.activeScroll.count > 0 && player.secondaryCooldown <= 0) {
    player.secondaryCooldown = 1.0;
    player.activeScroll.count--;

    if (player.activeScroll.type === 'scroll_fireball') {
      // 🔥 Epic Fireball Salvo!
      sfx.fireballSalvo();
      shake(state, 12, 0.2);
      floatText(state.floatingTexts, player.x, player.y - 30, 'BOULE DE FEU 🔥!', '#ff4400', 20);
      burst(state.particles, player.x, player.y, 25, '#ff4400', 220, 5, true, 'rune');

      for (const angOffset of [-0.35, 0, 0.35]) {
        const shootAng = player.facing + angOffset;
        state.projectiles.push({
          id: nextProjId++,
          x: player.x + Math.cos(player.facing) * 16,
          y: player.y + Math.sin(player.facing) * 16,
          vx: Math.cos(shootAng) * 650,
          vy: Math.sin(shootAng) * 650,
          type: 'fireball',
          friendly: true,
          damage: 3,
          piercing: false,
          radius: 18,
          life: 1.8,
          angle: shootAng,
        });
      }
    } else if (player.activeScroll.type === 'scroll_nova') {
      sfx.iceNova();
      shake(state, 16, 0.3);
      state.novaFlash = 1;
      floatText(state.floatingTexts, player.x, player.y - 30, 'NOVA DE GEL ❄️!', '#00eeff', 22);
      burst(state.particles, player.x, player.y, 30, '#00eeff', 450, 6, true, 'star');
      const NOVA_RADIUS = 250;
      for (const enemy of state.enemies) {
        if (enemy.health <= 0 || enemy.dyingTimer > 0) continue;
        const dx = enemy.x - player.x, dy = enemy.y - player.y;
        if (Math.sqrt(dx * dx + dy * dy) > NOVA_RADIUS) continue;
        enemy.health -= (2 + player.bonusDamage);
        enemy.frozenTimer = 2.5;
        burst(state.particles, enemy.x, enemy.y, 6, '#00eeff', 100, 3.5, true, 'shard');
        if (enemy.health <= 0) {
          enemy.dyingTimer = 0.4; enemy.health = 0;
          addXp(state, enemy.type === 'tank' ? 35 : enemy.type === 'berserker' ? 30 : enemy.type === 'shooter' ? 25 : enemy.type === 'fast' ? 20 : 15, enemy.x, enemy.y);
        }
      }
      for (const chest of state.chests) {
        if (!chest.opened) {
          chest.opened = true;
          shatter(state.particles, chest.x, chest.y, '#00eeff', chest.size);
          spawnLoot(state, chest.x, chest.y);
          floatText(state.floatingTexts, chest.x, chest.y - 10, 'GELÉ 💎', '#00eeff', 16);
        }
      }
    }
  }

  // ---- Manage Projectiles Physics & Collisions ----
  for (let p = state.projectiles.length - 1; p >= 0; p--) {
    const proj = state.projectiles[p];
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.life -= dt;

    // Trail FX
    if (Math.random() < 0.6 && state.particles.length < MAX_PARTICLES) {
      const pcol = proj.type === 'fireball' ? '#ff5500' : proj.type === 'arrow' ? '#ffd866' : proj.type === 'enemy_bolt' ? '#cc66ff' : '#ffffff';
      state.particles.push({
        x: proj.x, y: proj.y,
        vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40,
        life: 0.25, maxLife: 0.25, color: pcol, size: proj.radius * 0.4, glow: true,
      });
    }

    let remove = proj.life <= 0;

    // Wall collision
    for (const wall of state.walls) {
      if (proj.x + proj.radius > wall.x && proj.x - proj.radius < wall.x + wall.width &&
          proj.y + proj.radius > wall.y && proj.y - proj.radius < wall.y + wall.height) {
        if (wall.type !== 'water') {
          remove = true;
          burst(state.particles, proj.x, proj.y, 8, '#cccccc', 120, 3, false, 'shard');
          break;
        }
      }
    }

    // Hit enemies (if friendly)
    if (proj.friendly && !remove) {
      for (const enemy of state.enemies) {
        if (enemy.health <= 0 || enemy.spawnTimer > 0 || enemy.dyingTimer > 0 || enemy.hitTimer > 0.05) continue;
        if (circleCircle(proj.x, proj.y, proj.radius, enemy.x, enemy.y, enemy.size / 2)) {
          enemy.health -= proj.damage;
          enemy.hitTimer = 0.2;
          hitRegistered = true;

          const pColor = proj.type === 'fireball' ? '#ff3300' : enemy.type === 'tank' ? '#ff5555' : '#ffaa00';
          burst(state.particles, enemy.x, enemy.y, proj.type === 'fireball' ? 26 : 12, pColor, 200, 4, true, 'spark');
          shake(state, proj.type === 'fireball' ? 10 : 5, 0.1);

          // Knockback
          const kb = proj.type === 'fireball' ? 36 : 16;
          enemy.x += Math.cos(proj.angle) * kb;
          enemy.y += Math.sin(proj.angle) * kb;
          resolveWallCollision({ x: enemy.x, y: enemy.y, radius: enemy.size / 2 }, state.walls);

          if (enemy.health <= 0) {
            enemy.dyingTimer = 0.4; enemy.health = 0;
            addXp(state, enemy.type === 'tank' ? 35 : enemy.type === 'berserker' ? 30 : enemy.type === 'shooter' ? 25 : enemy.type === 'fast' ? 20 : 15, enemy.x, enemy.y);
          }
          if (!proj.piercing) { remove = true; break; }
        }
      }

      // Hit wooden breakable chests
      if (!remove) {
        for (const chest of state.chests) {
          if (chest.opened || chest.hitTimer > 0) continue;
          if (circleCircle(proj.x, proj.y, proj.radius, chest.x, chest.y, chest.size / 2)) {
            chest.health -= proj.damage;
            chest.hitTimer = 0.2;
            hitRegistered = true;
            shatter(state.particles, chest.x, chest.y, '#b8860b', chest.size);
            shake(state, 6, 0.1);
            if (chest.health <= 0) {
              chest.opened = true;
              spawnLoot(state, chest.x, chest.y);
              addXp(state, 10, chest.x, chest.y);
              floatText(state.floatingTexts, chest.x, chest.y - 10, 'COFFRE 💎', '#00ffcc', 16);
            }
            if (!proj.piercing) { remove = true; break; }
          }
        }
      }
    }

    // Hit player (if enemy projectile)
    if (!proj.friendly && !remove && player.invincibleTimer <= 0) {
      if (circleCircle(proj.x, proj.y, proj.radius, player.x, player.y, player.radius)) {
        remove = true;
        const rawDmg = 1;
        const mitigated = Math.max(0, rawDmg - player.armor);
        if (mitigated <= 0) {
          floatText(state.floatingTexts, player.x, player.y - 26, 'BLOQUÉ! 🛡️', '#66ccff', 16);
          sfx.hitEnemy();
        } else {
          player.health -= mitigated;
          player.invincibleTimer = 1.2;
          state.damageFlash = 1;
          state.flashColor = '#ff0033';
          sfx.playerHurt();
          shake(state, 14, 0.3);
          burst(state.particles, player.x, player.y, 22, '#cc66ff', 240, 5, true);
          state.combo = 0;
          floatText(state.floatingTexts, player.x, player.y - 26, `-${mitigated} PV`, '#ff5566', 18);
        }

        if (player.health <= 0) {
          state.status = 'gameOver';
          sfx.gameOver();
          burst(state.particles, player.x, player.y, 60, '#33ff99', 350, 6, true);
          shatter(state.particles, player.x, player.y, '#00cc66', player.radius);
          floatText(state.floatingTexts, player.x, player.y - 32, 'TERRASSÉ...', '#ff4466', 22);
          return;
        }
      }
    }

    if (remove) state.projectiles.splice(p, 1);
  }

  if (hitRegistered && state.hitStop <= 0) state.hitStop = 0.05;
  if (player.invincibleTimer > 0) player.invincibleTimer -= dt;

  // ---- Manage Loot Consumable Items Collection ----
  for (let i = state.items.length - 1; i >= 0; i--) {
    const item = state.items[i];
    item.bob += dt * 4;

    // Pick up items
    if (circleCircle(player.x, player.y, player.radius + 12, item.x, item.y, 15)) {
      sfx.pickupLoot();
      if (item.type === 'health_potion' || item.type === 'food') {
        if (player.health < player.maxHealth) player.health++;
        state.healFlash = 0.8;
        state.flashColor = '#00ff88';
        floatText(state.floatingTexts, item.x, item.y - 20, '+1 PV 💚', '#00ff88', 18);
      } else if (item.type === 'speed_potion') {
        player.activeBuffs.push({ type: 'speed', duration: 8.0, maxDuration: 8.0 });
        state.novaFlash = 0.8;
        floatText(state.floatingTexts, item.x, item.y - 20, 'VITESSE +35% ⚡', '#00eeff', 18);
      } else if (item.type === 'shield_potion') {
        player.activeBuffs.push({ type: 'shield', duration: 6.0, maxDuration: 6.0 });
        state.healFlash = 0.8;
        state.flashColor = '#ffd700';
        floatText(state.floatingTexts, item.x, item.y - 20, 'INVULNÉRABLE 🛡️', '#ffd700', 18);
      } else if (item.type === 'scroll_fireball') {
        if (!player.activeScroll || player.activeScroll.type !== 'scroll_fireball') {
          player.activeScroll = { type: 'scroll_fireball', name: 'Boule de Feu', icon: '🔥', count: 2 };
        } else {
          player.activeScroll.count += 2;
        }
        floatText(state.floatingTexts, item.x, item.y - 20, 'SORT FEU +2 🔥', '#ff5500', 18);
      } else if (item.type === 'scroll_nova') {
        if (!player.activeScroll || player.activeScroll.type !== 'scroll_nova') {
          player.activeScroll = { type: 'scroll_nova', name: 'Nova de Gel', icon: '❄️', count: 2 };
        } else {
          player.activeScroll.count += 2;
        }
        floatText(state.floatingTexts, item.x, item.y - 20, 'SORT GEL +2 ❄️', '#00eeff', 18);
      }

      burst(state.particles, item.x, item.y, 22, '#ffd700', 180, 4.5, true, 'star');
      state.score += 25;
      state.items.splice(i, 1);
    }
  }

  // ---- Manage Breakable wooden chests timers ----
  for (const chest of state.chests) {
    if (chest.hitTimer > 0) chest.hitTimer -= dt;
  }

  // ---- Enemy AI & Incantations ----
  for (const enemy of state.enemies) {
    if (enemy.spawnTimer > 0) { enemy.spawnTimer -= dt; continue; }
    if (enemy.dyingTimer > 0) continue;

    // Glacial frozen magic total freeze
    if (enemy.frozenTimer && enemy.frozenTimer > 0) {
      enemy.frozenTimer -= dt;
      if (Math.random() < 0.2 && state.particles.length < MAX_PARTICLES) {
        state.particles.push({
          x: enemy.x + (Math.random() - 0.5) * enemy.size,
          y: enemy.y + (Math.random() - 0.5) * enemy.size,
          vx: 0, vy: -10, life: 0.3, maxLife: 0.3, color: '#00eeff', size: 2, glow: true, shape: 'spark',
        });
      }
      continue;
    }

    enemy.walkPhase += dt * (enemy.type === 'berserker' ? 24 : enemy.type === 'fast' ? 22 : enemy.type === 'tank' ? 8 : 14);
    if (enemy.hitTimer > 0) enemy.hitTimer -= dt;
    if (enemy.attackCooldown > 0) enemy.attackCooldown -= dt;

    const edx = player.x - enemy.x;
    const edy = player.y - enemy.y;
    const dist = Math.hypot(edx, edy);

    if (enemy.type === 'shooter' && dist < 360 && enemy.attackCooldown <= 0) {
      // 💀 Incantate Enemy Bolt Projectile!
      enemy.attackCooldown = 2.6;
      sfx.enemyShoot();
      const ang = Math.atan2(edy, edx);
      burst(state.particles, enemy.x, enemy.y, 12, '#cc66ff', 100, 3.5, true, 'rune');
      state.projectiles.push({
        id: nextProjId++,
        x: enemy.x + Math.cos(ang) * 16,
        y: enemy.y + Math.sin(ang) * 16,
        vx: Math.cos(ang) * 450,
        vy: Math.sin(ang) * 450,
        type: 'enemy_bolt',
        friendly: false,
        damage: 1,
        piercing: false,
        radius: 9,
        life: 1.8,
        angle: ang,
      });
      enemy.angle = ang;
    }

    if (enemy.type === 'berserker' && dist < 180 && dist > 50 && enemy.attackCooldown <= 0) {
      enemy.dashTimer = 0.25;
      enemy.attackCooldown = 1.8;
      enemy.angle = Math.atan2(edy, edx);
      burst(state.particles, enemy.x, enemy.y, 6, '#ff3300', 80, 3, true, 'shard');
    }

    if (enemy.dashTimer && enemy.dashTimer > 0) {
      enemy.dashTimer -= dt;
      enemy.x += Math.cos(enemy.angle) * 350 * dt;
      enemy.y += Math.sin(enemy.angle) * 350 * dt;
    } else if (dist > 0) {
      const slowMul = (enemy.frozenTimer && enemy.frozenTimer > 0) ? 0.35 : 1;
      const spd = enemy.speed * dt * slowMul;
      enemy.x += (edx / dist) * spd;
      enemy.y += (edy / dist) * spd;
      enemy.angle = Math.atan2(edy, edx);
    }

    const ec = { x: enemy.x, y: enemy.y, radius: enemy.size / 2 };
    resolveWallCollision(ec, state.walls);
    enemy.x = ec.x; enemy.y = ec.y;
  }

  // Enemy separation
  for (let i = 0; i < state.enemies.length; i++) {
    const a = state.enemies[i];
    if (a.health <= 0 || (a.frozenTimer && a.frozenTimer > 0)) continue;
    for (let j = i + 1; j < state.enemies.length; j++) {
      const b = state.enemies[j];
      if (b.health <= 0 || (b.frozenTimer && b.frozenTimer > 0)) continue;
      const sx = a.x - b.x, sy = a.y - b.y;
      const d = Math.hypot(sx, sy);
      const minD = (a.size + b.size) * 0.44;
      if (d < minD && d > 0.01) {
        const push = (minD - d) * 0.5;
        const nx = sx / d, ny = sy / d;
        a.x += nx * push; a.y += ny * push;
        b.x -= nx * push; b.y -= ny * push;
      }
    }
  }

  // ---- Player Touch Damage ----
  for (const enemy of state.enemies) {
    if (enemy.health <= 0 || enemy.spawnTimer > 0 || enemy.dyingTimer > 0 || (enemy.frozenTimer && enemy.frozenTimer > 0)) continue;
    if (player.invincibleTimer <= 0 && circleCircle(player.x, player.y, player.radius, enemy.x, enemy.y, enemy.size / 2)) {
      const rawDmg = 1;
      const mitigated = Math.max(0, rawDmg - player.armor);
      if (mitigated <= 0) {
        floatText(state.floatingTexts, player.x, player.y - 26, 'BLOQUÉ! 🛡️', '#66ccff', 16);
        sfx.hitEnemy();
        player.invincibleTimer = 0.5;
      } else {
        player.health -= mitigated;
        player.invincibleTimer = 1.2;
        state.damageFlash = 1;
        state.flashColor = '#ff0033';
        sfx.playerHurt();
        shake(state, 15, 0.32);
        state.hitStop = 0.08;
        burst(state.particles, player.x, player.y, 24, '#33ff99', 260, 5, true);

        const kAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        player.x += Math.cos(kAngle) * 44;
        player.y += Math.sin(kAngle) * 44;
        resolveWallCollision(player, state.walls);

        state.combo = 0;
        floatText(state.floatingTexts, player.x, player.y - 26, `-${mitigated} PV`, '#ff5566', 18);
      }

      if (player.health <= 0) {
        state.status = 'gameOver';
        sfx.gameOver();
        burst(state.particles, player.x, player.y, 60, '#33ff99', 350, 6, true);
        shatter(state.particles, player.x, player.y, '#00cc66', player.radius);
        floatText(state.floatingTexts, player.x, player.y - 32, 'TERRASSÉ...', '#ff4466', 22);
        return;
      }
    }
  }

  // ---- Process Dying Enemies ----
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.dyingTimer > 0) {
      e.dyingTimer -= dt;
      if (e.dyingTimer <= 0) {
        const color = e.type === 'tank' ? '#ff3322' : e.type === 'berserker' ? '#ff3300' : e.type === 'fast' ? '#ffce33' : e.type === 'shooter' ? '#cc66ff' : '#ff6644';
        shatter(state.particles, e.x, e.y, color, e.size);
        burst(state.particles, e.x, e.y, 20, color, 240, 4.5, true);

        // 35% chance to drop fabulous random loot
        if (Math.random() < 0.35) {
          spawnLoot(state, e.x, e.y);
        }

        const base = e.type === 'tank' ? 45 : e.type === 'berserker' ? 30 : e.type === 'fast' ? 20 : e.type === 'shooter' ? 30 : 12;
        state.combo++;
        state.comboTimer = COMBO_WINDOW;
        const comboMult = 1 + (state.combo - 1) * 0.25;
        const gained = Math.round(base * comboMult);
        state.score += gained;

        floatText(state.floatingTexts, e.x, e.y - 10, `+${gained}`, '#ffd84d', 17);
        if (state.combo >= 3) {
          floatText(state.floatingTexts, e.x, e.y - 32, `COMBO ×${state.combo}!`, '#66ffee', 15);
        }
        state.enemies.splice(i, 1);
      }
    }
  }

  // ---- Wave Clear & Key ----
  const aliveCount = state.enemies.filter(e => e.health > 0 && e.dyingTimer <= 0).length;
  if (aliveCount === 0 && !state.goldKey && !state.door) {
    const keyRad = 20;
    const keySpot = findSafeSpawn(keyRad, state.walls, dims.w / 2, dims.h / 2 - 20);
    state.goldKey = { x: keySpot.x, y: keySpot.y, collected: false, spawnAnim: 0, bobAngle: 0 };
  }

  if (state.goldKey) {
    const key = state.goldKey;
    key.spawnAnim = Math.min(1, key.spawnAnim + dt * 2.8);
    key.bobAngle += dt * 3;
    if (circleCircle(player.x, player.y, player.radius + 14, key.x, key.y, 16)) {
      key.collected = true;
      state.door = createDoor();
      state.score += 50;
      state.healFlash = 1;
      state.flashColor = '#ffd700';
      if (player.health < player.maxHealth) player.health++;

      burst(state.particles, key.x, key.y, 38, '#ffd84d', 240, 5, true);
      floatText(state.floatingTexts, key.x, key.y, '+50', '#ffd84d', 19);
      floatText(state.floatingTexts, dims.w / 2, dims.h / 2 - 70, '🗝️ CLÉ OBTENUE !', '#ffd84d', 22);
    }
    if (key.collected) state.goldKey = null;
  }

  // ---- Door Exit ----
  if (state.door) {
    const door = state.door;
    if (!door.open) door.open = true;
    if (door.open && door.animProgress < 1) door.animProgress = Math.min(1, door.animProgress + dt * 1.8);
    if (door.open && door.animProgress >= 1 &&
        circleCircle(player.x, player.y, player.radius, door.x + door.width / 2, door.y + door.height / 2, door.width * 0.65)) {
      state.roomLevel++;
      state.score += 150;
      state.combo = 0;
      addXp(state, 50, dims.w / 2, dims.h / 2); // 50 XP bonus for clearing room!
      sfx.victoryStep();
      floatText(state.floatingTexts, dims.w / 2, dims.h / 2 - 80, `VICTOIRE — SALLE ${state.roomLevel}`, '#66ffee', 26);
      burst(state.particles, dims.w / 2, dims.h / 2, 42, '#66ffee', 200, 4.5, true);
      initRoom(state, true);
    }
  }

  updateParticles(state, dt);
}

function updateParticles(state: GameState, dt: number): void {
  let writeIdx = 0;
  const parts = state.particles;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
    if (p.gravity) p.vy += p.gravity * dt;
    if (p.vr) p.rotation = (p.rotation || 0) + p.vr * dt;
    p.life -= dt;
    if (p.life > 0) {
      if (writeIdx !== i) parts[writeIdx] = p;
      writeIdx++;
    }
  }
  parts.length = writeIdx;

  let w2 = 0;
  const fts = state.floatingTexts;
  for (let i = 0; i < fts.length; i++) {
    const ft = fts[i];
    ft.y += ft.vy * dt;
    ft.vy *= 0.96;
    ft.life -= dt;
    if (ft.life > 0) {
      if (w2 !== i) fts[w2] = ft;
      w2++;
    }
  }
  fts.length = w2;
}
