// ============================================================
// DONJONFLASH — Types
// Créateur : Hylst - Geoffroy avec l'aide d'une IA
// ============================================================

export interface Vec2 {
  x: number;
  y: number;
}

export type HeroClass = 'warrior' | 'ranger' | 'rogue';

export interface ConsumableItem {
  id: number;
  x: number;
  y: number;
  type: 'health_potion' | 'speed_potion' | 'shield_potion' | 'scroll_fireball' | 'scroll_nova' | 'food';
  name: string;
  bob: number;
}

export interface BreakableChest {
  id: number;
  x: number;
  y: number;
  size: number;
  health: number;
  maxHealth: number;
  hitTimer: number;
  opened: boolean;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'arrow' | 'dagger' | 'fireball' | 'nova' | 'enemy_bolt';
  friendly: boolean;
  damage: number;
  piercing: boolean;
  radius: number;
  life: number;
  angle: number;
}

export interface Buff {
  type: 'speed' | 'shield' | 'frenzy';
  duration: number;
  maxDuration: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity?: number;
  glow?: boolean;
  shape?: 'circle' | 'shard' | 'spark' | 'ring' | 'rune' | 'star' | 'slash';
  rotation?: number;
  vr?: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  vy: number;
}

export interface SpellScroll {
  type: 'scroll_fireball' | 'scroll_nova';
  name: string;
  icon: string;
  count: number;
}

export interface Player {
  heroClass: HeroClass;
  heroLevel: number;
  xp: number;
  xpNext: number;
  x: number;
  y: number;
  radius: number;
  speed: number;
  baseSpeed: number;
  health: number;
  maxHealth: number;
  facing: number;
  isAttacking: boolean;
  attackAngle: number;
  attackProgress: number;
  attackCooldown: number;
  baseCooldown: number;
  attackCombo: number;
  invincibleTimer: number;
  trail: Vec2[];
  walkPhase: number;
  moving: boolean;
  capeWave: number;
  activeBuffs: Buff[];
  activeScroll: SpellScroll | null;
  secondaryCooldown: number;
  bonusDamage: number;
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  baseSpeed: number;
  health: number;
  maxHealth: number;
  type: 'normal' | 'fast' | 'tank' | 'shooter';
  hitTimer: number;
  angle: number;       // attention / move angle
  spawnTimer: number;  // spawning entry animation
  dyingTimer: number;  // explosion / death animation
  walkPhase: number;
  attackCooldown: number;
  dashTimer?: number;
  frozenTimer?: number; // active if frozen by magic
}

export interface Wall {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'wall' | 'pillar' | 'block' | 'water';
}

export interface Door {
  x: number;
  y: number;
  width: number;
  height: number;
  open: boolean;
  animProgress: number;
}

export interface GoldKey {
  x: number;
  y: number;
  collected: boolean;
  spawnAnim: number;
  bobAngle: number;
}

export interface ScreenShake {
  x: number;
  y: number;
  intensity: number;
  duration: number;
}

export interface GameState {
  status: 'menu' | 'onboarding' | 'playing' | 'paused' | 'gameOver';
  selectedClass: HeroClass;
  roomLevel: number;
  roomType: 'arena' | 'pillars' | 'cross' | 'corridors' | 'labyrinth' | 'royal';
  roomName: string;
  score: number;
  combo: number;
  comboTimer: number;
  roomTransition: number;
  screenShake: ScreenShake;
  damageFlash: number;
  healFlash: number;
  novaFlash: number;
  flashColor: string;
  enemies: Enemy[];
  chests: BreakableChest[];
  items: ConsumableItem[];
  projectiles: Projectile[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  player: Player;
  walls: Wall[];
  door: Door | null;
  goldKey: GoldKey | null;
  hitStop: number;
  time: number;
}

export interface Keys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  space: boolean; // primary attack (sword, bow, daggers)
  spell: boolean; // secondary active (use scroll / magic item)
  enter: boolean;
}
