import * as THREE from 'three';
import { 
  EnemyInstance, EnemyType, CoinParticle, DebrisParticle, 
  CoverObstacle, FloatingText3D, PlayerUpgrades, GameSettings, EnemyHPBar,
  SelectedWeapon, SelectedSkill, FlameParticle, WinchChainParticle, WeaponDebugConfig, SkillDebugConfig
} from './types';
import { ENEMY_CONFIGS, DEFAULT_DEBUG_TUNING, OPTIC_CONFIGS, WEAPON_CONFIGS, GADGET_CONFIGS } from './constants';
import { SelectedOptic, ThrownGadget, ActiveGadgetEffect, GadgetId, GadgetConfig } from './types';
import { soundEngine } from '../utils/sound';

export interface UIStateCallback {
  hp: number;
  maxHp: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadProgress: number; // 0 to 1
  burstCount: number;
  isRotatingCylinder: boolean;
  skillCooldown: number; // 0 if ready
  isCharging: boolean;
  isAiming: boolean;
  isShieldActive: boolean;
  shieldHp: number;
  maxShieldHp: number;
  isClawActive: boolean;
  chargeProgress: number; // 0 to 1
  cashOut: number;
  wave: number;
  enemiesRemaining: number;
  combo: number;
  hitMarker: { active: boolean; isCrit: boolean; isKill: boolean; timestamp: number };
  damageFlash: number; // 0 to 1
  enemyHPBars: EnemyHPBar[];
  selectedWeapon: SelectedWeapon;
  selectedSkill: SelectedSkill;
  killFeed: { active: boolean; id: string; timestamp: number } | null;
  gadgetSlots: (GadgetId | null)[];
  selectedGadgetSlot: number;
  gadgetAmmo: (number | null)[];
  gadgetRespawnTimers: (number | null)[];
}

