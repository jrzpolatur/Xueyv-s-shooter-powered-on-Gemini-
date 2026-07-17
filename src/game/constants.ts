import { EnemyConfig, EnemyType, UpgradeItem, WeaponConfig, SkillConfig,
  SelectedWeapon, SelectedSkill, DebugTuning, OpticConfig, SelectedOptic,
  GadgetConfig, GadgetId } from './types';

// ==================== WEAPONS ====================
export const WEAPON_CONFIGS: Record<SelectedWeapon, WeaponConfig> = {
  sa1216: {
    id: 'sa1216', nameEn: 'SA1216 ROTATING SHOTGUN', nameZh: 'SA1216 旋转霰弹枪',
    typeEn: '4-BURST ROTATING SHOTGUN', typeZh: '4连发旋转弹匣霰弹枪',
    descriptionEn: 'Heavy rotating drum shotgun. Fires four shell bursts before the cylinder advances.',
    descriptionZh: '重型旋转弹匣霰弹枪，每四发触发一次弹鼓旋转，近战毁天灭地。',
    maxMagazine: 16, reloadTime: 2.2, damagePerShot: 14, fireRate: 0.16,
    range: 40, isAuto: false, weaponClass: 'H',
    pelletCount: 8, pelletSpread: 0.065, burstSize: 4, burstInterval: 0.16, burstCooldown: 0.48,
  },
  lewis: {
    id: 'lewis', nameEn: 'LEWIS MACHINE GUN', nameZh: '刘易斯轻机枪',
    typeEn: 'AUTOMATIC PAN-DRUM LMG', typeZh: '全自动盘式弹鼓轻机枪',
    descriptionEn: 'Classic 47-round pan-drum light machine gun with sustained suppressive fire.',
    descriptionZh: '经典47发盘式弹鼓轻机枪，全自动高压火力压制。',
    maxMagazine: 47, reloadTime: 3.2, damagePerShot: 28, fireRate: 0.11,
    range: 75, isAuto: true, weaponClass: 'H',
  },
  flamethrower: {
    id: 'flamethrower', nameEn: 'FLAMETHROWER', nameZh: '火焰喷射器',
    typeEn: 'INCENDIARY CONE STREAM', typeZh: '持续范围燃油火焰喷射器',
    descriptionEn: 'Projects a continuous cone of burning fuel. Ignites targets with heavy DoT.',
    descriptionZh: '喷射持续灼烧烈焰，附带高频群体引燃伤害，清场利器。',
    maxMagazine: 100, reloadTime: 2.8, damagePerShot: 8, fireRate: 0.05,
    range: 16, isAuto: true, weaponClass: 'H', flameRange: 16, flameConeAngle: 0.38,
  },
  cl40: {
    id: 'cl40', nameEn: 'CL-40 GRENADE LAUNCHER', nameZh: 'CL-40 泵动榴弹发射器',
    typeEn: '40MM PUMP-ACTION LAUNCHER', typeZh: '40毫米泵动榴弹发射器',
    descriptionEn: 'Medium-class pump-action launcher firing explosive 40mm shells with AoE blast.',
    descriptionZh: '中身型选手专属40毫米泵动式榴弹发射器，炮弹触击爆炸造成强力范围AOE伤害。',
    maxMagazine: 4, reloadTime: 2.5, damagePerShot: 110, fireRate: 0.65,
    range: 60, isAuto: false, weaponClass: 'M', explosionRadius: 4.5,
  },
  xp54: {
    id: 'xp54', nameEn: 'XP-54 SUPPRESSED SMG', nameZh: 'XP-54 冲锋枪',
    typeEn: 'SUPPRESSED HIGH-RATE SMG', typeZh: '高射速微声冲锋枪',
    descriptionEn: 'Light-class high-rate suppressed SMG. Minimal recoil and deadly close-range DPS.',
    descriptionZh: '轻身型选手高射速消音冲锋枪，超高射速与稳定低后坐力。',
    maxMagazine: 30, reloadTime: 1.8, damagePerShot: 16, fireRate: 0.07,
    range: 50, isAuto: true, weaponClass: 'L',
  },
  fcar: {
    id: 'fcar', nameEn: 'FCAR ASSAULT RIFLE', nameZh: 'FCAR 突击步枪',
    typeEn: 'MODULAR ASSAULT RIFLE', typeZh: '模块化突击步枪',
    descriptionEn: 'Medium-class modular assault rifle. Balanced range, fire rate and damage.',
    descriptionZh: '中身型选手主力突击步枪，兼顾射程、射速与伤害。',
    maxMagazine: 30, reloadTime: 2.2, damagePerShot: 24, fireRate: 0.09,
    range: 65, isAuto: true, weaponClass: 'M',
  },
  m60: {
    id: 'm60', nameEn: 'M60 GENERAL PURPOSE MG', nameZh: 'M60 通用机枪',
    typeEn: 'BELT-FED GPMG', typeZh: '弹链通用机枪',
    descriptionEn: 'Heavy belt-fed general purpose machine gun. Massive 100-round belt.',
    descriptionZh: '重型弹链通用机枪，100发大容量弹链，提供毁天灭地的持续火力。',
    maxMagazine: 100, reloadTime: 4.5, damagePerShot: 36, fireRate: 0.13,
    range: 85, isAuto: true, weaponClass: 'H',
  },
  m11: {
    id: 'm11', nameEn: 'M11 BURST PISTOL', nameZh: 'M11 三连发手枪',
    typeEn: '3-ROUND BURST PISTOL', typeZh: '三连发战术手枪',
    descriptionEn: 'Light-class burst pistol firing rapid three-round bursts with tight grouping.',
    descriptionZh: '轻身型三连发战术手枪，每次扣动扳机连射三发，密集点射精准致命。',
    maxMagazine: 18, reloadTime: 1.6, damagePerShot: 18, fireRate: 0.08,
    range: 45, isAuto: false, weaponClass: 'L',
    burstSize: 3, burstInterval: 0.06, burstCooldown: 0.35,
  },
  pike556: {
    id: 'pike556', nameEn: 'PIKE-556 DMR', nameZh: 'PIKE-556 精确射手步枪',
    typeEn: 'SEMI-AUTO DMR', typeZh: '半自动精确射手步枪',
    descriptionEn: 'Medium-class designated marksman rifle. Slow semi-auto with high headshot damage.',
    descriptionZh: '中身型半自动精确射手步枪，单发威力巨大，远距离爆头致命。',
    maxMagazine: 15, reloadTime: 2.4, damagePerShot: 72, fireRate: 0.35,
    range: 110, isAuto: false, weaponClass: 'M',
  },
};

