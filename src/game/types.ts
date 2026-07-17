import * as THREE from 'three';

// ==================== CORE TYPES ====================
export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'SHOP';

export type EnemyType = 'LIGHT_DASH' | 'MEDIUM_RIFLE' | 'HEAVY_JUGGERNAUT' | 'GLITCH_DRONE';
export type WeaponClass = 'H' | 'M' | 'L';

export type SelectedWeapon =
  | 'sa1216' | 'lewis' | 'flamethrower' | 'cl40' | 'xp54'
  | 'fcar' | 'm60' | 'm11' | 'pike556';

export type SelectedSkill = 'charge_slam' | 'mesh_shield' | 'winch_claw';
export type SelectedOptic = 'iron' | 'reddot' | 'holo' | 'acog' | 'scope4x';
export type Language = 'zh' | 'en';

// ==================== GADGET SYSTEM ====================
export type GadgetId =
  | 'frag_grenade' | 'sticky_bomb' | 'smoke_grenade' | 'flashbang'
  | 'health_shot' | 'medkit' | 'trophy_system' | 'trip_mine'
  | 'c4' | 'gas_grenade' | 'decoy' | 'repair_field'
  | 'adrenaline_shot' | 'defibrillator' | 'fireball';

export interface GadgetConfig {
  id: GadgetId;
  nameEn: string;
  nameZh: string;
  descriptionEn: string;
  descriptionZh: string;
  category: 'throwable' | 'placeable' | 'instant';
  maxAmmo: number;
  respawnTime: number;
  throwSpeed?: number;     // for throwables
  gravity?: number;        // for throwables
  fuseTime?: number;       // for explosives
  damage?: number;         // for damage gadgets
  effectRadius?: number;
  effectDuration?: number;
  healAmount?: number;
  color: number;
  icon: string;
}

export interface ThrownGadget {
  id: string;
  config: GadgetConfig;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  lifetime: number;
  fuseTimer: number;
  stuck: boolean;
  stuckToEnemy?: string;
  activated: boolean;
  effectTimer: number;
}

export interface ActiveGadgetEffect {
  id: string;
  gadgetId: GadgetId;
  position: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
  mesh?: THREE.Mesh | THREE.Group;
}

// ==================== EXISTING TYPES ====================

export interface OpticConfig {
  id: SelectedOptic;
  nameEn: string;
  nameZh: string;
  descriptionEn: string;
  descriptionZh: string;
  fovReduction: number;
  sensitivityMul: number;
  reticle: 'iron' | 'dot' | 'holo' | 'cross' | 'mil-dot';
}

export interface WeaponConfig {
  id: SelectedWeapon;
  nameEn: string;
  nameZh: string;
  typeEn: string;
  typeZh: string;
  descriptionEn: string;
  descriptionZh: string;
  maxMagazine: number;
  reloadTime: number;
  damagePerShot: number;
  fireRate: number;
  range: number;
  isAuto: boolean;
  weaponClass: WeaponClass;
  pelletCount?: number;
  pelletSpread?: number;
  flameRange?: number;
  flameConeAngle?: number;
  explosionRadius?: number;
  burstSize?: number;
  burstInterval?: number;
  burstCooldown?: number;
}

export interface SkillConfig {
  id: SelectedSkill;
  nameEn: string;
  nameZh: string;
  descriptionEn: string;
  descriptionZh: string;
  cooldown: number;
  duration?: number;
}

export interface EnemyConfig {
  type: EnemyType;
  name: string;
  hp: number;
  speed: number;
  color: number;
  scale: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  coinCount: number;
  cashValue: number;
}

export interface EnemyInstance {
  id: string;
  config: EnemyConfig;
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  velocity: THREE.Vector3;
  attackTimer: number;
  isStunned: boolean;
  stunTimer: number;
  hitFlashTimer: number;
  hpBarTimer: number;
  targetPos: THREE.Vector3;
  burnTimer?: number;
  burnDamageTimer?: number;
  blindedTimer?: number;  // Flashbang effect
  poisonedTimer?: number; // Gas grenade effect
}

export interface EnemyHPBar {
  id: string;
  hpPercent: number;
  position: THREE.Vector3;
  color: number;
  lifetime: number;
}

export interface CoinParticle {
  id: string;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  value: number;
  bounceCount: number;
  lifetime: number;
  isMagnetized: boolean;
}

export interface DebrisParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
}

export interface FlameParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
}

export interface WinchChainParticle {
  mesh: THREE.Line;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  lifetime: number;
}

export interface CoverObstacle {
  id: string;
  mesh: THREE.Mesh | THREE.Group;
  boundingBox: THREE.Box3;
  hp: number;
  maxHp: number;
  isDestructible: boolean;
  color: number;
}

export interface FloatingText3D {
  id: string;
  text: string;
  position: THREE.Vector3;
  color: string;
  lifetime: number;
  maxLifetime: number;
  isCrit: boolean;
  scale: number;
}

export interface WeaponDebugConfig {
  maxMagazine: number;
  reloadTime: number;
  damagePerShot: number;
  fireRate: number;
  range: number;
  pelletCount?: number;
  pelletSpread?: number;
  burstSize?: number;
  cylinderRotateDelay?: number;
  flameRange?: number;
  flameConeAngle?: number;
  burnDuration?: number;
  explosionRadius?: number;
  burstCooldown?: number;
}

export interface SkillDebugConfig {
  cooldown: number;
  duration?: number;
  shieldHp?: number;
  chargeSpeed?: number;
  chargeDamage?: number;
  slamDamage?: number;
  slamRadius?: number;
  pullForce?: number;
  range?: number;
}

export interface EnemyDebugConfig {
  spawnBase: number;
  spawnPerWave: number;
  hpMultiplier: number;
  hpBonusPerWave: number;
}

export interface DebugTuning {
  weapons: Record<SelectedWeapon, WeaponDebugConfig>;
  skills: Record<SelectedSkill, SkillDebugConfig>;
  enemies: EnemyDebugConfig;
}

export interface PlayerUpgrades {
  reloadSpeedMultiplier: number;
  skillCooldownReduction: number;
  magnetRadius: number;
  maxHpBonus: number;
  movementSpeedBonus: number;
}

export interface DevCheats {
  godMode: boolean;
  infiniteAmmo: boolean;
  damageMultiplier: number;
  speedMultiplier: number;
  enemySpawnMultiplier: number;
  instantCooldown: boolean;
}

export interface GameSettings {
  sensitivity: number;
  fov: number;
  volume: number;
  showFps: boolean;
  screenShake: boolean;
  language: Language;
  cheats: DevCheats;
  debug: DebugTuning;
  gadgetSlots: (GadgetId | null)[];  // 4 slots
}

export interface HighScoreRecord {
  id: string;
  date: string;
  cashOut: number;
  wave: number;
  kills: number;
  timeSurvived: string;
  weapon: SelectedWeapon;
  skill: SelectedSkill;
}

export interface UpgradeItem {
  id: keyof PlayerUpgrades | 'heal';
  titleEn: string;
  titleZh: string;
  descriptionEn: string;
  descriptionZh: string;
  cost: number;
  icon: string;
  level: number;
  maxLevel: number;
}
