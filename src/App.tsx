import { useState, useRef, useEffect, useCallback } from 'react';
import { ArenaEngine, UIStateCallback } from './game/ArenaEngine';
import { GameState, GameSettings, PlayerUpgrades, SelectedWeapon, SelectedSkill, SelectedOptic } from './game/types';
import { DEFAULT_DEBUG_TUNING, GADGET_CONFIGS } from './game/constants';
import { StartScreen } from './components/StartScreen';

// Expose gadget configs to HUD
(window as any).__GADGET_CONFIGS = GADGET_CONFIGS;
import { HUD } from './components/HUD';
import { ShopModal } from './components/ShopModal';
import { PauseModal } from './components/PauseModal';
import { GameOverModal } from './components/GameOverModal';
import { soundEngine } from './utils/sound';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ArenaEngine | null>(null);

  const [selectedWeapon, setSelectedWeapon] = useState<SelectedWeapon>('sa1216');
  const [selectedSkill, setSelectedSkill] = useState<SelectedSkill>('charge_slam');
  const [selectedOptic, setSelectedOptic] = useState<SelectedOptic>('reddot');

  const [uiState, setUiState] = useState<UIStateCallback>({
    hp: 350,
    maxHp: 350,
    ammo: 16,
    maxAmmo: 16,
    isReloading: false,
    reloadProgress: 0,
    burstCount: 0,
    isRotatingCylinder: false,
    skillCooldown: 0,
    isCharging: false,
    isAiming: false,
    isShieldActive: false,
    shieldHp: 600,
    maxShieldHp: 600,
    isClawActive: false,
    chargeProgress: 0,
    cashOut: 0,
    wave: 1,
    enemiesRemaining: 8,
    combo: 0,
    hitMarker: { active: false, isCrit: false, isKill: false, timestamp: 0 },
    damageFlash: 0,
    enemyHPBars: [],
    selectedWeapon: 'sa1216',
    selectedSkill: 'charge_slam',
    killFeed: null,
    gadgetSlots: ['frag_grenade', 'health_shot', 'smoke_grenade', null],
    selectedGadgetSlot: 0,
    gadgetAmmo: [2, 3, 3, null],
    gadgetRespawnTimers: [null, null, null, null],
  });

  const [settings, setSettings] = useState<GameSettings>({
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
  });

  const [upgrades, setUpgrades] = useState<PlayerUpgrades>({
    reloadSpeedMultiplier: 1.0,
    skillCooldownReduction: 0,
    magnetRadius: 5.0,
    maxHpBonus: 0,
    movementSpeedBonus: 0,
  });

  const handleUIUpdate = useCallback((newUiState: UIStateCallback) => {
    setUiState(newUiState);
    if (newUiState.hp <= 0 && gameState !== 'GAMEOVER' && gameState !== 'MENU') {
      setGameState('GAMEOVER');
    }
  }, [gameState]);

  // Initialize or Cleanup Engine
  useEffect(() => {
    if (gameState !== 'MENU' && containerRef.current && !engineRef.current) {
      const engine = new ArenaEngine(containerRef.current, selectedWeapon, selectedSkill, selectedOptic, handleUIUpdate);
      engine.setSettings(settings);
      engineRef.current = engine;
    }

    return () => {
      if (gameState === 'MENU' && engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, [gameState, handleUIUpdate, selectedWeapon, selectedSkill, settings]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (key === 'escape' || key === 'p') {
        if (gameState === 'PLAYING') {
          engineRef.current?.setPaused(true);
          setGameState('PAUSED');
          soundEngine.playUI();
        } else if (gameState === 'PAUSED' || gameState === 'SHOP') {
          engineRef.current?.setPaused(false);
          setGameState('PLAYING');
          soundEngine.playUI();
        }
      }

      if (key === 'b') {
        if (gameState === 'PLAYING') {
          engineRef.current?.setPaused(true);
          setGameState('SHOP');
          soundEngine.playUI();
        } else if (gameState === 'SHOP') {
          engineRef.current?.setPaused(false);
          setGameState('PLAYING');
          soundEngine.playUI();
        }
      }

      if (key === 'r' && gameState === 'GAMEOVER') {
        handleRestart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const handleStartGame = (
    selectedSettings: GameSettings,
    useTouch: boolean,
    weapon: SelectedWeapon,
    skill: SelectedSkill,
    optic: SelectedOptic
  ) => {
    setSettings(selectedSettings);
    setIsTouchDevice(useTouch);
    setSelectedWeapon(weapon);
    setSelectedSkill(skill);
    setSelectedOptic(optic);
    if (engineRef.current) {
      engineRef.current.setLoadout(weapon, skill, optic);
    }
    setGameState('PLAYING');
  };

  const handleSelectLoadout = (weapon: SelectedWeapon, skill: SelectedSkill, optic: SelectedOptic) => {
    setSelectedWeapon(weapon);
    setSelectedSkill(skill);
    setSelectedOptic(optic);
    if (engineRef.current) {
      engineRef.current.setLoadout(weapon, skill, optic);
    }
  };

  const handleResume = () => {
    engineRef.current?.setPaused(false);
    setGameState('PLAYING');
  };

  const handleRestart = () => {
    if (engineRef.current) {
      engineRef.current.restartGame();
      engineRef.current.setPaused(false);
    } else if (containerRef.current) {
      const engine = new ArenaEngine(containerRef.current, selectedWeapon, selectedSkill, selectedOptic, handleUIUpdate);
      engine.setSettings(settings);
      engineRef.current = engine;
    }
    setGameState('PLAYING');
  };

  const handleHome = () => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    setGameState('MENU');
  };

  const handleOpenShop = () => {
    if (engineRef.current) {
      engineRef.current.setPaused(true);
    }
    setGameState('SHOP');
  };

  const handleBuyUpgrade = (id: keyof PlayerUpgrades | 'heal', cost: number): boolean => {
    if (!engineRef.current) return false;
    if (engineRef.current.spendCash(cost)) {
      engineRef.current.applyUpgrade(id);
      if (id !== 'heal') {
        setUpgrades(prev => {
          const next = { ...prev };
          if (id === 'reloadSpeedMultiplier') next.reloadSpeedMultiplier += 0.25;
          if (id === 'skillCooldownReduction') next.skillCooldownReduction += 1.5;
          if (id === 'magnetRadius') next.magnetRadius += 5.0;
          if (id === 'maxHpBonus') next.maxHpBonus += 100;
          if (id === 'movementSpeedBonus') next.movementSpeedBonus += 0.15;
          return next;
        });
      }
      return true;
    }
    return false;
  };

  const handleUpdateSettings = (newSettings: Partial<GameSettings>) => {
    setSettings(prev => ({ 
      ...prev, 
      ...newSettings,
      cheats: newSettings.cheats ? { ...prev.cheats, ...newSettings.cheats } : prev.cheats,
      debug: newSettings.debug ? {
        weapons: { ...prev.debug.weapons, ...newSettings.debug.weapons },
        skills: { ...prev.debug.skills, ...newSettings.debug.skills },
        enemies: { ...prev.debug.enemies, ...newSettings.debug.enemies },
      } : prev.debug
    }));
    if (engineRef.current) {
      engineRef.current.setSettings(newSettings);
    }
  };

  const handleAddCash = (amt: number) => {
    if (engineRef.current) {
      engineRef.current.addCash(amt);
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0d0e15] text-white relative select-none font-finals">
      {/* 3D WEBGL RENDERING CONTAINER */}
      <div 
        ref={containerRef} 
        className={`w-full h-full absolute inset-0 ${gameState === 'MENU' ? 'hidden' : 'block'}`}
      />

      {/* START SCREEN MENU */}
      {gameState === 'MENU' && (
        <StartScreen 
          onStartGame={handleStartGame} 
          initialSettings={settings}
          selectedWeapon={selectedWeapon}
          selectedSkill={selectedSkill}
          selectedOptic={selectedOptic}
          onSelectLoadout={handleSelectLoadout}
        />
      )}

      {/* IN-GAME HUD OVERLAY */}
      {gameState !== 'MENU' && (
        <HUD
          uiState={uiState}
          engine={engineRef.current}
          onOpenShop={handleOpenShop}
          onPause={() => {
            engineRef.current?.setPaused(true);
            setGameState('PAUSED');
            soundEngine.playUI();
          }}
          isTouchDevice={isTouchDevice}
          language={settings.language}
        />
      )}

      {/* SHOP MODAL */}
      {gameState === 'SHOP' && (
        <ShopModal
          cashOut={uiState.cashOut}
          onBuyUpgrade={handleBuyUpgrade}
          onClose={handleResume}
          upgrades={upgrades}
          language={settings.language}
        />
      )}

      {/* PAUSE MODAL */}
      {gameState === 'PAUSED' && (
        <PauseModal
          onResume={handleResume}
          onRestart={handleRestart}
          onHome={handleHome}
          onOpenShop={handleOpenShop}
          onAddCash={handleAddCash}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />
      )}

      {/* GAME OVER MODAL */}
      {gameState === 'GAMEOVER' && engineRef.current && (
        <GameOverModal
          stats={engineRef.current.getScoreStats()}
          onRestart={handleRestart}
          onHome={handleHome}
          language={settings.language}
        />
      )}
    </div>
  );
}