// ==================== OPTICS ====================
export const OPTIC_CONFIGS: Record<SelectedOptic, OpticConfig> = {
  iron:    { id: 'iron',    nameEn: 'IRON SIGHTS',       nameZh: '机械瞄具',
             descriptionEn: 'Standard iron sights. Fast target acquisition.',
             descriptionZh: '默认机械瞄具，开镜最快。',
             fovReduction: 4, sensitivityMul: 0.85, reticle: 'iron' },
  reddot:  { id: 'reddot',  nameEn: 'RED DOT REFLEX',    nameZh: '红点瞄具',
             descriptionEn: 'Tactical red-dot reflex sight with 1.5x magnification.',
             descriptionZh: '战术红点反射瞄具，1.5倍放大。',
             fovReduction: 8, sensitivityMul: 0.7, reticle: 'dot' },
  holo:    { id: 'holo',    nameEn: 'HOLOGRAPHIC',       nameZh: '全息瞄具',
             descriptionEn: 'Holographic sight with wide reticle.',
             descriptionZh: '全息瞄具，宽视场准星。',
             fovReduction: 10, sensitivityMul: 0.65, reticle: 'holo' },
  acog:    { id: 'acog',    nameEn: 'ACOG 3X',           nameZh: 'ACOG 三倍镜',
             descriptionEn: '3x ACOG combat scope. Balanced mid-to-long range.',
             descriptionZh: 'ACOG三倍战斗瞄具，中远距离。',
             fovReduction: 22, sensitivityMul: 0.45, reticle: 'cross' },
  scope4x: { id: 'scope4x', nameEn: '4X SCOPE',          nameZh: '四倍镜',
             descriptionEn: '4x magnified scope. Best for DMRs.',
             descriptionZh: '四倍放大瞄具，精确射手步枪首选。',
             fovReduction: 32, sensitivityMul: 0.35, reticle: 'mil-dot' },
};