export class ArenaEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  private animFrameId: number = 0;

  // UI Callback
  private onUIUpdate?: (state: UIStateCallback) => void;
  private uiState: UIStateCallback;
  private lastUIUpdateTime: number = 0;

  // Player state
  private playerPos: THREE.Vector3 = new THREE.Vector3(0, 2, 0);
  private playerVel: THREE.Vector3 = new THREE.Vector3();
  private playerYaw: number = 0;
  private playerPitch: number = 0;
  private isGrounded: boolean = false;
  private maxHp: number = 350;
  private currentHp: number = 350;

  // Input state
  private keys: Record<string, boolean> = {};
  private moveJoystick: { x: number; y: number } = { x: 0, y: 0 };
  private isFiring: boolean = false;
  private isAiming: boolean = false;

  // Selected Weapon & Skill
  private selectedWeapon: SelectedWeapon = 'sa1216';
  private selectedSkill: SelectedSkill = 'charge_slam';
  private selectedOptic: SelectedOptic = 'reddot';

  // Optic view-model mesh (rendered only when ADS, drawn in front of the camera)
  private opticGroup: THREE.Group | null = null;
  // M11 / SA1216-style burst tracking
  private burstCooldownTimer: number = 0;
  // Semi-auto gating: must release trigger between shots.
  private semiArmed: boolean = true;

  // Weapon state
  private ammo: number = 16;
  private burstShotsFired: number = 0;
  private fireCooldownTimer: number = 0;
  private cylinderRotateTimer: number = 0;
  private reloadTimer: number = 0;
  private isReloading: boolean = false;

  // View-model (3D gun & arms)
  private cameraGroup: THREE.Group;
  private gunGroup: THREE.Group;
  private cylinderMesh: THREE.Mesh | null = null;
  private panDrumMesh: THREE.Mesh | null = null;
  private flameNozzleLight: THREE.PointLight | null = null;
  private muzzleFlashLight: THREE.PointLight | null = null;
  private muzzleFlashMesh: THREE.Mesh | null = null;
  private gunRecoilZ: number = 0;
  private gunRecoilPitch: number = 0;
  private gunBobTimer: number = 0;
  private adsProgress: number = 0;

  // Camera recoil system. Values are radians and recover continuously.
  private recoilPitch: number = 0;
  private recoilYaw: number = 0;
  private recoilRoll: number = 0;
  private recoilVelPitch: number = 0;
  private recoilVelYaw: number = 0;
  private recoilVelRoll: number = 0;

  private rightHandGroup: THREE.Group | null = null;
  private leftHandGroup: THREE.Group | null = null;
  private rightForearm: THREE.Mesh | null = null;
  private leftForearm: THREE.Mesh | null = null;

  // Third-person player character body (visible in shield / TP mode)
  private playerBodyGroup: THREE.Group | null = null;
  private playerLegLeft: THREE.Mesh | null = null;
  private playerLegRight: THREE.Mesh | null = null;
  private playerArmLeft: THREE.Group | null = null;
  private playerArmRight: THREE.Group | null = null;
  private playerTorso: THREE.Group | null = null;
  private walkCycle: number = 0;
  // Third-person camera blend: 0 = first person, 1 = full third person
  private thirdPersonProgress: number = 0;

  // Skill state
  private skillCooldownTimer: number = 0;
  // Skill: Charge 'N' Slam
  private isCharging: boolean = false;
  private chargeTimer: number = 0;
  private chargeSpeedMultiplier: number = 1.0;
  private shockwaveMesh: THREE.Mesh | null = null;
  private shockwaveTimer: number = 0;

  // Skill: Mesh Shield
  private isShieldActive: boolean = false;
  private shieldHp: number = 600;
  private maxShieldHp: number = 600;
  private shieldMesh: THREE.Mesh | null = null;
  private shieldDurationTimer: number = 0;

  // Skill: Winch Claw
  private isClawActive: boolean = false;
  private clawChainParticle: WinchChainParticle | null = null;

  // Flame particles
  private flameParticles: FlameParticle[] = [];

  // Screen shake
  private screenShakeIntensity: number = 0;
  private damageFlashTimer: number = 0;
  private killFeed: { active: boolean; id: string; timestamp: number } | null = null;

  // Entities
  private enemies: EnemyInstance[] = [];
  private coins: CoinParticle[] = [];
  private debris: DebrisParticle[] = [];
  private coverObstacles: CoverObstacle[] = [];
  private floatingTexts: FloatingText3D[] = [];
  private enemyHPBars: EnemyHPBar[] = [];
  private enemyProjectiles: { mesh: THREE.Mesh; velocity: THREE.Vector3; damage: number; lifetime: number }[] = [];

  // Wave & Score
  private wave: number = 1;
  private enemiesToSpawnInWave: number = 8;
  private spawnTimer: number = 2.0;
  private cashOutScore: number = 0;
  private comboCount: number = 0;
  private comboTimer: number = 0;
  private totalKills: number = 0;
  private shotsFired: number = 0;
  private shotsHit: number = 0;
  private timeSurvived: number = 0;

  private waveTransitionTimer: number = 0;
  private pendingWaveTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastKillSoundTime: number = 0;

  // Upgrades & Settings
  private upgrades: PlayerUpgrades = {
    reloadSpeedMultiplier: 1.0,
    skillCooldownReduction: 0,
    magnetRadius: 5.0,
    maxHpBonus: 0,
    movementSpeedBonus: 0,
  };

  private settings: GameSettings = {
    sensitivity: 1.0,
    fov: 90,
    volume: 0.7,
    showFps: true,
    screenShake: true,
    language: 'zh',
    cheats: {
      godMode: false,
      infiniteAmmo: false,
      damageMultiplier: 1.0,
      speedMultiplier: 1.0,
      enemySpawnMultiplier: 1.0,
      instantCooldown: false,
    },
    debug: DEFAULT_DEBUG_TUNING,
    gadgetSlots: ['frag_grenade', 'health_shot', 'smoke_grenade', null],
  };

  private isPaused: boolean = false;
  private isGameOver: boolean = false;
  private hitMarkerState = { active: false, isCrit: false, isKill: false, timestamp: 0 };

  // Gadget system
  private thrownGadgets: ThrownGadget[] = [];
  private activeEffects: ActiveGadgetEffect[] = [];
  private selectedGadgetSlot: number = 0;  // 0-3
  private gadgetAmmo: (number | null)[] = [null, null, null, null];
  private gadgetRespawnTimers: (number | null)[] = [null, null, null, null];

  // Shared Geometries & Materials
  private coinGeom: THREE.CylinderGeometry;
  private coinMat: THREE.MeshStandardMaterial;
  private debrisGeom: THREE.BoxGeometry;
  private hitSparkGeom: THREE.SphereGeometry;
  private hitSparkMat: THREE.MeshBasicMaterial;

  constructor(
    container: HTMLElement,
    selectedWeapon: SelectedWeapon = 'sa1216',
    selectedSkill: SelectedSkill = 'charge_slam',
    selectedOptic: SelectedOptic = 'reddot',
    onUIUpdate?: (state: UIStateCallback) => void
  ) {
    this.container = container;
    this.selectedWeapon = selectedWeapon;
    this.selectedSkill = selectedSkill;
    this.selectedOptic = selectedOptic;
    this.onUIUpdate = onUIUpdate;
    this.clock = new THREE.Clock();

    const wConfig = this.getWeaponTuning();
    this.ammo = wConfig.maxMagazine;

    // Init UI State
    this.uiState = {
      hp: this.currentHp,
      maxHp: this.maxHp,
      ammo: this.ammo,
      maxAmmo: wConfig.maxMagazine,
      isReloading: false,
      reloadProgress: 0,
      burstCount: 0,
      isRotatingCylinder: false,
      skillCooldown: 0,
      isCharging: false,
      isAiming: false,
      isShieldActive: false,
      shieldHp: this.shieldHp,
      maxShieldHp: this.maxShieldHp,
      isClawActive: false,
      chargeProgress: 0,
      cashOut: 0,
      wave: 1,
      enemiesRemaining: 8,
      combo: 0,
      hitMarker: { active: false, isCrit: false, isKill: false, timestamp: 0 },
      damageFlash: 0,
      enemyHPBars: [],
      selectedWeapon: this.selectedWeapon,
      selectedSkill: this.selectedSkill,
      killFeed: null,
      gadgetSlots: this.settings.gadgetSlots,
      selectedGadgetSlot: this.selectedGadgetSlot,
      gadgetAmmo: [...this.gadgetAmmo],
      gadgetRespawnTimers: [...this.gadgetRespawnTimers],
    };

    // 1. Setup Three Scene (Realistic, grounded esports arena tone - no harsh blinding light pollution)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x12141c); // Sleek neutral dark arena background
    this.scene.fog = new THREE.FogExp2(0x12141c, 0.012);

    // 2. Setup Camera
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, container.clientWidth / container.clientHeight, 0.1, 200);
    this.cameraGroup = new THREE.Group();
    this.cameraGroup.add(this.camera);
    this.scene.add(this.cameraGroup);

    // 3. Setup Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    // 4. Shared Geometries & Materials
    this.coinGeom = new THREE.CylinderGeometry(0.25, 0.25, 0.06, 12);
    this.coinMat = new THREE.MeshStandardMaterial({
      color: 0xe6b800,
      metalness: 0.85,
      roughness: 0.2,
      transparent: true,
      opacity: 1,
    });
    this.debrisGeom = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    this.hitSparkGeom = new THREE.SphereGeometry(0.12, 6, 6);
    this.hitSparkMat = new THREE.MeshBasicMaterial({ color: 0xffd000 });

    // 5. Build Environment & Gun View Model
    this.setupLights();
    this.buildArena();
    this.gunGroup = new THREE.Group();
    this.buildGunViewModel();

    // 6. Mesh Shield 3D Geometry
    this.setupMeshShield3D();

    // 6b. Build third-person player character body
    this.buildPlayerBody();

    // 7. Bind Events
    this.bindEvents();

    // 8. Initialize gadget ammo
    this.initGadgetAmmo();

    // 9. Start Loop
    this.startWave(1);
    this.animate();
  }

  private getWeaponTuning(): WeaponDebugConfig {
    return this.settings.debug.weapons[this.selectedWeapon];
  }

  private getSkillTuning(): SkillDebugConfig {
    return this.settings.debug.skills[this.selectedSkill];
  }

  private getEnemyTuning() {
    return this.settings.debug.enemies;
  }

  private setupLights() {
    // Soft architectural arena lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff0dd, 1.4);
    dirLight.position.set(30, 50, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 120;
    const d = 40;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    // Warm tactical fill lights
    const warmLight = new THREE.PointLight(0xffd8a8, 60, 40);
    warmLight.position.set(-20, 10, -20);
    this.scene.add(warmLight);

    const coolLight = new THREE.PointLight(0xcce6ff, 60, 40);
    coolLight.position.set(20, 10, 20);
    this.scene.add(coolLight);
  }

  private buildArena() {
    // Realistic dark concrete arena floor
    const floorGeom = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a1d26,
      metalness: 0.3,
      roughness: 0.6,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Subtle tactical arena grid
    const gridHelper = new THREE.GridHelper(100, 50, 0xd4a373, 0x2b3040);
    gridHelper.position.y = 0.02;
    this.scene.add(gridHelper);

    // Outer concrete perimeter walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x252836,
      metalness: 0.5,
      roughness: 0.5,
    });
    const wallGeom = new THREE.BoxGeometry(100, 16, 1);
    
    const northWall = new THREE.Mesh(wallGeom, wallMat);
    northWall.position.set(0, 8, -50);
    this.scene.add(northWall);

    const southWall = northWall.clone();
    southWall.position.set(0, 8, 50);
    this.scene.add(southWall);

    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 100), wallMat);
    eastWall.position.set(50, 8, 0);
    this.scene.add(eastWall);

    const westWall = eastWall.clone();
    westWall.position.set(-50, 8, 0);
    this.scene.add(westWall);

    // Central Cash Out Monument
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 4, 1.2, 16),
      new THREE.MeshStandardMaterial({ color: 0x2c303e, metalness: 0.7, roughness: 0.3 })
    );
    pedestal.position.set(0, 0.6, 0);
    pedestal.receiveShadow = true;
    this.scene.add(pedestal);

    const cashBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.2, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xd4a373, metalness: 0.8, roughness: 0.2 })
    );
    cashBox.position.set(0, 1.8, 0);
    cashBox.castShadow = true;
    this.scene.add(cashBox);

    this.spawnCoverObstacles();
  }

  private spawnCoverObstacles() {
    this.coverObstacles.forEach(o => this.scene.remove(o.mesh));
    this.coverObstacles = [];

    const positions = [
      [-12, -12], [12, -12], [-12, 12], [12, 12],
      [-24, -5], [24, -5], [-24, 15], [24, 15],
      [0, -18], [-8, -25], [8, -25], [-18, -32], [18, -32],
      [-30, -20], [30, -20], [-30, 25], [30, 25],
      [-6, 22], [6, 22], [0, 32], [-18, 5], [18, 5]
    ];

    positions.forEach(([x, z], idx) => {
      const width = 3 + Math.random() * 2.5;
      const height = 2.4 + Math.random() * 1.5;
      const depth = 1.2;

      const geom = new THREE.BoxGeometry(width, height, depth);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x282c3a,
        metalness: 0.6,
        roughness: 0.4,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, height / 2, z);
      mesh.rotation.y = (idx % 3) * 0.5;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      const box = new THREE.Box3().setFromObject(mesh);
      this.coverObstacles.push({
        id: `cover-${idx}`,
        mesh,
        boundingBox: box,
        hp: 180,
        maxHp: 180,
        isDestructible: true,
        color: 0xd4a373,
      });
    });
  }

  private buildGunViewModel() {
    if (this.gunGroup) {
      this.camera.remove(this.gunGroup);
    }
    this.gunGroup = new THREE.Group();
    this.gunGroup.position.set(0.35, -0.32, -0.65);
    this.camera.add(this.gunGroup);

    // Materials
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1f222e, metalness: 0.8, roughness: 0.25 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x3d4254, metalness: 0.9, roughness: 0.2 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, metalness: 0.8, roughness: 0.3 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc8956c, metalness: 0.05, roughness: 0.75 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x282a36, metalness: 0.2, roughness: 0.7 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x181a24, metalness: 0.1, roughness: 0.8 });

    if (this.selectedWeapon === 'sa1216') {
      // ===== SA1216 ROTATING SHOTGUN =====
      const bodyGeom = new THREE.BoxGeometry(0.12, 0.16, 0.55);
      const body = new THREE.Mesh(bodyGeom, darkMat);
      this.gunGroup.add(body);

      const accent = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.04, 0.35), goldMat);
      accent.position.set(0, 0.065, -0.05);
      this.gunGroup.add(accent);

      const cylGroup = new THREE.Group();
      cylGroup.position.set(0, -0.04, 0.02);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 16), steelMat);
      drum.rotation.x = Math.PI / 2;
      cylGroup.add(drum);

      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.23, 8), goldMat);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(Math.cos(angle) * 0.045, Math.sin(angle) * 0.045, 0);
        cylGroup.add(tube);
      }
      this.gunGroup.add(cylGroup);
      this.cylinderMesh = drum;

      const barrelGeom = new THREE.CylinderGeometry(0.028, 0.028, 0.45, 12);
      const b1 = new THREE.Mesh(barrelGeom, darkMat);
      b1.rotation.x = Math.PI / 2;
      b1.position.set(-0.03, 0.03, -0.45);
      this.gunGroup.add(b1);

      const b2 = b1.clone();
      b2.position.set(0.03, 0.03, -0.45);
      this.gunGroup.add(b2);

    } else if (this.selectedWeapon === 'lewis') {
      // ===== LEWIS MACHINE GUN =====
      const bodyGeom = new THREE.BoxGeometry(0.13, 0.18, 0.72);
      const body = new THREE.Mesh(bodyGeom, darkMat);
      this.gunGroup.add(body);

      // Large cooling shroud barrel casing
      const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.6, 16), steelMat);
      shroud.rotation.x = Math.PI / 2;
      shroud.position.set(0, 0.02, -0.5);
      this.gunGroup.add(shroud);

      // Authentic Circular Pan Drum Magazine (mounted flat on top)
      const panDrumGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 24);
      const panDrum = new THREE.Mesh(panDrumGeom, steelMat);
      panDrum.position.set(0, 0.13, -0.05);
      this.gunGroup.add(panDrum);
      this.panDrumMesh = panDrum;

      // Rear spade grip / tactical stock
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.25), darkMat);
      stock.position.set(0, -0.02, 0.3);
      this.gunGroup.add(stock);

    } else if (this.selectedWeapon === 'flamethrower') {
      // ===== FLAMETHROWER =====
      const bodyGeom = new THREE.BoxGeometry(0.14, 0.18, 0.65);
      const body = new THREE.Mesh(bodyGeom, darkMat);
      this.gunGroup.add(body);

      // Dual fuel pressure tanks
      const tankGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.45, 12);
      const tankMat = new THREE.MeshStandardMaterial({ color: 0xcc4422, metalness: 0.6, roughness: 0.3 });
      const tank1 = new THREE.Mesh(tankGeom, tankMat);
      tank1.rotation.x = Math.PI / 2;
      tank1.position.set(-0.08, -0.08, -0.1);
      this.gunGroup.add(tank1);

      const tank2 = tank1.clone();
      tank2.position.set(0.08, -0.08, -0.1);
      this.gunGroup.add(tank2);

      // Flame nozzle tip
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.25, 12), steelMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(0, 0.02, -0.52);
      this.gunGroup.add(nozzle);

      // Flame pilot light glow
      this.flameNozzleLight = new THREE.PointLight(0xff5500, 0, 8);
      this.flameNozzleLight.position.set(0, 0.02, -0.65);
      this.gunGroup.add(this.flameNozzleLight);
    } else if (this.selectedWeapon === 'cl40') {
      // ===== CL-40 GRENADE LAUNCHER =====
      const bodyGeom = new THREE.BoxGeometry(0.12, 0.18, 0.6);
      const body = new THREE.Mesh(bodyGeom, darkMat);
      this.gunGroup.add(body);

      // Large 40mm barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 16), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.04, -0.35);
      this.gunGroup.add(barrel);

      // Pump-action tube under barrel
      const pumpTube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 12), darkMat);
      pumpTube.rotation.x = Math.PI / 2;
      pumpTube.position.set(0, -0.05, -0.3);
      this.gunGroup.add(pumpTube);

      // Iron sight rear and front post
      const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.04), steelMat);
      rearSight.position.set(0, 0.12, 0.1);
      this.gunGroup.add(rearSight);

      const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.05, 0.02), goldMat);
      frontSight.position.set(0, 0.09, -0.55);
      this.gunGroup.add(frontSight);
    } else if (this.selectedWeapon === 'xp54') {
      // ===== XP-54 SUPPRESSED SMG =====
      const bodyGeom = new THREE.BoxGeometry(0.1, 0.14, 0.45);
      const body = new THREE.Mesh(bodyGeom, darkMat);
      this.gunGroup.add(body);

      // Suppressor / Silencer
      const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 16), steelMat);
      silencer.rotation.x = Math.PI / 2;
      silencer.position.set(0, 0.02, -0.4);
      this.gunGroup.add(silencer);

      // Custom reflex red-dot optic
      const opticBase = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.12), darkMat);
      opticBase.position.set(0, 0.09, -0.05);
      this.gunGroup.add(opticBase);

      const redDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.008, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff0033 })
      );
      redDot.position.set(0, 0.11, -0.05);
      this.gunGroup.add(redDot);

      // Tactical stick magazine
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.06), steelMat);
      mag.position.set(0, -0.15, -0.05);
      mag.rotation.x = 0.1;
      this.gunGroup.add(mag);
    } else if (this.selectedWeapon === 'fcar') {
      // ===== FCAR ASSAULT RIFLE =====
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.55), darkMat);
      this.gunGroup.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 12), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.025, -0.5);
      this.gunGroup.add(barrel);
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.32), steelMat);
      handguard.position.set(0, 0.025, -0.35);
      this.gunGroup.add(handguard);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.08), steelMat);
      mag.position.set(0, -0.16, -0.05);
      mag.rotation.x = 0.08;
      this.gunGroup.add(mag);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.22), darkMat);
      stock.position.set(0, -0.02, 0.32);
      this.gunGroup.add(stock);
    } else if (this.selectedWeapon === 'm60') {
      // ===== M60 GPMG =====
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.85), darkMat);
      this.gunGroup.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 12), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.03, -0.55);
      this.gunGroup.add(barrel);
      // Bipod (folded)
      const bipod1 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.12, 0.015), steelMat);
      bipod1.position.set(-0.04, -0.04, -0.4);
      bipod1.rotation.x = 0.3;
      this.gunGroup.add(bipod1);
      const bipod2 = bipod1.clone();
      bipod2.position.set(0.04, -0.04, -0.4);
      this.gunGroup.add(bipod2);
      // Belt box on left side
      const beltBox = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.12), steelMat);
      beltBox.position.set(-0.14, -0.08, -0.05);
      this.gunGroup.add(beltBox);
      // Rear spade grip
      const spade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.04), darkMat);
      spade.position.set(0, 0.0, 0.42);
      this.gunGroup.add(spade);
    } else if (this.selectedWeapon === 'm11') {
      // ===== M11 BURST PISTOL =====
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.10, 0.22), darkMat);
      this.gunGroup.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 10), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.18);
      this.gunGroup.add(barrel);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.08), darkMat);
      grip.position.set(0, -0.10, 0.04);
      grip.rotation.x = 0.2;
      this.gunGroup.add(grip);
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.035, 0.20), steelMat);
      slide.position.set(0, 0.055, -0.06);
      this.gunGroup.add(slide);
    } else if (this.selectedWeapon === 'pike556') {
      // ===== PIKE-556 DMR =====
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.13, 0.78), darkMat);
      this.gunGroup.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.7, 12), steelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.55);
      this.gunGroup.add(barrel);
      const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12), steelMat);
      muzzleBrake.rotation.x = Math.PI / 2;
      muzzleBrake.position.set(0, 0.02, -0.9);
      this.gunGroup.add(muzzleBrake);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.07), steelMat);
      mag.position.set(0, -0.14, -0.05);
      mag.rotation.x = 0.06;
      this.gunGroup.add(mag);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.28), darkMat);
      stock.position.set(0, -0.02, 0.38);
      this.gunGroup.add(stock);
    }

    // Build optic view-model based on selected optic
    this.buildOpticViewModel();

    // Muzzle Flash Light & Mesh
    this.muzzleFlashLight = new THREE.PointLight(0xffd000, 0, 10);
    this.muzzleFlashLight.position.set(0, 0.03, -0.75);
    this.gunGroup.add(this.muzzleFlashLight);

    const flashGeom = new THREE.ConeGeometry(0.18, 0.35, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0 });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeom, flashMat);
    this.muzzleFlashMesh.rotation.x = -Math.PI / 2;
    this.muzzleFlashMesh.position.set(0, 0.03, -0.85);
    this.gunGroup.add(this.muzzleFlashMesh);

    // ===== FIRST-PERSON HANDS & ARMS =====
    this.rightHandGroup = new THREE.Group();
    const rPalm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.08), gloveMat);
    this.rightHandGroup.add(rPalm);

    const fingerGeom = new THREE.CylinderGeometry(0.012, 0.011, 0.07, 6);
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(fingerGeom, gloveMat);
      finger.rotation.x = Math.PI / 2;
      finger.position.set(0, -0.04 + i * 0.025, -0.05);
      this.rightHandGroup.add(finger);
    }

    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.01, 0.06, 6), skinMat);
    thumb.rotation.z = Math.PI / 3;
    thumb.position.set(0.055, 0.02, -0.02);
    this.rightHandGroup.add(thumb);

    const rWrist = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.05, 8), skinMat);
    rWrist.rotation.x = Math.PI / 2;
    rWrist.position.set(0, -0.09, 0.05);
    this.rightHandGroup.add(rWrist);

    const rForearmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.12), sleeveMat);
    rForearmMesh.position.set(0, -0.34, 0.06);
    this.rightHandGroup.add(rForearmMesh);
    this.rightForearm = rForearmMesh;

    this.rightHandGroup.position.set(0.12, -0.06, 0.08);
    this.gunGroup.add(this.rightHandGroup);

    // Left hand
    this.leftHandGroup = new THREE.Group();
    const lPalm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), gloveMat);
    lPalm.rotation.x = 0.3;
    this.leftHandGroup.add(lPalm);

    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(fingerGeom.clone(), gloveMat);
      finger.rotation.z = Math.PI / 2;
      finger.position.set(0.07, -0.02, -0.04 + i * 0.025);
      this.leftHandGroup.add(finger);
    }

    const lThumb = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.011, 0.07, 6), skinMat);
    lThumb.rotation.z = -Math.PI / 4;
    lThumb.position.set(0.065, 0.03, -0.01);
    this.leftHandGroup.add(lThumb);

    const lWrist = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.05, 8), skinMat);
    lWrist.rotation.x = Math.PI / 2;
    lWrist.position.set(0.02, -0.06, 0.04);
    this.leftHandGroup.add(lWrist);

    const lForearmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.12), sleeveMat);
    lForearmMesh.position.set(0.02, -0.32, 0.05);
    lForearmMesh.rotation.x = 0.15;
    this.leftHandGroup.add(lForearmMesh);
    this.leftForearm = lForearmMesh;

    this.leftHandGroup.position.set(-0.1, -0.02, -0.35);
    this.gunGroup.add(this.leftHandGroup);
  }

  private buildOpticViewModel() {
    if (this.opticGroup) {
      this.camera.remove(this.opticGroup);
      this.opticGroup = null;
    }
    const opticId = this.selectedOptic;
    const group = new THREE.Group();
    // Positioned close to camera so it reads as a sight picture overlay
    group.position.set(0, -0.02, -0.32);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x181a24, metalness: 0.85, roughness: 0.25 });
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x319795, transparent: true, opacity: 0.08, side: THREE.DoubleSide });

    if (opticId === 'iron') {
      // Minimal — no added sight housing, just a small notch visible at top
      const notch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.02), metalMat);
      notch.position.set(0, 0.04, 0);
      group.add(notch);
    } else if (opticId === 'reddot') {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.09), metalMat);
      group.add(housing);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.05), glassMat);
      glass.position.set(0, 0, -0.046);
      group.add(glass);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.004, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff2030 })
      );
      dot.position.set(0, 0, -0.048);
      group.add(dot);
    } else if (opticId === 'holo') {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.09, 0.10), metalMat);
      group.add(housing);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.07), glassMat);
      glass.position.set(0, 0, -0.051);
      group.add(glass);
      // Circular reticle
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.012, 0.014, 20),
        new THREE.MeshBasicMaterial({ color: 0x66ffaa, side: THREE.DoubleSide })
      );
      ring.position.set(0, 0, -0.052);
      group.add(ring);
      const pip = new THREE.Mesh(
        new THREE.SphereGeometry(0.003, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x66ffaa })
      );
      pip.position.set(0, 0, -0.052);
      group.add(pip);
    } else if (opticId === 'acog') {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.20, 16), metalMat);
      tube.rotation.x = Math.PI / 2;
      group.add(tube);
      // Crosshair drawn inside
      const crossMat = new THREE.MeshBasicMaterial({ color: 0xffd000 });
      const hbar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.0015, 0.001), crossMat);
      hbar.position.set(0, 0, -0.101);
      group.add(hbar);
      const vbar = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.06, 0.001), crossMat);
      vbar.position.set(0, 0, -0.101);
      group.add(vbar);
    } else if (opticId === 'scope4x') {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.28, 16), metalMat);
      tube.rotation.x = Math.PI / 2;
      group.add(tube);
      const scopeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      // Mil-dot reticle: horizontal + vertical + 4 dots
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.0012, 0.001), scopeMat);
      h.position.set(0, 0, -0.141);
      group.add(h);
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.08, 0.001), scopeMat);
      v.position.set(0, 0, -0.141);
      group.add(v);
      for (const dy of [-0.02, 0.02]) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.002, 6, 6), scopeMat);
        dot.position.set(0, dy, -0.141);
        group.add(dot);
      }
      for (const dx of [-0.02, 0.02]) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.002, 6, 6), scopeMat);
        dot.position.set(dx, 0, -0.141);
        group.add(dot);
      }
    }

    // Initially hidden until ADS progresses
    group.visible = false;
    this.camera.add(group);
    this.opticGroup = group;
  }

  private setupMeshShield3D() {
    // Holographic Mesh Shield: a curved grid barrier (THE FINALS style)
    const shieldGeom = new THREE.CylinderGeometry(2.6, 2.6, 3.2, 24, 6, true, -Math.PI / 3, (Math.PI * 2) / 3);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x3fd8e8,
      emissive: 0x1fb8d0,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      wireframe: true,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeom, shieldMat);
    this.shieldMesh.position.set(0, 2, 0);
    this.shieldMesh.visible = false;
    // World-space shield so it reads correctly in third-person shield mode
    this.scene.add(this.shieldMesh);
  }

  // Keep the world-space shield planted in front of the player, upright.
  private updateShieldTransform() {
    if (!this.shieldMesh) return;
    const forward = new THREE.Vector3(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
    const shieldPos = this.playerPos.clone().addScaledVector(forward, 1.2);
    shieldPos.y = this.playerPos.y - 0.3;
    this.shieldMesh.position.copy(shieldPos);
    // Orient curved arc so it bulges toward the aim direction
    this.shieldMesh.rotation.set(0, this.playerYaw + Math.PI / 2, 0);
    // Gentle shimmer
    const mat = this.shieldMesh.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.22 + Math.sin(performance.now() * 0.004) * 0.06;
  }

  // Position & animate the third-person contestant body.
  private updatePlayerBody(dt: number, tp: number) {
    if (!this.playerBodyGroup) return;
    this.playerBodyGroup.visible = tp > 0.02;
    if (tp <= 0.02) return;

    // Feet are at playerPos.y - eyeHeight. Player eye is ~2, model is ~1.9 tall.
    const footY = this.playerPos.y - 1.9;
    this.playerBodyGroup.position.set(this.playerPos.x, footY, this.playerPos.z);
    // Body faces the aim yaw
    this.playerBodyGroup.rotation.y = this.playerYaw;

    // Walk animation when moving on ground
    const moving = this.isGrounded && (Math.abs(this.playerVel.x) + Math.abs(this.playerVel.z) > 1.5);
    if (moving) {
      this.walkCycle += dt * 9;
    } else {
      this.walkCycle *= 0.85;
    }
    const swing = Math.sin(this.walkCycle) * (moving ? 0.6 : 0);
    if (this.playerLegLeft) this.playerLegLeft.rotation.x = swing;
    if (this.playerLegRight) this.playerLegRight.rotation.x = -swing;

    // Torso leans with pitch a bit
    if (this.playerTorso) {
      this.playerTorso.rotation.x = this.playerPitch * 0.15;
    }
    // Slight breathing/idle on arms
    if (this.playerArmRight) this.playerArmRight.rotation.x = 0.5 + Math.sin(performance.now() * 0.002) * 0.03;
    if (this.playerArmLeft) this.playerArmLeft.rotation.x = 0.7 + Math.sin(performance.now() * 0.002) * 0.03;
  }

  // Build a third-person contestant body model (THE FINALS-style Heavy silhouette)
  private buildPlayerBody() {
    const group = new THREE.Group();

    // Class color accent based on weapon class
    const wClass = WEAPON_CONFIGS[this.selectedWeapon].weaponClass;
    const accent = wClass === 'H' ? 0xee3366 : wClass === 'M' ? 0xd4a373 : 0x18c7dc;

    const suitMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3d, metalness: 0.4, roughness: 0.6 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x3d4453, metalness: 0.6, roughness: 0.4 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.3, metalness: 0.5, roughness: 0.4 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc8956c, metalness: 0.05, roughness: 0.8 });

    // ===== TORSO (with slight lean) =====
    const torso = new THREE.Group();
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.4), armorMat);
    chest.position.y = 1.35;
    chest.castShadow = true;
    torso.add(chest);

    // Chest accent stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 0.42), accentMat);
    stripe.position.y = 1.5;
    torso.add(stripe);

    // Abdomen
    const abdomen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.34), suitMat);
    abdomen.position.y = 0.95;
    abdomen.castShadow = true;
    torso.add(abdomen);

    // ===== HEAD (with visor) =====
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), armorMat);
    head.position.y = 1.86;
    head.castShadow = true;
    torso.add(head);
    // Visor
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.05), accentMat);
    visor.position.set(0, 1.88, 0.16);
    torso.add(visor);

    group.add(torso);
    this.playerTorso = torso;

    // ===== ARMS (holding weapon forward) =====
    // Right arm
    const armR = new THREE.Group();
    const upperArmR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), suitMat);
    upperArmR.position.set(0, -0.2, 0);
    upperArmR.castShadow = true;
    armR.add(upperArmR);
    const foreArmR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.14), skinMat);
    foreArmR.position.set(0, -0.5, 0.12);
    foreArmR.rotation.x = -0.7;
    armR.add(foreArmR);
    armR.position.set(0.4, 1.55, 0.05);
    armR.rotation.x = 0.5;
    group.add(armR);
    this.playerArmRight = armR;

    // Left arm
    const armL = new THREE.Group();
    const upperArmL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), suitMat);
    upperArmL.position.set(0, -0.2, 0);
    upperArmL.castShadow = true;
    armL.add(upperArmL);
    const foreArmL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.14), skinMat);
    foreArmL.position.set(0, -0.5, 0.14);
    foreArmL.rotation.x = -0.9;
    armL.add(foreArmL);
    armL.position.set(-0.4, 1.55, 0.05);
    armL.rotation.x = 0.7;
    group.add(armL);
    this.playerArmLeft = armL;

    // ===== A simple weapon prop in TP hands =====
    const tpWeapon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1c24, metalness: 0.7, roughness: 0.3 }));
    tpWeapon.position.set(0.25, 1.35, 0.45);
    group.add(tpWeapon);

    // ===== LEGS =====
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 0.22), suitMat);
    legL.position.set(-0.16, 0.45, 0);
    legL.castShadow = true;
    group.add(legL);
    this.playerLegLeft = legL;

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 0.22), suitMat);
    legR.position.set(0.16, 0.45, 0);
    legR.castShadow = true;
    group.add(legR);
    this.playerLegRight = legR;

    // Boots
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.3), armorMat);
    bootL.position.set(-0.16, 0.05, 0.04);
    group.add(bootL);
    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.3), armorMat);
    bootR.position.set(0.16, 0.05, 0.04);
    group.add(bootR);

    group.visible = false;
    this.scene.add(group);
    this.playerBodyGroup = group;
  }

  private bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (this.isPaused || this.isGameOver) return;
      const key = e.key.toLowerCase();
      this.keys[key] = true;

      if (key === ' ' && this.isGrounded) {
        this.playerVel.y = 10.5 * (1 + this.upgrades.movementSpeedBonus * 0.5) * this.settings.cheats.speedMultiplier;
        this.isGrounded = false;
      }
      if (key === 'r') {
        this.initiateReload();
      }
      if (key === 'q') {
        this.triggerSpecializationSkill();
      }
      // Gadget slot selection (1-4)
      if (['1', '2', '3', '4'].includes(key)) {
        this.selectGadgetSlot(parseInt(key) - 1);
      }
      // Throw/use gadget (G or T)
      if (key === 'g' || key === 't') {
        this.useGadget();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    this.renderer.domElement.addEventListener('click', () => {
      if (!this.isPaused && !this.isGameOver && document.pointerLockElement !== this.renderer.domElement) {
        this.renderer.domElement.requestPointerLock();
      }
    });

    this.renderer.domElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.renderer.domElement && !this.isPaused && !this.isGameOver) {
        const sens = 0.0022 * this.settings.sensitivity * (this.isAiming ? 0.55 : 1);
        this.playerYaw -= e.movementX * sens;
        this.playerPitch -= e.movementY * sens;
        this.playerPitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.playerPitch));
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (this.isPaused || this.isGameOver) return;
      if (document.pointerLockElement === this.renderer.domElement) {
        if (e.button === 0) this.isFiring = true;
        if (e.button === 2) {
          e.preventDefault();
          this.isAiming = true;
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isFiring = false;
      if (e.button === 2) this.isAiming = false;
    });

    window.addEventListener('resize', () => {
      if (!this.container) return;
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    });
  }

  public setJoystickInput(x: number, y: number) {
    this.moveJoystick = { x, y };
  }

  public setFiring(firing: boolean) {
    this.isFiring = firing;
  }

  public triggerChargeOrSlam() {
    this.triggerSpecializationSkill();
  }

  public triggerSpecializationSkill() {
    if (this.isPaused || this.isGameOver) return;

    if (this.selectedSkill === 'charge_slam') {
      if (this.isCharging || (!this.isGrounded && (this.skillCooldownTimer <= 0 || this.settings.cheats.instantCooldown))) {
        this.executeSlam();
        return;
      }
      if (this.skillCooldownTimer <= 0 || this.settings.cheats.instantCooldown) {
        this.initiateCharge();
      }
    } else if (this.selectedSkill === 'mesh_shield') {
      if (this.isShieldActive) {
        // Toggle shield off
        this.isShieldActive = false;
        if (this.shieldMesh) this.shieldMesh.visible = false;
      } else if (this.skillCooldownTimer <= 0 || this.settings.cheats.instantCooldown) {
        // Activate Mesh Shield
        const skillConfig = this.getSkillTuning();
        this.isShieldActive = true;
        this.shieldHp = skillConfig.shieldHp || 600;
        this.shieldDurationTimer = skillConfig.duration || 8.0;
        if (this.shieldMesh) this.shieldMesh.visible = true;
        soundEngine.playMeshShield();
        this.skillCooldownTimer = this.settings.cheats.instantCooldown ? 0 : Math.max(1.0, skillConfig.cooldown - this.upgrades.skillCooldownReduction);
      }
    } else if (this.selectedSkill === 'winch_claw') {
      if (this.skillCooldownTimer <= 0 || this.settings.cheats.instantCooldown) {
        this.executeWinchClaw();
      }
    }
  }

  private initiateCharge() {
    this.isCharging = true;
    const skillConfig = this.getSkillTuning();
    this.chargeTimer = skillConfig.duration || 2.2;
    this.chargeSpeedMultiplier = (skillConfig.chargeSpeed || 24) / 24;
    this.skillCooldownTimer = this.settings.cheats.instantCooldown ? 0 : Math.max(1.0, skillConfig.cooldown - this.upgrades.skillCooldownReduction);
    
    this.camera.fov = Math.min(120, this.settings.fov + 22);
    this.camera.updateProjectionMatrix();

    soundEngine.playCharge();
  }

  private executeSlam() {
    if (!this.isCharging && this.isGrounded) return;

    this.isCharging = false;
    this.chargeSpeedMultiplier = 1.0;
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();

    if (this.skillCooldownTimer <= 0) {
      const skillConfig = this.getSkillTuning();
      this.skillCooldownTimer = this.settings.cheats.instantCooldown ? 0 : Math.max(1.0, skillConfig.cooldown - this.upgrades.skillCooldownReduction);
    }

    soundEngine.playSlam();
    this.triggerScreenShake(25);

    if (!this.shockwaveMesh) {
      const ringGeom = new THREE.RingGeometry(0.5, 3.5, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xd4a373, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
      this.shockwaveMesh = new THREE.Mesh(ringGeom, ringMat);
      this.shockwaveMesh.rotation.x = -Math.PI / 2;
      this.scene.add(this.shockwaveMesh);
    }
    this.shockwaveMesh.position.copy(this.playerPos);
    this.shockwaveMesh.position.y = 0.1;
    this.shockwaveMesh.scale.set(1, 1, 1);
    (this.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
    this.shockwaveMesh.visible = true;
    this.shockwaveTimer = 0.6;

    const skillConfig = this.getSkillTuning();
    const slamRadius = skillConfig.slamRadius || 12;
    this.enemies.forEach(enemy => {
      const dist = enemy.mesh.position.distanceTo(this.playerPos);
      if (dist <= slamRadius) {
        const damage = Math.round((skillConfig.slamDamage || 240) * (1 - dist / (slamRadius * 1.5)) * this.settings.cheats.damageMultiplier);
        this.damageEnemy(enemy, damage, false, new THREE.Vector3(0, 1, 0));
        enemy.velocity.y = 14;
        enemy.isStunned = true;
        enemy.stunTimer = 1.6;
      }
    });

    this.coverObstacles.forEach(cover => {
      if (cover.mesh.position.distanceTo(this.playerPos) <= slamRadius) {
        this.destroyCover(cover, new THREE.Vector3(0, 1, 0));
      }
    });
  }

  private executeWinchClaw() {
    this.isClawActive = true;
    soundEngine.playWinchClaw();

    const skillConfig = this.getSkillTuning();
    this.skillCooldownTimer = this.settings.cheats.instantCooldown ? 0 : Math.max(1.0, skillConfig.cooldown - this.upgrades.skillCooldownReduction);

    const raycaster = new THREE.Raycaster();
    const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    raycaster.set(this.cameraGroup.position, cameraDir);

    const enemyMeshes = this.enemies.map(e => e.mesh);
    const intersects = raycaster.intersectObjects(enemyMeshes, true);

    let targetPoint = this.playerPos.clone().addScaledVector(cameraDir, 30);

    if (intersects.length > 0) {
      const hit = intersects[0];
      targetPoint = hit.point.clone();

      const hitEnemy = this.enemies.find(e => {
        let curr: THREE.Object3D | null = hit.object;
        while (curr) {
          if (curr === e.mesh) return true;
          curr = curr.parent;
        }
        return false;
      });

      if (hitEnemy) {
        // Pull enemy directly to player!
        const pullDir = this.playerPos.clone().sub(hitEnemy.mesh.position).normalize();
        hitEnemy.velocity.copy(pullDir.multiplyScalar(skillConfig.pullForce || 35));
        hitEnemy.velocity.y = 8;
        hitEnemy.isStunned = true;
        hitEnemy.stunTimer = 1.2;
        this.damageEnemy(hitEnemy, Math.round(60 * this.settings.cheats.damageMultiplier), false, pullDir);
      }
    } else {
      // Pull player forward towards target wall / point
      this.playerVel.addScaledVector(cameraDir, 25);
      this.playerVel.y = 6;
    }

    // Spawn 3D winch chain line
    const chainGeom = new THREE.BufferGeometry().setFromPoints([
      this.playerPos.clone().add(new THREE.Vector3(0.3, -0.3, -0.5).applyQuaternion(this.camera.quaternion)),
      targetPoint
    ]);
    const chainMat = new THREE.LineBasicMaterial({ color: 0xd4a373, linewidth: 3 });
    const chainLine = new THREE.Line(chainGeom, chainMat);
    this.scene.add(chainLine);

    this.clawChainParticle = {
      mesh: chainLine,
      startPos: this.playerPos.clone(),
      endPos: targetPoint,
      lifetime: 0.35,
    };
  }

  public initiateReload() {
    const wConfig = this.getWeaponTuning();
    if (this.isReloading || this.ammo === wConfig.maxMagazine || this.cylinderRotateTimer > 0) return;
    this.isReloading = true;
    const speedMult = this.upgrades.reloadSpeedMultiplier;
    this.reloadTimer = wConfig.reloadTime / speedMult;
    soundEngine.playCylinderRotate();
  }

  public startWave(waveNum: number) {
    this.wave = waveNum;
    const spawnMult = this.settings.cheats.enemySpawnMultiplier;
    const enemyTuning = this.getEnemyTuning();
    this.enemiesToSpawnInWave = Math.round((enemyTuning.spawnBase + waveNum * enemyTuning.spawnPerWave) * spawnMult);
    this.spawnTimer = 1.0;
    soundEngine.playUI();
    const lang = this.settings.language;
    this.spawnFloatingText(
      lang === 'zh' ? `第 ${waveNum} 虚拟局` : `VIRTUAL WAVE ${waveNum}`,
      new THREE.Vector3(0, 8, -15),
      "#d4a373",
      true,
      2.5
    );
  }

  private spawnEnemy() {
    if (this.enemiesToSpawnInWave <= 0) return;
    this.enemiesToSpawnInWave--;

    const types: EnemyType[] = ['LIGHT_DASH', 'MEDIUM_RIFLE'];
    if (this.wave >= 2) types.push('GLITCH_DRONE');
    if (this.wave >= 3) types.push('HEAVY_JUGGERNAUT');
    const type = types[Math.floor(Math.random() * types.length)];
    const config = ENEMY_CONFIGS[type];

    const corners = [
      new THREE.Vector3(-38, 2, -38),
      new THREE.Vector3(38, 2, -38),
      new THREE.Vector3(-38, 2, 38),
      new THREE.Vector3(38, 2, 38),
    ];
    const spawnPos = corners[Math.floor(Math.random() * corners.length)].clone();

    const enemyGroup = new THREE.Group();
    enemyGroup.position.copy(spawnPos);

    const bodyGeom = new THREE.BoxGeometry(1.2 * config.scale, 2.2 * config.scale, 1.2 * config.scale);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x242836,
      emissive: config.color,
      emissiveIntensity: 0.25,
      metalness: 0.7,
      roughness: 0.3,
    });
    const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    bodyMesh.position.y = 1.1 * config.scale;
    bodyMesh.castShadow = true;
    enemyGroup.add(bodyMesh);

    const headGeom = new THREE.BoxGeometry(0.8 * config.scale, 0.6 * config.scale, 0.85 * config.scale);
    const headMat = new THREE.MeshBasicMaterial({ color: config.color });
    const headMesh = new THREE.Mesh(headGeom, headMat);
    headMesh.position.set(0, 2.5 * config.scale, 0.1);
    enemyGroup.add(headMesh);

    this.scene.add(enemyGroup);

    const enemyTuning = this.getEnemyTuning();
    const hpScale = enemyTuning.hpMultiplier + (this.wave - 1) * 0.08;
    const hpBonus = (this.wave - 1) * enemyTuning.hpBonusPerWave;
    this.enemies.push({
      id: `enemy-${Math.random()}`,
      config,
      mesh: enemyGroup,
      hp: Math.round(config.hp * hpScale + hpBonus),
      maxHp: Math.round(config.hp * hpScale + hpBonus),
      velocity: new THREE.Vector3(),
      attackTimer: Math.random() * 1.5,
      isStunned: false,
      stunTimer: 0,
      hitFlashTimer: 0,
      hpBarTimer: 0,
      targetPos: this.playerPos.clone(),
    });
  }

  private updateWeapon(dt: number) {
    const wConfig = this.getWeaponTuning();
    if (this.fireCooldownTimer > 0) this.fireCooldownTimer -= dt;
    if (this.cylinderRotateTimer > 0) {
      this.cylinderRotateTimer -= dt;
      if (this.cylinderMesh) {
        this.cylinderMesh.rotation.z += dt * 15;
      }
      if (this.cylinderRotateTimer <= 0) {
        this.burstShotsFired = 0;
      }
      return;
    }

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.ammo = wConfig.maxMagazine;
      }
      return;
    }

    if (this.ammo <= 0 && !this.settings.cheats.infiniteAmmo) {
      this.initiateReload();
      return;
    }

    if (this.burstCooldownTimer > 0) {
      this.burstCooldownTimer -= dt;
    }

    // Semi-auto (PIKE-556): require trigger release between shots.
    const metaW = WEAPON_CONFIGS[this.selectedWeapon];
    const isSemi = !metaW.isAuto && !metaW.burstSize;
    if (isSemi) {
      if (!this.isFiring) this.semiArmed = true;
      if (this.isFiring && this.fireCooldownTimer <= 0 && this.semiArmed) {
        this.semiArmed = false;
        this.fireWeapon();
      }
      return;
    }

    // Burst weapons (SA1216 / M11): burst gate via burstCooldownTimer.
    if (metaW.burstSize && metaW.burstSize > 1) {
      if (this.isFiring && this.fireCooldownTimer <= 0 && this.burstCooldownTimer <= 0) {
        this.fireWeapon();
      }
      return;
    }

    // Full-auto / continuous (Lewis, M60, FCAR, XP-54, Flamethrower, CL-40).
    if (this.isFiring && this.fireCooldownTimer <= 0 && this.cylinderRotateTimer <= 0) {
      this.fireWeapon();
    }
  }

  private fireWeapon() {
    const wConfig = this.getWeaponTuning();
    if (!this.settings.cheats.infiniteAmmo) {
      this.ammo--;
    }
    this.shotsFired++;

    this.fireCooldownTimer = wConfig.fireRate;
    this.applyWeaponRecoil();

    if (this.selectedWeapon === 'sa1216') {
      this.burstShotsFired++;
      if (this.burstShotsFired >= (wConfig.burstSize || 4)) {
        this.cylinderRotateTimer = wConfig.cylinderRotateDelay || 0.48;
        this.burstCooldownTimer = wConfig.cylinderRotateDelay || 0.48;
        this.burstShotsFired = 0;
        soundEngine.playCylinderRotate();
      }
      soundEngine.playShotgun();
      if (this.settings.screenShake) this.triggerScreenShake(7);

    } else if (this.selectedWeapon === 'lewis') {
      soundEngine.playLewisMG();
      if (this.settings.screenShake) this.triggerScreenShake(3);
      if (this.panDrumMesh) {
        this.panDrumMesh.rotation.y += 0.15;
      }

    } else if (this.selectedWeapon === 'flamethrower') {
      soundEngine.playFlamethrower();
      if (this.flameNozzleLight) {
        this.flameNozzleLight.intensity = 20;
        setTimeout(() => { if (this.flameNozzleLight) this.flameNozzleLight.intensity = 0; }, 50);
      }
      this.spawnFlameParticles();
    } else if (this.selectedWeapon === 'cl40') {
      soundEngine.playCL40();
      if (this.settings.screenShake) this.triggerScreenShake(6);
    } else if (this.selectedWeapon === 'xp54') {
      soundEngine.playXP54();
      if (this.settings.screenShake) this.triggerScreenShake(1.5);
    } else if (this.selectedWeapon === 'fcar') {
      soundEngine.playFCAR();
      if (this.settings.screenShake) this.triggerScreenShake(2.2);
    } else if (this.selectedWeapon === 'm60') {
      soundEngine.playM60();
      if (this.settings.screenShake) this.triggerScreenShake(3.5);
    } else if (this.selectedWeapon === 'm11') {
      this.burstShotsFired++;
      if (this.burstShotsFired >= (wConfig.burstSize || 3)) {
        this.burstCooldownTimer = WEAPON_CONFIGS[this.selectedWeapon].burstCooldown || 0.35;
        this.burstShotsFired = 0;
      }
      soundEngine.playM11();
      if (this.settings.screenShake) this.triggerScreenShake(1.8);
    } else if (this.selectedWeapon === 'pike556') {
      soundEngine.playPike556();
      if (this.settings.screenShake) this.triggerScreenShake(5);
    }

    // Muzzle flash
    if (this.selectedWeapon !== 'flamethrower' && this.muzzleFlashLight && this.muzzleFlashMesh) {
      this.muzzleFlashLight.intensity = 100;
      (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0.8;
      setTimeout(() => {
        if (this.muzzleFlashLight) this.muzzleFlashLight.intensity = 0;
        if (this.muzzleFlashMesh) (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }, 40);
    }

    // Raycast shots
    if (this.selectedWeapon === 'flamethrower') {
      // Flamethrower cone hit check
      const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      let anyHit = false;

      this.enemies.forEach(enemy => {
        const toEnemy = enemy.mesh.position.clone().sub(this.playerPos);
        const dist = toEnemy.length();
        toEnemy.normalize();

        const angle = cameraDir.angleTo(toEnemy);
        if (dist <= (wConfig.flameRange || 16) && angle <= (wConfig.flameConeAngle || 0.38)) {
          anyHit = true;
          const damage = Math.round(wConfig.damagePerShot * this.settings.cheats.damageMultiplier);
          enemy.burnTimer = wConfig.burnDuration || 2.0;
          this.damageEnemy(enemy, damage, false, cameraDir);
        }
      });

      if (anyHit) {
        this.shotsHit++;
        soundEngine.playHit(false);
        this.hitMarkerState = { active: true, isCrit: false, isKill: false, timestamp: performance.now() };
      }

    } else if (this.selectedWeapon === 'cl40') {
      // CL-40 Grenade Launcher AoE Blast
      const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const raycaster = new THREE.Raycaster();
      raycaster.set(this.cameraGroup.position, cameraDir);

      const enemyMeshes = this.enemies.map(e => e.mesh);
      const coverMeshes = this.coverObstacles.map(c => c.mesh);
      const intersects = raycaster.intersectObjects([...enemyMeshes, ...coverMeshes], true);

      let hitPoint = this.playerPos.clone().addScaledVector(cameraDir, wConfig.range);
      if (intersects.length > 0 && intersects[0].distance <= wConfig.range) {
        hitPoint = intersects[0].point.clone();
      }

      // Explosion audio and visual shockwave
      soundEngine.playCL40Explosion();
      this.spawnHitSpark(hitPoint);

      const expRingGeom = new THREE.RingGeometry(0.3, wConfig.explosionRadius || 4.5, 24);
      const expRingMat = new THREE.MeshBasicMaterial({ color: 0xff5500, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
      const expRing = new THREE.Mesh(expRingGeom, expRingMat);
      expRing.position.copy(hitPoint).add(new THREE.Vector3(0, 0.2, 0));
      expRing.rotation.x = -Math.PI / 2;
      this.scene.add(expRing);
      setTimeout(() => this.scene.remove(expRing), 150);

      // AoE damage check
      let anyHit = false;
      let anyKill = false;
      const radius = wConfig.explosionRadius || 4.5;

      this.enemies.forEach(enemy => {
        const dist = enemy.mesh.position.distanceTo(hitPoint);
        if (dist <= radius) {
          anyHit = true;
          const dmg = Math.round(wConfig.damagePerShot * (1 - (dist / radius) * 0.4) * this.settings.cheats.damageMultiplier);
          const killed = this.damageEnemy(enemy, dmg, false, enemy.mesh.position.clone().sub(hitPoint).normalize());
          if (killed) anyKill = true;
        }
      });

      this.coverObstacles.forEach(cover => {
        if (cover.mesh.position.distanceTo(hitPoint) <= radius) {
          this.destroyCover(cover, cover.mesh.position.clone().sub(hitPoint).normalize());
        }
      });

      if (anyHit) {
        this.shotsHit++;
        soundEngine.playHit(false);
        this.hitMarkerState = { active: true, isCrit: false, isKill: anyKill, timestamp: performance.now() };
      }

    } else {
      // SA1216, Lewis Machine Gun, or XP-54 Raycast
      const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const raycaster = new THREE.Raycaster();
      const pelletCount = wConfig.pelletCount || 1;
      let anyHit = false;
      let anyCrit = false;
      let anyKill = false;

      for (let i = 0; i < pelletCount; i++) {
        const spreadDir = cameraDir.clone();
        const spread = wConfig.pelletSpread || 0.02;
        spreadDir.x += (Math.random() - 0.5) * spread;
        spreadDir.y += (Math.random() - 0.5) * spread;
        spreadDir.z += (Math.random() - 0.5) * spread;
        spreadDir.normalize();

        raycaster.set(this.cameraGroup.position, spreadDir);

        const enemyMeshes = this.enemies.map(e => e.mesh);
        const coverMeshes = this.coverObstacles.map(c => c.mesh);
        const intersects = raycaster.intersectObjects([...enemyMeshes, ...coverMeshes], true);

        if (intersects.length > 0) {
          const hit = intersects[0];
          if (hit.distance <= wConfig.range) {
            this.spawnHitSpark(hit.point);

            const hitEnemy = this.enemies.find(e => {
              let curr: THREE.Object3D | null = hit.object;
              while (curr) {
                if (curr === e.mesh) return true;
                curr = curr.parent;
              }
              return false;
            });

            if (hitEnemy) {
              anyHit = true;
              const isHeadshot = hit.point.y - hitEnemy.mesh.position.y > 1.8 * hitEnemy.config.scale;
              if (isHeadshot) anyCrit = true;

              const critMult = isHeadshot ? 1.5 : 1.0;
              const damage = Math.round(wConfig.damagePerShot * critMult * this.settings.cheats.damageMultiplier);
              const killed = this.damageEnemy(hitEnemy, damage, isHeadshot, spreadDir);
              if (killed) anyKill = true;
            } else {
              const hitCover = this.coverObstacles.find(c => {
                let curr: THREE.Object3D | null = hit.object;
                while (curr) {
                  if (curr === c.mesh) return true;
                  curr = curr.parent;
                }
                return false;
              });
              if (hitCover) {
                hitCover.hp -= wConfig.damagePerShot * this.settings.cheats.damageMultiplier;
                if (hitCover.hp <= 0) {
                  this.destroyCover(hitCover, spreadDir);
                }
              }
            }
          }
        }
      }

      if (anyHit) {
        this.shotsHit++;
        soundEngine.playHit(anyCrit);
        this.hitMarkerState = { active: true, isCrit: anyCrit, isKill: anyKill, timestamp: performance.now() };
      }
    }
  }

  private spawnFlameParticles() {
    const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const startPos = this.playerPos.clone().add(new THREE.Vector3(0.3, -0.2, -0.6).applyQuaternion(this.camera.quaternion));

    for (let i = 0; i < 3; i++) {
      const geom = new THREE.SphereGeometry(0.18 + Math.random() * 0.1, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xff5500 : 0xffaa00, transparent: true, opacity: 0.8 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(startPos);
      this.scene.add(mesh);

      const spreadDir = cameraDir.clone();
      spreadDir.x += (Math.random() - 0.5) * 0.2;
      spreadDir.y += (Math.random() - 0.5) * 0.2;
      spreadDir.z += (Math.random() - 0.5) * 0.2;
      spreadDir.normalize();

      this.flameParticles.push({
        mesh,
        velocity: spreadDir.multiplyScalar(22 + Math.random() * 8),
        lifetime: 0,
        maxLifetime: 0.45,
      });
    }
  }

  private updateFlameParticles(dt: number) {
    for (let i = this.flameParticles.length - 1; i >= 0; i--) {
      const flame = this.flameParticles[i];
      flame.lifetime += dt;
      flame.mesh.position.addScaledVector(flame.velocity, dt);

      const progress = flame.lifetime / flame.maxLifetime;
      flame.mesh.scale.setScalar(1 + progress * 2.5);
      (flame.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - progress));

      if (progress >= 1) {
        this.scene.remove(flame.mesh);
        this.flameParticles.splice(i, 1);
      }
    }
  }

  private spawnHitSpark(pos: THREE.Vector3) {
    const spark = new THREE.Mesh(this.hitSparkGeom, this.hitSparkMat);
    spark.position.copy(pos);
    this.scene.add(spark);
    setTimeout(() => this.scene.remove(spark), 80);
  }

  public damageEnemy(enemy: EnemyInstance, amount: number, isHeadshot: boolean, impactDir: THREE.Vector3): boolean {
    if (enemy.hp <= 0) return false;
    enemy.hp -= amount;
    enemy.hitFlashTimer = 0.12;
    enemy.hpBarTimer = 2.0;

    enemy.velocity.addScaledVector(impactDir, 3.5);
    this.showEnemyHPBar(enemy);

    this.spawnFloatingText(
      amount.toString(),
      enemy.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 2.2 + Math.random() * 0.5, (Math.random() - 0.5) * 1.5)),
      isHeadshot ? "#d4a373" : "#FFFFFF",
      isHeadshot,
      isHeadshot ? 1.4 : 1.0
    );

    if (enemy.hp <= 0) {
      this.killEnemy(enemy, impactDir);
      return true;
    }
    return false;
  }

  private killEnemy(enemy: EnemyInstance, impactDir: THREE.Vector3) {
    this.totalKills++;
    this.comboCount++;
    this.comboTimer = 4.5;

    const now = performance.now();
    if (now - this.lastKillSoundTime > 150) {
      soundEngine.playKillExplosion();
      this.lastKillSoundTime = now;
    }
    
    if (this.settings.screenShake) this.triggerScreenShake(12);

    const bonus = Math.round(enemy.config.cashValue * (1 + (this.comboCount - 1) * 0.15));
    const lang = this.settings.language;
    this.cashOutScore += bonus;
    this.killFeed = {
      active: true,
      id: Math.random().toString(36).slice(2, 8).toUpperCase(),
      timestamp: performance.now(),
    };
    this.spawnFloatingText(
      `+ $${bonus.toLocaleString()} ${lang === 'zh' ? '现金' : 'CASH'}`,
      enemy.mesh.position.clone().add(new THREE.Vector3(0, 3.5, 0)),
      "#d4a373",
      true,
      1.8
    );

    const coinCount = enemy.config.coinCount;
    for (let i = 0; i < coinCount; i++) {
      const coinMesh = new THREE.Mesh(this.coinGeom, this.coinMat);
      coinMesh.position.copy(enemy.mesh.position);
      coinMesh.position.y += 1.0 + (Math.random() - 0.5) * 0.5;
      coinMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      coinMesh.castShadow = true;
      this.scene.add(coinMesh);

      const angle = (i / coinCount) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 4 + Math.random() * 8;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed + impactDir.x * 4,
        6 + Math.random() * 9,
        Math.sin(angle) * speed + impactDir.z * 4
      );

      this.coins.push({
        id: `coin-${Math.random()}`,
        mesh: coinMesh,
        position: coinMesh.position,
        velocity: vel,
        value: Math.round(bonus / coinCount),
        bounceCount: 0,
        lifetime: 5.0,
        isMagnetized: false,
      });
    }

    this.scene.remove(enemy.mesh);
    this.enemies = this.enemies.filter(e => e.id !== enemy.id);
  }

  private destroyCover(cover: CoverObstacle, hitDir: THREE.Vector3) {
    soundEngine.playShatter();
    if (this.settings.screenShake) this.triggerScreenShake(10);
    this.scene.remove(cover.mesh);
    this.coverObstacles = this.coverObstacles.filter(c => c.id !== cover.id);

    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: cover.color,
        roughness: 0.5,
      });
      const debrisMesh = new THREE.Mesh(this.debrisGeom, mat);
      debrisMesh.position.copy(cover.mesh.position);
      debrisMesh.position.add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2));
      this.scene.add(debrisMesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 12 + hitDir.x * 6,
        4 + Math.random() * 8,
        (Math.random() - 0.5) * 12 + hitDir.z * 6
      );

      this.debris.push({
        mesh: debrisMesh,
        velocity: vel,
        angularVelocity: new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5),
        lifetime: 0,
        maxLifetime: 2.0,
      });
    }
  }

  private spawnFloatingText(text: string, pos: THREE.Vector3, color: string, isCrit: boolean, scale: number = 1.0) {
    this.floatingTexts.push({
      id: `text-${Math.random()}`,
      text,
      position: pos.clone(),
      color,
      lifetime: 0,
      maxLifetime: 1.1,
      isCrit,
      scale,
    });
  }

  private updateFloatingTexts(dt: number) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.lifetime += dt;
      if (ft.lifetime >= ft.maxLifetime) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private updateEnemyHPBars(dt: number) {
    for (let i = this.enemyHPBars.length - 1; i >= 0; i--) {
      const bar = this.enemyHPBars[i];
      bar.lifetime += dt;
      if (bar.lifetime >= 2.0) {
        this.enemyHPBars.splice(i, 1);
      }
    }
  }

  private showEnemyHPBar(enemy: EnemyInstance) {
    this.enemyHPBars = this.enemyHPBars.filter(b => b.id !== enemy.id);
    this.enemyHPBars.push({
      id: enemy.id,
      hpPercent: enemy.hp / enemy.maxHp,
      position: enemy.mesh.position.clone().add(new THREE.Vector3(0, 3.5, 0)),
      color: enemy.config.color,
      lifetime: 0,
    });
  }

  // ==================== GADGET SYSTEM ====================
  public selectGadgetSlot(slot: number) {
    if (slot >= 0 && slot < 4) this.selectedGadgetSlot = slot;
  }

  public useGadget() {
    const slot = this.selectedGadgetSlot;
    const gadgetId = this.settings.gadgetSlots[slot];
    if (!gadgetId) return;
    const cfg = GADGET_CONFIGS[gadgetId];
    const ammo = this.gadgetAmmo[slot];
    if (ammo !== null && ammo <= 0) return;

    // Decrement ammo
    if (ammo !== null) this.gadgetAmmo[slot] = ammo - 1;
    if (ammo !== null && ammo - 1 <= 0) {
      this.gadgetRespawnTimers[slot] = cfg.respawnTime;
    }

    if (cfg.category === 'instant') {
      this.applyInstantGadget(gadgetId, cfg);
    } else if (cfg.category === 'throwable') {
      this.throwGadget(gadgetId, cfg);
    } else if (cfg.category === 'placeable') {
      this.placeGadget(gadgetId, cfg);
    }
  }

  private throwGadget(id: GadgetId, cfg: GadgetConfig) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const startPos = this.playerPos.clone().add(new THREE.Vector3(0.3, -0.2, -0.5).applyQuaternion(this.camera.quaternion));

    const geom = new THREE.SphereGeometry(0.15, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: cfg.color, metalness: 0.4, roughness: 0.6 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(startPos);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const velocity = dir.clone().multiplyScalar(cfg.throwSpeed || 15);
    velocity.y += 4; // slight upward arc

    this.thrownGadgets.push({
      id: `${id}-${Math.random()}`,
      config: cfg,
      mesh,
      position: startPos.clone(),
      velocity,
      lifetime: 0,
      fuseTimer: cfg.fuseTime || 999,
      stuck: false,
      activated: false,
      effectTimer: 0,
    });

    soundEngine.playUI();
  }

  private placeGadget(id: GadgetId, cfg: GadgetConfig) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const placePos = this.playerPos.clone().addScaledVector(dir, 2);
    placePos.y = 0.3;

    if (id === 'trophy_system' || id === 'repair_field' || id === 'medkit') {
      const geom = new THREE.BoxGeometry(0.4, 0.2, 0.4);
      const mat = new THREE.MeshStandardMaterial({ color: cfg.color, emissive: cfg.color, emissiveIntensity: 0.3 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(placePos);
      mesh.castShadow = true;
      this.scene.add(mesh);
      void cfg; // suppress unused warning

      this.activeEffects.push({
        id: `effect-${Math.random()}`,
        gadgetId: id,
        position: placePos.clone(),
        lifetime: 0,
        maxLifetime: cfg.effectDuration || 10,
        mesh,
      });
    } else if (id === 'trip_mine') {
      const geom = new THREE.ConeGeometry(0.2, 0.15, 8);
      const mat = new THREE.MeshStandardMaterial({ color: cfg.color, emissive: 0xff4400, emissiveIntensity: 0.5 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(placePos);
      mesh.rotation.x = Math.PI / 2;
      this.scene.add(mesh);

      this.activeEffects.push({
        id: `effect-${Math.random()}`,
        gadgetId: id,
        position: placePos.clone(),
        lifetime: 0,
        maxLifetime: 30,
        mesh,
      });
    }
    soundEngine.playUI();
  }

  private applyInstantGadget(id: GadgetId, cfg: GadgetConfig) {
    if (id === 'health_shot') {
      this.currentHp = Math.min(this.maxHp, this.currentHp + (cfg.healAmount || 100));
      this.spawnFloatingText(`+${cfg.healAmount} HP`, this.playerPos.clone().add(new THREE.Vector3(0, 2, 0)), '#00ff00', false, 1.5);
    } else if (id === 'adrenaline_shot') {
      this.settings.cheats.speedMultiplier = 1.5;
      setTimeout(() => { this.settings.cheats.speedMultiplier = 1.0; }, (cfg.effectDuration || 5) * 1000);
    }
    soundEngine.playCoin();
  }

  private updateThrownGadgets(dt: number) {
    for (let i = this.thrownGadgets.length - 1; i >= 0; i--) {
      const g = this.thrownGadgets[i];
      g.lifetime += dt;
      g.fuseTimer -= dt;

      if (!g.stuck) {
        // Apply gravity
        g.velocity.y -= (g.config.gravity || 20) * dt;
        g.mesh.position.addScaledVector(g.velocity, dt);
        g.mesh.rotation.x += dt * 3;
        g.mesh.rotation.z += dt * 2;

        // Ground collision
        if (g.mesh.position.y <= 0.15) {
          g.mesh.position.y = 0.15;
          if (g.config.id === 'sticky_bomb' || g.config.id === 'c4') {
            g.stuck = true;
            g.velocity.set(0, 0, 0);
          } else {
            g.velocity.y *= -0.3;
            g.velocity.x *= 0.6;
            g.velocity.z *= 0.6;
            if (Math.abs(g.velocity.y) < 1) {
              g.stuck = true;
              g.velocity.set(0, 0, 0);
            }
          }
        }
      }

      // Trigger effects
      if (g.fuseTimer <= 0 && !g.activated) {
        g.activated = true;
        this.triggerGadgetEffect(g);
      }

      // Remove after effect
      if (g.activated && g.lifetime > (g.config.fuseTime || 3) + 1) {
        this.scene.remove(g.mesh);
        this.thrownGadgets.splice(i, 1);
      }
    }
  }

  private triggerGadgetEffect(g: ThrownGadget) {
    const cfg = g.config;
    const pos = g.mesh.position;

    if (cfg.id === 'frag_grenade' || cfg.id === 'sticky_bomb' || cfg.id === 'c4' || cfg.id === 'trip_mine') {
      // Explosion
      const radius = cfg.effectRadius || 5;
      const dmg = cfg.damage || 150;
      soundEngine.playSlam();
      if (this.settings.screenShake) this.triggerScreenShake(15);

      // Visual explosion
      const expGeom = new THREE.SphereGeometry(radius * 0.5, 16, 16);
      const expMat = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.8 });
      const expMesh = new THREE.Mesh(expGeom, expMat);
      expMesh.position.copy(pos);
      this.scene.add(expMesh);
      setTimeout(() => this.scene.remove(expMesh), 200);

      // Damage enemies
      this.enemies.forEach(enemy => {
        const dist = pos.distanceTo(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)));
        if (dist <= radius) {
          const dmgMult = 1 - (dist / radius) * 0.5;
          const finalDmg = Math.round(dmg * dmgMult * this.settings.cheats.damageMultiplier);
          const dir = enemy.mesh.position.clone().sub(pos).normalize();
          this.damageEnemy(enemy, finalDmg, false, dir);
          enemy.velocity.addScaledVector(dir, 10 * dmgMult);
          enemy.velocity.y += 8 * dmgMult;
        }
      });

      // Destroy covers
      this.coverObstacles.forEach(cover => {
        if (pos.distanceTo(cover.mesh.position) <= radius) {
          this.destroyCover(cover, cover.mesh.position.clone().sub(pos).normalize());
        }
      });
    } else if (cfg.id === 'smoke_grenade') {
      // Smoke cloud
      for (let i = 0; i < 8; i++) {
        const smokeGeom = new THREE.SphereGeometry(1.5 + Math.random(), 8, 8);
        const smokeMat = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.6 });
        const smokeMesh = new THREE.Mesh(smokeGeom, smokeMat);
        smokeMesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2));
        this.scene.add(smokeMesh);
        this.activeEffects.push({
          id: `smoke-${Math.random()}`,
          gadgetId: 'smoke_grenade',
          position: smokeMesh.position.clone(),
          lifetime: 0,
          maxLifetime: cfg.effectDuration || 8,
          mesh: smokeMesh,
        });
      }
    } else if (cfg.id === 'flashbang') {
      // Flashbang - blind enemies
      const radius = cfg.effectRadius || 12;
      this.enemies.forEach(enemy => {
        const dist = pos.distanceTo(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)));
        if (dist <= radius) {
          enemy.blindedTimer = cfg.effectDuration || 3;
        }
      });
      // Flash player if close
      const playerDist = pos.distanceTo(this.playerPos);
      if (playerDist <= radius) {
        this.damageFlashTimer = 2.0;
      }
      soundEngine.playHit(true);
    } else if (cfg.id === 'gas_grenade' || cfg.id === 'fireball') {
      // Area effect cloud
      const cloudGeom = new THREE.SphereGeometry(cfg.effectRadius || 5, 12, 12);
      const cloudColor = cfg.id === 'gas_grenade' ? 0x88ff00 : 0xff4400;
      const cloudMat = new THREE.MeshBasicMaterial({ color: cloudColor, transparent: true, opacity: 0.4 });
      const cloudMesh = new THREE.Mesh(cloudGeom, cloudMat);
      cloudMesh.position.copy(pos);
      cloudMesh.position.y += 1;
      this.scene.add(cloudMesh);
      this.activeEffects.push({
        id: `cloud-${Math.random()}`,
        gadgetId: cfg.id,
        position: cloudMesh.position.clone(),
        lifetime: 0,
        maxLifetime: cfg.effectDuration || 10,
        mesh: cloudMesh,
      });
    } else if (cfg.id === 'decoy') {
      // Holographic decoy
      const decoyGeom = new THREE.BoxGeometry(0.6, 1.8, 0.6);
      const decoyMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.5 });
      const decoyMesh = new THREE.Mesh(decoyGeom, decoyMat);
      decoyMesh.position.copy(pos);
      decoyMesh.position.y += 0.9;
      this.scene.add(decoyMesh);
      this.activeEffects.push({
        id: `decoy-${Math.random()}`,
        gadgetId: 'decoy',
        position: decoyMesh.position.clone(),
        lifetime: 0,
        maxLifetime: cfg.effectDuration || 15,
        mesh: decoyMesh,
      });
    }
  }

  private updateActiveEffects(dt: number) {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const eff = this.activeEffects[i];
      eff.lifetime += dt;

      // Apply ongoing effects
      if (eff.gadgetId === 'medkit' || eff.gadgetId === 'repair_field') {
        const dist = eff.position.distanceTo(this.playerPos);
        const radius = eff.gadgetId === 'medkit' ? 4 : 5;
        if (dist <= radius && eff.lifetime % 1 < dt) {
          this.currentHp = Math.min(this.maxHp, this.currentHp + 15);
        }
      } else if (eff.gadgetId === 'gas_grenade') {
        const dist = eff.position.distanceTo(this.playerPos);
        if (dist <= 5 && eff.lifetime % 0.5 < dt) {
          if (!this.settings.cheats.godMode) {
            this.currentHp = Math.max(0, this.currentHp - 5);
            if (this.currentHp <= 0 && !this.isGameOver) {
              this.isGameOver = true;
              document.exitPointerLock?.();
            }
          }
        }
        this.enemies.forEach(enemy => {
          if (eff.position.distanceTo(enemy.mesh.position) <= 5) {
            enemy.poisonedTimer = 2;
          }
        });
      } else if (eff.gadgetId === 'fireball') {
        const dist = eff.position.distanceTo(this.playerPos);
        if (dist <= 5 && eff.lifetime % 0.5 < dt) {
          if (!this.settings.cheats.godMode) {
            this.currentHp = Math.max(0, this.currentHp - 10);
          }
        }
      } else if (eff.gadgetId === 'trophy_system') {
        // Intercept thrown gadgets
        const radius = 8;
        for (let j = this.thrownGadgets.length - 1; j >= 0; j--) {
          const g = this.thrownGadgets[j];
          if (eff.position.distanceTo(g.mesh.position) <= radius && !g.activated) {
            g.activated = true;
            this.scene.remove(g.mesh);
            this.thrownGadgets.splice(j, 1);
            soundEngine.playHit(false);
          }
        }
      } else if (eff.gadgetId === 'trip_mine') {
        // Proximity trigger
        this.enemies.forEach(enemy => {
          if (eff.position.distanceTo(enemy.mesh.position) <= 2 && eff.mesh) {
            eff.mesh.visible = false;
            const triggerPos = eff.position.clone();
            void GADGET_CONFIGS['trip_mine']; // suppress unused warning
            // Explode
            soundEngine.playSlam();
            if (this.settings.screenShake) this.triggerScreenShake(15);
            const expGeom = new THREE.SphereGeometry(3, 16, 16);
            const expMat = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.8 });
            const expMesh = new THREE.Mesh(expGeom, expMat);
            expMesh.position.copy(triggerPos);
            this.scene.add(expMesh);
            setTimeout(() => this.scene.remove(expMesh), 200);
            // Damage
            this.enemies.forEach(e => {
              const d = triggerPos.distanceTo(e.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)));
              if (d <= 4) {
                const dmg = Math.round(250 * (1 - d / 4) * this.settings.cheats.damageMultiplier);
                const dir = e.mesh.position.clone().sub(triggerPos).normalize();
                this.damageEnemy(e, dmg, false, dir);
              }
            });
            // Remove mine
            if (eff.mesh) this.scene.remove(eff.mesh);
            this.activeEffects.splice(i, 1);
            return;
          }
        });
      }

      // Animate
      if (eff.mesh && 'material' in eff.mesh) {
        const progress = eff.lifetime / eff.maxLifetime;
        const mesh = eff.mesh as THREE.Mesh;
        if (eff.gadgetId === 'smoke_grenade') {
          (mesh.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - progress * 0.5);
          mesh.scale.setScalar(1 + progress * 0.5);
        } else if (eff.gadgetId === 'decoy') {
          (mesh.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(progress * Math.PI * 4) * 0.2;
        }
      }

      // Remove expired
      if (eff.lifetime >= eff.maxLifetime) {
        if (eff.mesh) this.scene.remove(eff.mesh);
        this.activeEffects.splice(i, 1);
      }
    }
  }

  private updateGadgetRespawns(dt: number) {
    for (let i = 0; i < 4; i++) {
      if (this.gadgetRespawnTimers[i] !== null) {
        this.gadgetRespawnTimers[i]! -= dt;
        if (this.gadgetRespawnTimers[i]! <= 0) {
          const gadgetId = this.settings.gadgetSlots[i];
          if (gadgetId) {
            this.gadgetAmmo[i] = GADGET_CONFIGS[gadgetId].maxAmmo;
          }
          this.gadgetRespawnTimers[i] = null;
        }
      }
    }
  }

  public initGadgetAmmo() {
    for (let i = 0; i < 4; i++) {
      const gadgetId = this.settings.gadgetSlots[i];
      if (gadgetId) {
        this.gadgetAmmo[i] = GADGET_CONFIGS[gadgetId].maxAmmo;
      } else {
        this.gadgetAmmo[i] = null;
      }
      this.gadgetRespawnTimers[i] = null;
    }
  }

  public getGadgetSlotInfo() {
    return this.settings.gadgetSlots.map((id, i) => ({
      gadgetId: id,
      ammo: this.gadgetAmmo[i],
      respawnTimer: this.gadgetRespawnTimers[i],
      selected: this.selectedGadgetSlot === i,
    }));
  }

  private triggerScreenShake(intensity: number) {
    this.screenShakeIntensity = Math.min(35, this.screenShakeIntensity + intensity);
  }

  private applyWeaponRecoil() {
    const aimingScale = this.isAiming ? 0.55 : 1.0;
    const recoilByWeapon: Record<SelectedWeapon, { pitch: number; yaw: number; roll: number; kick: number; viewKick: number }> = {
      sa1216: { pitch: 4.8, yaw: 1.7, roll: 0.55, kick: 0.18, viewKick: 0.12 },
      lewis: { pitch: 1.6, yaw: 0.7, roll: 0.22, kick: 0.08, viewKick: 0.05 },
      flamethrower: { pitch: 0.35, yaw: 0.15, roll: 0.08, kick: 0.025, viewKick: 0.015 },
      cl40: { pitch: 5.8, yaw: 1.3, roll: 0.7, kick: 0.22, viewKick: 0.16 },
      xp54: { pitch: 1.15, yaw: 0.5, roll: 0.16, kick: 0.05, viewKick: 0.03 },
      fcar: { pitch: 2.2, yaw: 0.9, roll: 0.28, kick: 0.09, viewKick: 0.055 },
      m60: { pitch: 1.9, yaw: 0.8, roll: 0.25, kick: 0.10, viewKick: 0.06 },
      m11: { pitch: 2.6, yaw: 0.6, roll: 0.20, kick: 0.08, viewKick: 0.045 },
      pike556: { pitch: 3.8, yaw: 1.1, roll: 0.35, kick: 0.14, viewKick: 0.09 },
    };
    const recoil = recoilByWeapon[this.selectedWeapon];
    const yawDirection = Math.random() < 0.5 ? -1 : 1;
    this.recoilVelPitch += recoil.pitch * aimingScale;
    this.recoilVelYaw += yawDirection * recoil.yaw * aimingScale * (0.45 + Math.random() * 0.55);
    this.recoilVelRoll += yawDirection * recoil.roll * aimingScale;
    this.gunRecoilZ = Math.max(this.gunRecoilZ, recoil.kick * aimingScale);
    this.gunRecoilPitch = Math.max(this.gunRecoilPitch, recoil.viewKick * aimingScale);
  }

  private getADSProfile() {
    const profiles: Record<SelectedWeapon, { x: number; y: number; z: number; rx: number; ry: number; rz: number }> = {
      sa1216:     { x: 0.0,  y: -0.185, z: -0.46, rx: -0.02,  ry: 0, rz: 0 },
      lewis:      { x: 0.0,  y: -0.21,  z: -0.50, rx: -0.015, ry: 0, rz: 0 },
      flamethrower:{ x: 0.02, y: -0.22, z: -0.52, rx: -0.01,  ry: 0, rz: 0 },
      cl40:       { x: 0.0,  y: -0.18,  z: -0.48, rx: -0.02,  ry: 0, rz: 0 },
      xp54:       { x: 0.0,  y: -0.16,  z: -0.42, rx: -0.01,  ry: 0, rz: 0 },
      fcar:       { x: 0.0,  y: -0.175, z: -0.45, rx: -0.015, ry: 0, rz: 0 },
      m60:        { x: 0.0,  y: -0.22,  z: -0.52, rx: -0.02,  ry: 0, rz: 0 },
      m11:        { x: 0.05, y: -0.135, z: -0.36, rx: -0.005, ry: 0, rz: 0 },
      pike556:    { x: 0.0,  y: -0.19,  z: -0.50, rx: -0.02,  ry: 0, rz: 0 },
    };
    return profiles[this.selectedWeapon];
  }

  private getSelectedOpticConfig() {
    return OPTIC_CONFIGS[this.selectedOptic];
  }

  // MAIN GAME LOOP (60 FPS)
  private animate = () => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());

    if (!this.isPaused && !this.isGameOver) {
      this.timeSurvived += dt;
      this.updatePlayer(dt);
      this.updateWeapon(dt);
      this.updateSkill(dt);
      this.updateEnemies(dt);
      this.updateCoins(dt);
      this.updateDebris(dt);
      this.updateFlameParticles(dt);
      this.updateThrownGadgets(dt);
      this.updateActiveEffects(dt);
      this.updateGadgetRespawns(dt);
      this.updateSpawning(dt);
      this.updateFloatingTexts(dt);
      this.updateEnemyHPBars(dt);

      if (this.comboCount > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.comboCount = 0;
      }
      if (this.damageFlashTimer > 0) this.damageFlashTimer -= dt;
    }

    this.updateCameraAndViewModel(dt);
    this.renderer.render(this.scene, this.camera);

    if (performance.now() - this.lastUIUpdateTime > 60) {
      this.notifyUI();
      this.lastUIUpdateTime = performance.now();
    }
  };

  private updatePlayer(dt: number) {
    let moveX = this.moveJoystick.x;
    let moveZ = this.moveJoystick.y;

    if (this.keys['w'] || this.keys['arrowup']) moveZ = -1;
    if (this.keys['s'] || this.keys['arrowdown']) moveZ = 1;
    if (this.keys['a'] || this.keys['arrowleft']) moveX = -1;
    if (this.keys['d'] || this.keys['arrowright']) moveX = 1;

    const baseSpeed = 9.5 * (1 + this.upgrades.movementSpeedBonus * 0.5) * this.settings.cheats.speedMultiplier;
    const currentSpeed = baseSpeed * this.chargeSpeedMultiplier;

    const forward = new THREE.Vector3(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
    const right = new THREE.Vector3(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));

    const targetVel = new THREE.Vector3();
    targetVel.addScaledVector(forward, -moveZ * currentSpeed);
    targetVel.addScaledVector(right, moveX * currentSpeed);

    const accel = this.isGrounded ? 15 : 6;
    this.playerVel.x += (targetVel.x - this.playerVel.x) * Math.min(1, dt * accel);
    this.playerVel.z += (targetVel.z - this.playerVel.z) * Math.min(1, dt * accel);

    this.playerVel.y -= 26 * dt;
    this.playerPos.addScaledVector(this.playerVel, dt);

    if (this.playerPos.y <= 2.0) {
      this.playerPos.y = 2.0;
      this.playerVel.y = 0;
      this.isGrounded = true;
    }

    const limit = 47;
    this.playerPos.x = Math.max(-limit, Math.min(limit, this.playerPos.x));
    this.playerPos.z = Math.max(-limit, Math.min(limit, this.playerPos.z));

    const playerRadius = 0.8;
    this.coverObstacles.forEach(cover => {
      if (cover.boundingBox.intersectsSphere(new THREE.Sphere(this.playerPos, playerRadius))) {
        if (this.isCharging) {
          this.destroyCover(cover, forward);
        } else {
          const center = new THREE.Vector3();
          cover.boundingBox.getCenter(center);
          const push = this.playerPos.clone().sub(center);
          push.y = 0;
          push.normalize();
          this.playerPos.addScaledVector(push, 0.25);
        }
      }
    });

    if (this.isGrounded && (Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1)) {
      this.gunBobTimer += dt * 14;
    }
  }

  private updateSkill(dt: number) {
    if (this.skillCooldownTimer > 0) this.skillCooldownTimer -= dt;

    if (this.selectedSkill === 'charge_slam' && this.isCharging) {
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        this.executeSlam();
      } else {
        const chargeDir = new THREE.Vector3(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
        this.enemies.forEach(enemy => {
          if (enemy.mesh.position.distanceTo(this.playerPos) < 2.5) {
            this.damageEnemy(enemy, Math.round(140 * this.settings.cheats.damageMultiplier), false, chargeDir);
            enemy.velocity.addScaledVector(chargeDir, 15);
            enemy.velocity.y += 6;
          }
        });
      }
    }

    if (this.selectedSkill === 'mesh_shield' && this.isShieldActive) {
      this.shieldDurationTimer -= dt;
      if (this.shieldDurationTimer <= 0 || this.shieldHp <= 0) {
        this.isShieldActive = false;
        if (this.shieldMesh) this.shieldMesh.visible = false;
      }
    }

    if (this.clawChainParticle) {
      this.clawChainParticle.lifetime -= dt;
      if (this.clawChainParticle.lifetime <= 0) {
        this.scene.remove(this.clawChainParticle.mesh);
        this.clawChainParticle = null;
        this.isClawActive = false;
      }
    }

    if (this.shockwaveMesh && this.shockwaveTimer > 0) {
      this.shockwaveTimer -= dt;
      const scale = (1 - this.shockwaveTimer / 0.6) * 12 * 1.5;
      this.shockwaveMesh.scale.set(scale, scale, 1);
      (this.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = (this.shockwaveTimer / 0.6) * 0.9;
      if (this.shockwaveTimer <= 0) this.shockwaveMesh.visible = false;
    }
  }

  private updateEnemies(dt: number) {
    this.enemies.forEach(enemy => {
      // Flamethrower Burn DoT
      if (enemy.burnTimer && enemy.burnTimer > 0) {
        enemy.burnTimer -= dt;
        if (!enemy.burnDamageTimer) enemy.burnDamageTimer = 0;
        enemy.burnDamageTimer += dt;
        if (enemy.burnDamageTimer >= 0.2) {
          enemy.burnDamageTimer = 0;
          this.damageEnemy(enemy, Math.round(15 * this.settings.cheats.damageMultiplier), false, new THREE.Vector3(0, 0.5, 0));
        }
      }

      if (enemy.hitFlashTimer > 0) {
        enemy.hitFlashTimer -= dt;
        const body = enemy.mesh.children[0] as THREE.Mesh;
        if (body && body.material) {
          (body.material as THREE.MeshStandardMaterial).emissive.setHex(enemy.hitFlashTimer > 0 ? 0xffffff : enemy.config.color);
        }
      }

      if (enemy.isStunned) {
        enemy.stunTimer -= dt;
        if (enemy.stunTimer <= 0) enemy.isStunned = false;
        enemy.mesh.position.addScaledVector(enemy.velocity, dt);
        enemy.velocity.y -= 22 * dt;
        if (enemy.mesh.position.y <= 1.1 * enemy.config.scale) {
          enemy.mesh.position.y = 1.1 * enemy.config.scale;
          enemy.velocity.y = 0;
          enemy.velocity.x *= 0.5;
          enemy.velocity.z *= 0.5;
        }
        return;
      }

      const dirToPlayer = this.playerPos.clone().sub(enemy.mesh.position);
      dirToPlayer.y = 0;
      const distToPlayer = dirToPlayer.length();
      dirToPlayer.normalize();

      enemy.mesh.lookAt(new THREE.Vector3(this.playerPos.x, enemy.mesh.position.y, this.playerPos.z));

      if (distToPlayer > enemy.config.attackRange) {
        enemy.mesh.position.addScaledVector(dirToPlayer, enemy.config.speed * dt);
      } else {
        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = enemy.config.attackCooldown;
          this.executeEnemyAttack(enemy, dirToPlayer);
        }
      }

      enemy.mesh.position.addScaledVector(enemy.velocity, dt);
      enemy.velocity.x *= 0.88;
      enemy.velocity.z *= 0.88;
      enemy.velocity.y -= 22 * dt;
      if (enemy.mesh.position.y <= 1.1 * enemy.config.scale) {
        enemy.mesh.position.y = 1.1 * enemy.config.scale;
        enemy.velocity.y = 0;
      }
    });

    // Enemy projectiles
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const proj = this.enemyProjectiles[i];
      proj.mesh.position.addScaledVector(proj.velocity, dt);
      proj.lifetime -= dt;

      // Check collision with Mesh Shield
      if (this.isShieldActive && this.shieldMesh) {
        const shieldWorldPos = new THREE.Vector3();
        this.shieldMesh.getWorldPosition(shieldWorldPos);
        if (proj.mesh.position.distanceTo(shieldWorldPos) < 2.5) {
          this.shieldHp -= proj.damage;
          this.scene.remove(proj.mesh);
          this.enemyProjectiles.splice(i, 1);
          soundEngine.playHit(false);
          continue;
        }
      }

      // Check collision with player
      if (proj.mesh.position.distanceTo(this.playerPos) < 1.2) {
        this.takeDamage(proj.damage);
        this.scene.remove(proj.mesh);
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      if (proj.lifetime <= 0 || proj.mesh.position.y <= 0) {
        this.scene.remove(proj.mesh);
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  private executeEnemyAttack(enemy: EnemyInstance, dirToPlayer: THREE.Vector3) {
    if (this.isShieldActive) {
      // Mesh shield absorbs melee attacks
      this.shieldHp -= enemy.config.damage;
      soundEngine.playHit(false);
      return;
    }

    if (enemy.config.type === 'LIGHT_DASH' || enemy.config.type === 'HEAVY_JUGGERNAUT') {
      enemy.velocity.addScaledVector(dirToPlayer, enemy.config.type === 'HEAVY_JUGGERNAUT' ? 12 : 18);
      if (enemy.mesh.position.distanceTo(this.playerPos) <= enemy.config.attackRange + 1.5) {
        this.takeDamage(enemy.config.damage);
      }
    } else {
      const projGeom = new THREE.SphereGeometry(0.35, 8, 8);
      const projMat = new THREE.MeshBasicMaterial({ color: enemy.config.color });
      const projMesh = new THREE.Mesh(projGeom, projMat);
      projMesh.position.copy(enemy.mesh.position).add(new THREE.Vector3(0, 1.5, 0));
      this.scene.add(projMesh);

      const vel = this.playerPos.clone().add(new THREE.Vector3(0, 0.5, 0)).sub(projMesh.position).normalize().multiplyScalar(32);
      this.enemyProjectiles.push({
        mesh: projMesh,
        velocity: vel,
        damage: enemy.config.damage,
        lifetime: 3.5,
      });
    }
  }

  private takeDamage(amount: number) {
    if (this.currentHp <= 0 || this.isGameOver || this.settings.cheats.godMode) return;

    if (this.isShieldActive) {
      this.shieldHp -= amount;
      soundEngine.playHit(false);
      if (this.shieldHp <= 0) {
        this.isShieldActive = false;
        if (this.shieldMesh) this.shieldMesh.visible = false;
      }
      return;
    }

    this.currentHp = Math.max(0, this.currentHp - amount);
    this.damageFlashTimer = 0.4;
    if (this.settings.screenShake) this.triggerScreenShake(8);
    soundEngine.playHit(false);

    if (this.currentHp <= 0) {
      this.isGameOver = true;
      document.exitPointerLock?.();
      this.onUIUpdate?.({ ...this.uiState, hp: 0 });
    }
  }

  private updateCoins(dt: number) {
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      coin.lifetime -= dt;

      // Visual-only coin burst: bounce, shimmer, then fade away like THE FINALS debris.
      coin.mesh.position.addScaledVector(coin.velocity, dt);
      coin.velocity.y -= 24 * dt;

      if (coin.mesh.position.y <= 0.05) {
        coin.mesh.position.y = 0.05;
        if (Math.abs(coin.velocity.y) > 2) {
          coin.velocity.y = -coin.velocity.y * 0.45;
          coin.velocity.x *= 0.75;
          coin.velocity.z *= 0.75;
          if (coin.bounceCount === 0) soundEngine.playCoin();
          coin.bounceCount++;
        } else {
          coin.velocity.set(0, 0, 0);
        }
      }

      const fade = Math.max(0, coin.lifetime / 5.0);
      (coin.mesh.material as THREE.MeshStandardMaterial).opacity = fade;
      (coin.mesh.material as THREE.MeshStandardMaterial).transparent = true;
      coin.mesh.scale.setScalar(0.8 + fade * 0.4);

      if (coin.lifetime <= 0) {
        this.scene.remove(coin.mesh);
        this.coins.splice(i, 1);
      }
    }
  }

  private updateDebris(dt: number) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const deb = this.debris[i];
      deb.lifetime += dt;
      deb.mesh.position.addScaledVector(deb.velocity, dt);
      deb.mesh.rotation.x += deb.angularVelocity.x * dt;
      deb.mesh.rotation.y += deb.angularVelocity.y * dt;
      deb.velocity.y -= 25 * dt;

      if (deb.mesh.position.y <= 0.2) {
        deb.mesh.position.y = 0.2;
        deb.velocity.y *= -0.3;
        deb.velocity.x *= 0.6;
        deb.velocity.z *= 0.6;
      }

      const progress = deb.lifetime / deb.maxLifetime;
      deb.mesh.scale.setScalar(1 - progress);
      if (progress >= 1) {
        this.scene.remove(deb.mesh);
        this.debris.splice(i, 1);
      }
    }
  }

  private updateSpawning(dt: number) {
    if (this.waveTransitionTimer > 0) {
      this.waveTransitionTimer -= dt;
      return;
    }
    
    if (this.enemiesToSpawnInWave > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = Math.max(0.6, 2.2 - this.wave * 0.15);
        this.spawnEnemy();
      }
    } else if (this.enemies.length === 0 && !this.isGameOver && this.waveTransitionTimer <= 0) {
      soundEngine.playKillExplosion();
      const lang = this.settings.language;
      this.spawnFloatingText(
        lang === 'zh' ? "虚拟局完成！获得提现奖励！" : "WAVE COMPLETE! CASH OUT BONUS!",
        new THREE.Vector3(0, 8, -12),
        "#d4a373",
        true,
        2.2
      );
      this.cashOutScore += this.wave * 1500;
      
      if (this.pendingWaveTimeout) {
        clearTimeout(this.pendingWaveTimeout);
      }
      
      this.waveTransitionTimer = 3.5;
      this.pendingWaveTimeout = setTimeout(() => {
        this.pendingWaveTimeout = null;
        if (!this.isGameOver && this.waveTransitionTimer <= 0) {
          this.startWave(this.wave + 1);
        }
      }, 3500);
    }
  }

  private updateCameraAndViewModel(dt: number) {
    this.cameraGroup.position.copy(this.playerPos);

    if (this.screenShakeIntensity > 0) {
      const shakeX = (Math.random() - 0.5) * 0.04 * this.screenShakeIntensity;
      const shakeY = (Math.random() - 0.5) * 0.04 * this.screenShakeIntensity;
      const shakeZ = (Math.random() - 0.5) * 0.04 * this.screenShakeIntensity;
      this.cameraGroup.position.add(new THREE.Vector3(shakeX, shakeY, shakeZ));
      this.screenShakeIntensity = Math.max(0, this.screenShakeIntensity - dt * 45);
    }

    // Spring-damper camera recoil. Proper integration: F = -k*x - c*v.
    const k = this.isAiming ? 85 : 55;     // spring stiffness (snappier recovery when ADS)
    const c = this.isAiming ? 18 : 13;     // damping coefficient
    const apply = (x: number, v: number): [number, number] => {
      const force = -k * x - c * v;
      const nv = v + force * dt;
      const nx = x + nv * dt;
      return [nx, nv];
    };
    [this.recoilPitch, this.recoilVelPitch] = apply(this.recoilPitch, this.recoilVelPitch);
    [this.recoilYaw,   this.recoilVelYaw]   = apply(this.recoilYaw,   this.recoilVelYaw);
    [this.recoilRoll,  this.recoilVelRoll]  = apply(this.recoilRoll,  this.recoilVelRoll);
    // Clamp so extreme recoil bursts don't blow the camera past sane angles.
    const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));
    this.recoilPitch = clamp(this.recoilPitch, 0.55);
    this.recoilYaw   = clamp(this.recoilYaw,   0.35);
    this.recoilRoll  = clamp(this.recoilRoll,  0.25);

    const euler = new THREE.Euler(this.playerPitch + this.recoilPitch, this.playerYaw + this.recoilYaw, this.recoilRoll, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    // ===== THIRD-PERSON CAMERA (mesh shield mode) =====
    const wantTP = this.isShieldActive;
    this.thirdPersonProgress += ((wantTP ? 1 : 0) - this.thirdPersonProgress) * Math.min(1, dt * 8);
    const tp = this.thirdPersonProgress * this.thirdPersonProgress * (3 - 2 * this.thirdPersonProgress);

    if (tp > 0.001) {
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler);
      const right = new THREE.Vector3(1, 0, 0).applyEuler(euler);
      // Over-the-shoulder offset: pull back, up, and slightly right
      const camOffset = forward.clone().multiplyScalar(-3.4 * tp)
        .add(new THREE.Vector3(0, 0.5 * tp, 0))
        .add(right.clone().multiplyScalar(0.75 * tp));
      this.camera.position.copy(camOffset);
    } else {
      this.camera.position.set(0, 0, 0);
    }

    // Update world-space shield + player body
    this.updateShieldTransform();
    this.updatePlayerBody(dt, tp);

    // Hide first-person gun/hands when in third person
    this.gunGroup.visible = tp < 0.5;

    this.adsProgress += ((this.isAiming ? 1 : 0) - this.adsProgress) * Math.min(1, dt * 14);
    const ads = this.adsProgress * this.adsProgress * (3 - 2 * this.adsProgress);
    const adsProfile = this.getADSProfile();
    const opticCfg = this.getSelectedOpticConfig();
    const targetFov = Math.max(45, this.settings.fov - ads * opticCfg.fovReduction);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 12);
    this.camera.updateProjectionMatrix();

    if (this.gunRecoilZ > 0) {
      this.gunRecoilZ = Math.max(0, this.gunRecoilZ - dt * 1.5);
    }
    if (this.gunRecoilPitch > 0) {
      this.gunRecoilPitch = Math.max(0, this.gunRecoilPitch - dt * 1.2);
    }

    const bobX = Math.sin(this.gunBobTimer) * 0.015 * (1 - ads * 0.9);
    const bobY = Math.abs(Math.cos(this.gunBobTimer)) * 0.015 * (1 - ads * 0.9);

    const hip = { x: 0.35 + bobX, y: -0.32 - bobY - (this.isReloading ? 0.15 : 0), z: -0.65 };
    const kick = this.gunRecoilZ * (1 - ads * 0.35);
    this.gunGroup.position.set(
      THREE.MathUtils.lerp(hip.x, adsProfile.x, ads),
      THREE.MathUtils.lerp(hip.y, adsProfile.y, ads),
      THREE.MathUtils.lerp(hip.z, adsProfile.z, ads) + kick
    );
    this.gunGroup.rotation.set(
      THREE.MathUtils.lerp(0, adsProfile.rx, ads) + this.gunRecoilPitch * (1 - ads * 0.25) + (this.isReloading ? -0.4 : 0),
      THREE.MathUtils.lerp(0, adsProfile.ry, ads),
      THREE.MathUtils.lerp(0, adsProfile.rz, ads)
    );

    // Show optic view-model only when ADS is substantially raised.
    if (this.opticGroup) {
      this.opticGroup.visible = ads > 0.55;
      if (this.opticGroup.visible) {
        const op = THREE.MathUtils.smoothstep(ads, 0.55, 0.95);
        this.opticGroup.traverse(o => {
          if ((o as THREE.Mesh).material && ((o as THREE.Mesh).material as THREE.Material).transparent) {
            ((o as THREE.Mesh).material as THREE.Material).opacity = op * 0.9;
          }
        });
      }
    }

    if (this.rightHandGroup) {
      const rightRecoilTwitch = this.gunRecoilZ * 2.5;
      const idleSwayX = Math.sin(performance.now() * 0.0008) * 0.002;
      const idleSwayZ = Math.sin(performance.now() * 0.0012) * 0.001;

      this.rightHandGroup.position.set(
        0.12 + idleSwayX + rightRecoilTwitch * 0.3,
        -0.06 + idleSwayZ - (this.isReloading ? 0.05 : 0),
        0.08 + (this.isReloading ? 0.04 : 0)
      );

      this.rightHandGroup.rotation.set(
        this.gunRecoilPitch * 1.8,
        rightRecoilTwitch * 0.15,
        idleSwayX * 2
      );
    }

    if (this.leftHandGroup) {
      const leftRecoilTwitch = this.gunRecoilZ * 1.2;
      const idleSwayX = Math.sin(performance.now() * 0.0008 + 0.5) * 0.003;
      const idleSwayZ = Math.sin(performance.now() * 0.0012 + 0.5) * 0.002;

      this.leftHandGroup.position.set(
        -0.1 + idleSwayX + leftRecoilTwitch * 0.15,
        -0.02 + idleSwayZ,
        -0.35 + leftRecoilTwitch * 0.4 + (this.isReloading ? -0.06 : 0)
      );

      this.leftHandGroup.rotation.set(
        this.gunRecoilPitch * 1.2,
        -leftRecoilTwitch * 0.1,
        idleSwayX * 1.5
      );

      if (this.leftForearm) {
        this.leftForearm.rotation.x = 0.15 + (this.isReloading ? -0.25 : 0);
      }
    }

    if (this.rightForearm) {
      this.rightForearm.rotation.x = Math.sin(this.playerPitch * 0.3) * 0.08 + (this.isReloading ? 0.15 : 0);
    }
  }

  private notifyUI() {
    if (!this.onUIUpdate) return;
    if (this.hitMarkerState.active && (performance.now() - this.hitMarkerState.timestamp > 200)) {
      this.hitMarkerState = { active: false, isCrit: false, isKill: false, timestamp: 0 };
    }
    if (this.killFeed && performance.now() - this.killFeed.timestamp > 3000) {
      this.killFeed = null;
    }
    const wConfig = this.getWeaponTuning();
    this.onUIUpdate({
      hp: this.currentHp,
      maxHp: this.maxHp,
      ammo: this.ammo,
      maxAmmo: wConfig.maxMagazine,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? 1 - (this.reloadTimer / (wConfig.reloadTime / this.upgrades.reloadSpeedMultiplier)) : 0,
      burstCount: this.burstShotsFired,
      isRotatingCylinder: this.cylinderRotateTimer > 0,
      skillCooldown: Math.max(0, this.skillCooldownTimer),
      isCharging: this.isCharging,
      isAiming: this.isAiming,
      isShieldActive: this.isShieldActive,
      shieldHp: this.shieldHp,
      maxShieldHp: this.maxShieldHp,
      isClawActive: this.isClawActive,
      chargeProgress: this.isCharging ? this.chargeTimer / 2.2 : 0,
      cashOut: this.cashOutScore,
      wave: this.wave,
      enemiesRemaining: this.enemies.length + this.enemiesToSpawnInWave,
      combo: this.comboCount,
      hitMarker: this.hitMarkerState,
      damageFlash: this.damageFlashTimer > 0 ? this.damageFlashTimer / 0.4 : 0,
      enemyHPBars: this.getEnemyHPBars(),
      selectedWeapon: this.selectedWeapon,
      selectedSkill: this.selectedSkill,
      killFeed: this.killFeed,
      gadgetSlots: this.settings.gadgetSlots,
      selectedGadgetSlot: this.selectedGadgetSlot,
      gadgetAmmo: [...this.gadgetAmmo],
      gadgetRespawnTimers: [...this.gadgetRespawnTimers],
    });
  }

  // PUBLIC ACTIONS
  public setLoadout(weapon: SelectedWeapon, skill: SelectedSkill, optic?: SelectedOptic) {
    this.selectedWeapon = weapon;
    this.selectedSkill = skill;
    if (optic) this.selectedOptic = optic;
    const wConfig = this.getWeaponTuning();
    this.ammo = wConfig.maxMagazine;
    this.burstShotsFired = 0;
    this.burstCooldownTimer = 0;
    this.cylinderRotateTimer = 0;
    this.buildGunViewModel();
    // Rebuild the third-person body so its class accent matches the new weapon
    if (this.playerBodyGroup) {
      this.scene.remove(this.playerBodyGroup);
      this.playerBodyGroup = null;
    }
    this.buildPlayerBody();
  }

  public getScoreStats() {
    return {
      cashOut: this.cashOutScore,
      wave: this.wave,
      kills: this.totalKills,
      accuracy: Math.round((this.shotsHit / Math.max(1, (this.shotsFired * (this.selectedWeapon === 'sa1216' ? 8 : 1)))) * 100),
      timeSurvived: `${Math.floor(this.timeSurvived / 60)}m ${Math.floor(this.timeSurvived % 60)}s`,
      weapon: this.selectedWeapon,
      skill: this.selectedSkill,
    };
  }

  public applyUpgrade(item: keyof PlayerUpgrades | 'heal') {
    if (item === 'heal') {
      this.currentHp = Math.min(this.maxHp, this.currentHp + 150);
      soundEngine.playCoin();
      return;
    }
    if (item === 'reloadSpeedMultiplier') this.upgrades.reloadSpeedMultiplier += 0.25;
    if (item === 'skillCooldownReduction') this.upgrades.skillCooldownReduction += 1.5;
    if (item === 'magnetRadius') this.upgrades.magnetRadius += 5.0;
    if (item === 'maxHpBonus') {
      this.upgrades.maxHpBonus += 100;
      this.maxHp += 100;
      this.currentHp = this.maxHp;
    }
    if (item === 'movementSpeedBonus') this.upgrades.movementSpeedBonus += 0.15;
    soundEngine.playCoin();
  }

  public spendCash(amount: number): boolean {
    if (this.cashOutScore >= amount) {
      this.cashOutScore -= amount;
      return true;
    }
    return false;
  }

  public addCash(amount: number) {
    this.cashOutScore += amount;
    soundEngine.playCoin();
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (paused) {
      document.exitPointerLock?.();
    }
  }

  public setSettings(newSettings: Partial<GameSettings>) {
    this.settings = { 
      ...this.settings, 
      ...newSettings,
      cheats: newSettings.cheats ? { ...this.settings.cheats, ...newSettings.cheats } : this.settings.cheats
      ,debug: newSettings.debug ? { 
        weapons: { ...this.settings.debug.weapons, ...newSettings.debug.weapons },
        skills: { ...this.settings.debug.skills, ...newSettings.debug.skills },
        enemies: { ...this.settings.debug.enemies, ...newSettings.debug.enemies },
      } : this.settings.debug
    };
    if (newSettings.fov) {
      this.camera.fov = newSettings.fov;
      this.camera.updateProjectionMatrix();
    }
    if (newSettings.volume !== undefined) {
      soundEngine.setVolume(newSettings.volume);
    }
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  public restartGame() {
    if (this.pendingWaveTimeout) {
      clearTimeout(this.pendingWaveTimeout);
      this.pendingWaveTimeout = null;
    }
    this.waveTransitionTimer = 0;
    
    this.enemies.forEach(e => this.scene.remove(e.mesh));
    this.coins.forEach(c => this.scene.remove(c.mesh));
    this.debris.forEach(d => this.scene.remove(d.mesh));
    this.enemyProjectiles.forEach(p => this.scene.remove(p.mesh));
    this.flameParticles.forEach(f => this.scene.remove(f.mesh));
    if (this.clawChainParticle) this.scene.remove(this.clawChainParticle.mesh);

    this.enemies = [];
    this.coins = [];
    this.debris = [];
    this.enemyProjectiles = [];
    this.floatingTexts = [];
    this.enemyHPBars = [];
    this.flameParticles = [];
    this.clawChainParticle = null;
    this.killFeed = null;
    this.isAiming = false;
    this.isClawActive = false;
    this.isShieldActive = false;
    // Reset third-person / shield visuals
    this.thirdPersonProgress = 0;
    if (this.shieldMesh) this.shieldMesh.visible = false;
    if (this.playerBodyGroup) this.playerBodyGroup.visible = false;
    if (this.gunGroup) this.gunGroup.visible = true;
    this.camera.position.set(0, 0, 0);
    
    // Reset gadget system
    this.thrownGadgets.forEach(g => this.scene.remove(g.mesh));
    this.activeEffects.forEach(e => { if (e.mesh) this.scene.remove(e.mesh); });
    this.thrownGadgets = [];
    this.activeEffects = [];
    this.initGadgetAmmo();

    this.maxHp = 350 + this.upgrades.maxHpBonus;
    this.currentHp = this.maxHp;
    this.ammo = this.getWeaponTuning().maxMagazine;
    this.burstShotsFired = 0;
    this.cashOutScore = 0;
    this.comboCount = 0;
    this.totalKills = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.timeSurvived = 0;
    this.wave = 1;
    this.enemiesToSpawnInWave = this.getEnemyTuning().spawnBase;
    this.spawnTimer = 2.0;
    this.lastKillSoundTime = 0;

    this.playerPos.set(0, 2, 0);
    this.playerVel.set(0, 0, 0);

    this.spawnCoverObstacles();
    this.startWave(1);
  }

  public getFloatingTexts() {
    return this.floatingTexts.filter(ft => ft.lifetime < ft.maxLifetime);
  }

  public getEnemyHPBars() {
    return this.enemyHPBars;
  }

  public destroy() {
    cancelAnimationFrame(this.animFrameId);
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