// ==================== SKILLS ====================
export const SKILL_CONFIGS: Record<SelectedSkill, SkillConfig> = {
  charge_slam: { id: 'charge_slam', nameEn: "CHARGE 'N' SLAM", nameZh: '冲撞与砸击',
                 descriptionEn: 'Rush forward then ground-slam for a golden shockwave.',
                 descriptionZh: '极速前冲撞碎一切掩体障碍，再按下Q或空中下砸释放金色重力冲击波！',
                 cooldown: 8.0, duration: 2.2 },
  mesh_shield: { id: 'mesh_shield', nameEn: 'MESH SHIELD', nameZh: '网格护盾',
                 descriptionEn: 'Deploy a wide projected energy barrier that blocks 600 incoming damage.',
                 descriptionZh: '在身前张开一道宽幅半透明网格护盾，抵挡600点伤害！',
                 cooldown: 6.0, duration: 8.0 },
  winch_claw:  { id: 'winch_claw', nameEn: 'WINCH CLAW', nameZh: '链铁爪',
                 descriptionEn: 'Launch a high-speed grapple chain to hook an enemy and yank them close.',
                 descriptionZh: '发射高速钢索绞盘铁爪钩住远端敌人，瞬间将其猛拽至身前！',
                 cooldown: 7.0 },
};

// ==================== GADGETS (THE FINALS) ====================
export const GADGET_CONFIGS: Record<GadgetId, GadgetConfig> = {
  frag_grenade: {
    id: 'frag_grenade', nameEn: 'FRAG GRENADE', nameZh: '破片手雷',
    descriptionEn: 'Standard fragmentation grenade with 2.5s fuse. Devastating AoE damage.',
    descriptionZh: '标准破片手雷，2.5秒引信，爆炸造成巨额范围伤害。',
    category: 'throwable', maxAmmo: 2, respawnTime: 8,
    throwSpeed: 18, gravity: 22, fuseTime: 2.5, damage: 180, effectRadius: 6,
    color: 0x2d4a2d, icon: '💣',
  },
  sticky_bomb: {
    id: 'sticky_bomb', nameEn: 'STICKY BOMB', nameZh: '黏性炸弹',
    descriptionEn: 'Sticks to surfaces and enemies. Explodes after 3 seconds.',
    descriptionZh: '可黏附在墙壁和敌人身上的炸弹，3秒后爆炸。',
    category: 'throwable', maxAmmo: 2, respawnTime: 10,
    throwSpeed: 15, gravity: 18, fuseTime: 3.0, damage: 220, effectRadius: 5,
    color: 0x8b0000, icon: '',
  },
  smoke_grenade: {
    id: 'smoke_grenade', nameEn: 'SMOKE GRENADE', nameZh: '烟雾弹',
    descriptionEn: 'Creates a thick smoke cloud for 8 seconds. Blocks vision.',
    descriptionZh: '生成持续8秒的浓密烟雾，阻挡视线。',
    category: 'throwable', maxAmmo: 3, respawnTime: 12,
    throwSpeed: 14, gravity: 16, effectDuration: 8, effectRadius: 8,
    color: 0xb0b0b0, icon: '💨',
  },
  flashbang: {
    id: 'flashbang', nameEn: 'FLASHBANG', nameZh: '闪光弹',
    descriptionEn: 'Blinds enemies in 12m radius for 3 seconds.',
    descriptionZh: '使12米范围内的敌人致盲3秒。',
    category: 'throwable', maxAmmo: 3, respawnTime: 10,
    throwSpeed: 16, gravity: 20, fuseTime: 1.5, effectRadius: 12, effectDuration: 3,
    color: 0xffffcc, icon: '⚡',
  },
  health_shot: {
    id: 'health_shot', nameEn: 'HEALTH SHOT', nameZh: '医疗针',
    descriptionEn: 'Instantly restores 100 HP when used.',
    descriptionZh: '即时使用回复100点生命值。',
    category: 'instant', maxAmmo: 3, respawnTime: 15,
    healAmount: 100, color: 0xff4444, icon: '',
  },
  medkit: {
    id: 'medkit', nameEn: 'MEDKIT', nameZh: '医疗包',
    descriptionEn: 'Place a medkit that heals 15 HP/sec for 10 seconds.',
    descriptionZh: '放置医疗包，持续10秒每秒治疗15点生命。',
    category: 'placeable', maxAmmo: 2, respawnTime: 18,
    effectDuration: 10, healAmount: 150, effectRadius: 4, color: 0xffffff, icon: '',
  },
  trophy_system: {
    id: 'trophy_system', nameEn: 'TROPHY SYSTEM', nameZh: '拦截系统',
    descriptionEn: 'Place an APS that intercepts incoming grenades in 8m radius.',
    descriptionZh: '部署主动防御系统，拦截8米范围内的敌方投掷物。',
    category: 'placeable', maxAmmo: 2, respawnTime: 20,
    effectDuration: 20, effectRadius: 8, color: 0x4488ff, icon: '🛡️',
  },
  trip_mine: {
    id: 'trip_mine', nameEn: 'TRIP MINE', nameZh: '感应地雷',
    descriptionEn: 'Place a proximity mine. Explodes when enemies come within 2m.',
    descriptionZh: '部署感应地雷，敌人靠近2米时爆炸造成250伤害。',
    category: 'placeable', maxAmmo: 3, respawnTime: 12,
    damage: 250, effectRadius: 4, color: 0xffaa00, icon: '💥',
  },
  c4: {
    id: 'c4', nameEn: 'C4 EXPLOSIVE', nameZh: 'C4 炸药',
    descriptionEn: 'Stick C4 to surfaces. Press G again to detonate remotely.',
    descriptionZh: '将C4粘附在表面，再次按G键远程引爆。',
    category: 'throwable', maxAmmo: 2, respawnTime: 15,
    throwSpeed: 12, gravity: 24, damage: 400, effectRadius: 8,
    color: 0x333333, icon: '',
  },
  gas_grenade: {
    id: 'gas_grenade', nameEn: 'GAS GRENADE', nameZh: '毒气弹',
    descriptionEn: 'Releases toxic gas for 12 seconds. Poisons enemies in area.',
    descriptionZh: '释放持续12秒的毒气云，毒害区域内的敌人。',
    category: 'throwable', maxAmmo: 2, respawnTime: 18,
    throwSpeed: 14, gravity: 16, effectDuration: 12, effectRadius: 7,
    damage: 8, color: 0x88ff00, icon: '☠️',
  },
  decoy: {
    id: 'decoy', nameEn: 'DECOY GRENADE', nameZh: '诱饵弹',
    descriptionEn: 'Creates a holographic decoy that draws enemy attention.',
    descriptionZh: '生成全息诱饵吸引敌人火力。',
    category: 'throwable', maxAmmo: 3, respawnTime: 14,
    throwSpeed: 14, gravity: 18, effectDuration: 15, color: 0xff6600, icon: '',
  },
  repair_field: {
    id: 'repair_field', nameEn: 'REPAIR FIELD', nameZh: '修复场',
    descriptionEn: 'Deploy a field that repairs armor and gadgets.',
    descriptionZh: '部署修复场持续恢复护甲。',
    category: 'placeable', maxAmmo: 2, respawnTime: 20,
    effectDuration: 15, healAmount: 200, effectRadius: 5, color: 0x00ffaa, icon: '',
  },
  adrenaline_shot: {
    id: 'adrenaline_shot', nameEn: 'ADRENALINE SHOT', nameZh: '肾上腺素',
    descriptionEn: 'Boosts movement speed by 50% for 5 seconds.',
    descriptionZh: '5秒内提升50%移动速度。',
    category: 'instant', maxAmmo: 2, respawnTime: 20,
    effectDuration: 5, color: 0xff0066, icon: '⚡',
  },
  defibrillator: {
    id: 'defibrillator', nameEn: 'DEFIBRILLATOR', nameZh: '除颤器',
    descriptionEn: 'Revive downed allies (in team mode). Single use.',
    descriptionZh: '复活倒下的队友（团队模式）。一次性使用。',
    category: 'instant', maxAmmo: 1, respawnTime: 30,
    color: 0x0088ff, icon: '❤️🔥',
  },
  fireball: {
    id: 'fireball', nameEn: 'FIREBALL', nameZh: '火球',
    descriptionEn: 'Launch a fireball that creates a burning zone for 8 seconds.',
    descriptionZh: '发射火球制造持续8秒的燃烧区域。',
    category: 'throwable', maxAmmo: 2, respawnTime: 16,
    throwSpeed: 16, gravity: 20, effectDuration: 8, effectRadius: 5,
    damage: 15, color: 0xff4400, icon: '🔥',
  },
};

// ==================== ENEMIES ====================
export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  LIGHT_DASH:      { type: 'LIGHT_DASH',      name: 'VIPER DASH BOT',    hp: 150, speed: 7.5, color: 0xee3366, scale: 0.9, damage: 18, attackRange: 3.5,  attackCooldown: 0.9, coinCount: 30, cashValue: 600  },
  MEDIUM_RIFLE:    { type: 'MEDIUM_RIFLE',    name: 'SENTINEL GUNNER',   hp: 260, speed: 5.0, color: 0xd4a373, scale: 1.1, damage: 12, attackRange: 22.0, attackCooldown: 1.2, coinCount: 45, cashValue: 1000 },
  HEAVY_JUGGERNAUT:{ type: 'HEAVY_JUGGERNAUT',name: 'TITAN BREAKER',     hp: 480, speed: 3.2, color: 0x4a5568, scale: 1.5, damage: 35, attackRange: 4.0,  attackCooldown: 1.8, coinCount: 80, cashValue: 2500 },
  GLITCH_DRONE:    { type: 'GLITCH_DRONE',    name: 'CYBER HOVER DRONE', hp: 110, speed: 6.0, color: 0x319795, scale: 0.8, damage: 10, attackRange: 25.0, attackCooldown: 1.5, coinCount: 25, cashValue: 450  },
};

// ==================== UPGRADES ====================
export const INITIAL_UPGRADE_ITEMS: UpgradeItem[] = [
  { id: 'heal', titleEn: 'EMERGENCY REBOOT (+150 HP)', titleZh: '紧急重启恢复 (+150 生命)', descriptionEn: 'Instantly restore 150 health points.', descriptionZh: '立即修复机体并回复150点生命值。', cost: 800, icon: 'Heart', level: 0, maxLevel: 999 },
  { id: 'reloadSpeedMultiplier', titleEn: 'TACTICAL SPEED LOADER', titleZh: '战术速装器 (-25% 换弹时间)', descriptionEn: '-25% tactical reload time for all weapons.', descriptionZh: '降低所有武器25%的战术换弹耗时。', cost: 1200, icon: 'RotateCcw', level: 0, maxLevel: 4 },
  { id: 'skillCooldownReduction', titleEn: 'SPECIALIZATION OVERDRIVE', titleZh: '绝招超频 (-1.5秒 绝招冷却)', descriptionEn: '-1.5s Specialization skill cooldown time.', descriptionZh: '缩短绝招技能（冲撞/护盾/钩爪）1.5秒冷却。', cost: 2000, icon: 'Zap', level: 0, maxLevel: 3 },
  { id: 'magnetRadius', titleEn: 'GOLD COIN SUPER MAGNET', titleZh: '金币超级磁铁 (扩充吸附范围)', descriptionEn: 'Triple the auto-collection range for exploding gold coins.', descriptionZh: '大幅扩充爆金币自动吸引落地的判定半径。', cost: 1000, icon: 'Magnet', level: 0, maxLevel: 3 },
  { id: 'maxHpBonus', titleEn: 'TITAN HEAVY ARMOR (+100 MAX HP)', titleZh: '泰坦重型复合装甲 (+100 上限)', descriptionEn: 'Increase maximum health capacity by +100 and heal to full.', descriptionZh: '提升机体100点生命值上限并补满血量。', cost: 2500, icon: 'Shield', level: 0, maxLevel: 5 },
  { id: 'movementSpeedBonus', titleEn: 'VR ADRENALINE SPRINT (+15% SPEED)', titleZh: '肾上腺素冲刺 (+15% 移动速度)', descriptionEn: '+15% player movement speed & air jump velocity.', descriptionZh: '提升15%移动跑速与跳跃机动性。', cost: 1800, icon: 'Activity', level: 0, maxLevel: 3 },
];

// ==================== DEBUG TUNING ====================
export const DEFAULT_DEBUG_TUNING: DebugTuning = {
  weapons: {
    sa1216:     { maxMagazine: 16,  reloadTime: 2.2, damagePerShot: 14,  fireRate: 0.16, range: 40,  pelletCount: 8,  pelletSpread: 0.065, burstSize: 4,    cylinderRotateDelay: 0.48 },
    lewis:      { maxMagazine: 47,  reloadTime: 3.2, damagePerShot: 28,  fireRate: 0.11, range: 75 },
    flamethrower:{ maxMagazine:100, reloadTime: 2.8, damagePerShot: 8,   fireRate: 0.05, range: 16,  flameRange: 16,  flameConeAngle: 0.38, burnDuration: 2.0 },
    cl40:       { maxMagazine: 4,   reloadTime: 2.5, damagePerShot: 110, fireRate: 0.65, range: 60,  explosionRadius: 4.5 },
    xp54:       { maxMagazine: 30,  reloadTime: 1.8, damagePerShot: 16,  fireRate: 0.07, range: 50 },
    fcar:       { maxMagazine: 30,  reloadTime: 2.2, damagePerShot: 24,  fireRate: 0.09, range: 65 },
    m60:        { maxMagazine: 100, reloadTime: 4.5, damagePerShot: 36,  fireRate: 0.13, range: 85 },
    m11:        { maxMagazine: 18,  reloadTime: 1.6, damagePerShot: 18,  fireRate: 0.08, range: 45,  burstSize: 3,    cylinderRotateDelay: 0.35 },
    pike556:    { maxMagazine: 15,  reloadTime: 2.4, damagePerShot: 72,  fireRate: 0.35, range: 110 },
  },
  skills: {
    charge_slam: { cooldown: 8.0, duration: 2.2, chargeSpeed: 24, chargeDamage: 140, slamDamage: 240, slamRadius: 12 },
    mesh_shield: { cooldown: 6.0, duration: 8.0, shieldHp: 600 },
    winch_claw:  { cooldown: 7.0, pullForce: 35, range: 30 },
  },
  enemies: { spawnBase: 3, spawnPerWave: 2.5, hpMultiplier: 1.35, hpBonusPerWave: 35 },
};
