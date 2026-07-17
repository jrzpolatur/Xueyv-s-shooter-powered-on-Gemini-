import React, { useEffect, useState } from 'react';
import { UIStateCallback, ArenaEngine } from '../game/ArenaEngine';
import { Heart, DollarSign, Pause, ShoppingBag, Flame } from 'lucide-react';
import { WEAPON_CONFIGS, SKILL_CONFIGS } from '../game/constants';
import { Language } from '../game/types';
import * as THREE from 'three';

interface HUDProps {
  uiState: UIStateCallback;
  engine: ArenaEngine | null;
  onOpenShop: () => void;
  onPause: () => void;
  isTouchDevice: boolean;
  language?: Language;
}

export const HUD: React.FC<HUDProps> = ({ uiState, engine, onOpenShop, onPause, isTouchDevice, language = 'zh' }) => {
  const [floatingTexts2D, setFloatingTexts2D] = useState<{ id: string; text: string; x: number; y: number; color: string; scale: number }[]>([]);
  const [enemyHPBars2D, setEnemyHPBars2D] = useState<Array<{ id: string; hpPercent: number; color: number; x: number; y: number; opacity: number; visible: boolean }>>([]);

  const isZh = language === 'zh';

  useEffect(() => {
    if (!engine) return;
    const interval = setInterval(() => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const cam = (engine as unknown as { camera: THREE.PerspectiveCamera }).camera;
      
      const texts3D = engine.getFloatingTexts();
      if (texts3D.length && cam) {
        const projected = texts3D.map(t => {
          const vec = t.position.clone();
          vec.project(cam);
          const x = (vec.x * 0.5 + 0.5) * width;
          const y = (-(vec.y * 0.5) + 0.5) * height;
          return {
            id: t.id,
            text: t.text,
            x,
            y,
            color: t.color,
            scale: t.scale,
            visible: vec.z < 1.0 && x > 0 && x < width && y > 0 && y < height,
          };
        }).filter(t => t.visible);
        setFloatingTexts2D(projected);
      } else {
        setFloatingTexts2D([]);
      }

      const hpBars3D = engine.getEnemyHPBars();
      if (hpBars3D.length && cam) {
        const projectedBars = hpBars3D.map(bar => {
          const vec = bar.position.clone();
          vec.project(cam);
          const x = (vec.x * 0.5 + 0.5) * width;
          const y = (-(vec.y * 0.5) + 0.5) * height;
          const opacity = Math.max(0, 1 - bar.lifetime / 2.0);
          return {
            id: bar.id,
            hpPercent: bar.hpPercent,
            color: bar.color,
            x,
            y,
            opacity,
            visible: vec.z < 1.0 && x > 0 && x < width && y > 0 && y < height,
          };
        }).filter(b => b.visible);
        setEnemyHPBars2D(projectedBars);
      } else {
        setEnemyHPBars2D([]);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [engine]);

  const hpPercent = Math.max(0, Math.min(100, (uiState.hp / uiState.maxHp) * 100));
  const burstShotsRemaining = 4 - (uiState.burstCount % 4);
  const selectedWConfig = WEAPON_CONFIGS[uiState.selectedWeapon || 'sa1216'];
  const selectedSConfig = SKILL_CONFIGS[uiState.selectedSkill || 'charge_slam'];

  return (
    <div className="absolute inset-0 pointer-events-none select-none font-finals overflow-hidden">
      {/* Damage Flash Vignette */}
      {uiState.damageFlash > 0 && (
        <div 
          className="absolute inset-0 bg-red-600 pointer-events-none transition-opacity duration-100"
          style={{ opacity: uiState.damageFlash * 0.35 }}
        />
      )}

      {/* ADS sight picture: this is the scoped/iron-sight view, not a neck-zoom. */}
      {uiState.isAiming && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_38%,rgba(0,0,0,0.35)_70%,rgba(0,0,0,0.7)_100%)]" />
          <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
          {uiState.selectedWeapon === 'xp54' ? (
            <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff2348] shadow-[0_0_10px_#ff2348]" />
          ) : (
            <>
              <div className="absolute left-1/2 top-1/2 h-10 w-[2px] -translate-x-1/2 translate-y-1 bg-white/70" />
              <div className="absolute left-1/2 top-1/2 h-[2px] w-8 -translate-x-1/2 -translate-y-1/2 bg-white/55" />
            </>
          )}
        </div>
      )}

      {/* Floating 3D Damage & Cash Numbers */}
      {floatingTexts2D.map(t => (
        <div
          key={t.id}
          className="absolute font-finals font-black tracking-wider pointer-events-none"
          style={{
            left: `${t.x}px`,
            top: `${t.y}px`,
            color: t.color,
            transform: `translate(-50%, -100%) scale(${t.scale})`,
            textShadow: '0 2px 8px rgba(0,0,0,0.9)',
            fontSize: `${18 * t.scale}px`,
            opacity: 1,
            transition: 'opacity 0.1s, transform 0.1s',
          }}
        >
          {t.text}
        </div>
      ))}

      {/* Enemy HP Bars (THE FINALS style - shows for 2 seconds after hit) */}
      {enemyHPBars2D.filter(b => b.visible).map(bar => (
        <div
          key={bar.id}
          className="absolute pointer-events-none"
          style={{
            left: `${bar.x}px`,
            top: `${bar.y}px`,
            transform: 'translate(-50%, -100%)',
            opacity: bar.opacity,
            zIndex: 50,
          }}
        >
          <div className="w-28 h-2.5 bg-[#0a0b0e]/90 border border-gray-600 relative overflow-hidden shadow-md">
            <div
              className="h-full transition-all duration-100 ease-out"
              style={{
                width: `${Math.max(0, bar.hpPercent * 100)}%`,
                backgroundColor: `#${bar.color.toString(16).padStart(6, '0')}`,
                boxShadow: `0 0 6px #${bar.color.toString(16).padStart(6, '0')}80`,
              }}
            />
          </div>
        </div>
      ))}

      {/* TOP BAR */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-auto">
        {/* Left: Wave & Enemies */}
        <div className="flex flex-col gap-1">
          <div className="bg-[#141722]/90 border border-[#d4a373] px-4 py-1.5 flex items-center gap-3 shadow-md">
            <span className="text-[#d4a373] text-base tracking-wider font-black">
              {isZh ? `第 ${uiState.wave} 局比赛` : `WAVE ${uiState.wave.toString().padStart(2, '0')}`}
            </span>
            <div className="w-[1px] h-4 bg-gray-600" />
            <span className="text-white text-xs tracking-wide">
              {isZh ? '剩余敌方:' : 'HOSTILES:'} <span className="text-[#ee3366] font-bold text-sm">{uiState.enemiesRemaining}</span>
            </span>
          </div>
        </div>

        {/* Center: CASH OUT SCORE */}
        <div className="flex flex-col items-center">
          <div className="bg-[#141722]/95 border border-[#d4a373] px-6 py-1.5 flex items-center gap-3 shadow-lg">
            <DollarSign className="w-6 h-6 text-[#d4a373]" />
            <span className="text-2xl sm:text-3xl text-[#d4a373] font-black tracking-tighter">
              ${uiState.cashOut.toLocaleString()}
            </span>
            <span className="text-[10px] bg-[#d4a373] text-black font-extrabold px-1.5 py-0.5 ml-1">CASH OUT</span>
          </div>
          {uiState.combo > 1 && (
            <div className="mt-1 bg-[#ee3366] text-white font-black text-xs px-2.5 py-0.5 tracking-wider shadow">
              {uiState.combo}X {isZh ? '提现倍率奖金' : 'COMBO BONUS'}
            </div>
          )}
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenShop}
            className="bg-[#141722]/90 border border-[#319795] hover:bg-[#319795]/20 text-[#319795] p-2 flex items-center gap-2 transition cursor-pointer pointer-events-auto"
            title="Open Cash Upgrade Shop"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-bold">{isZh ? '商店 (B)' : 'SHOP (B)'}</span>
          </button>
          <button
            onClick={onPause}
            className="bg-[#141722]/90 border border-gray-600 hover:border-white text-white p-2 transition cursor-pointer pointer-events-auto"
            title="Pause Game"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* THIRD-PERSON SHIELD MODE INDICATOR */}
      {uiState.isShieldActive && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="flex items-center gap-2 bg-[#1fb8d0]/20 border border-[#3fd8e8] px-3 py-1 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-[#3fd8e8] animate-pulse" />
            <span className="text-xs font-black tracking-widest text-[#3fd8e8] uppercase">
              {isZh ? '第三人称 · 网格护盾' : 'THIRD PERSON · MESH SHIELD'}
            </span>
          </div>
        </div>
      )}

      {/* CENTER DYNAMIC CROSSHAIR & HIT MARKER */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
        {/* Center Dot */}
        {!uiState.isAiming && <div className="w-1.5 h-1.5 bg-[#d4a373] rounded-full shadow-[0_0_6px_#d4a373]" />}
        
        {/* Corner Brackets */}
        {!uiState.isAiming && <div className={`absolute w-8 h-8 border border-white/40 transition-all duration-75 ${uiState.isReloading ? 'scale-150 rotate-45 border-[#319795]' : 'scale-100'}`} style={{ clipPath: 'polygon(0 0, 30% 0, 30% 10%, 10% 10%, 10% 30%, 0 30%, 0 0, 70% 0, 100% 0, 100% 30%, 90% 30%, 90% 10%, 70% 10%, 70% 0, 100% 70%, 100% 100%, 70% 100%, 70% 90%, 90% 90%, 90% 70%, 100% 70%, 0 70%, 10% 70%, 10% 90%, 30% 90%, 30% 100%, 0 100%, 0 70%)' }} />}

        {/* HIT MARKER EFFECT */}
        {uiState.hitMarker.active && (
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{
              opacity: Math.max(0, 1 - (performance.now() - uiState.hitMarker.timestamp) / 200),
              transition: 'opacity 0.05s linear',
            }}
          >
            <div className={`w-8 h-8 border-2 ${
              uiState.hitMarker.isKill
                ? 'border-[#ee3366]' 
                : uiState.hitMarker.isCrit 
                  ? 'border-[#d4a373]' 
                  : 'border-white'
            }`} 
              style={{
                clipPath: 'polygon(30% 0%, 35% 0%, 50% 35%, 65% 0%, 70% 0%, 50% 40%, 35% 70%, 50% 45%, 50% 100%, 45% 100%, 50% 55%, 15% 100%, 10% 100%, 50% 20%, 0% 100%, -5% 100%, 50% 50%, 85% 100%, 90% 100%, 50% 5%, 100% 100%, 95% 100%, 50% 50%, 0% 70%, 0% 65%, 35% 50%, 0% 35%, 0% 30%, 35% 50%, 0% 0%, 5% 0%, 50% 30%)',
              }}
            />
          </div>
        )}

        {/* Target Indicator Text */}
        {uiState.hitMarker.isKill && (performance.now() - uiState.hitMarker.timestamp < 400) && (
          <div className="absolute top-8 text-[#ee3366] font-black text-xs tracking-widest bg-black/80 px-2 py-0.5 border border-[#ee3366]">
            {isZh ? '已击败敌人! +现金' : 'ELIMINATED! +CASH'}
          </div>
        )}
      </div>

      {/* KILL FEED MESSAGE */}
      {uiState.killFeed?.active && (
        <div
          className="absolute left-1/2 bottom-24 -translate-x-1/2 pointer-events-none text-center"
          style={{
            opacity: Math.max(0, 1 - (performance.now() - uiState.killFeed.timestamp) / 3000),
            transition: 'opacity 0.2s linear',
          }}
        >
          <div className="text-xl sm:text-2xl font-black tracking-wider">
            <span className="text-[#ee3366]">{isZh ? '淘汰' : 'ELIMINATED'}</span>
            <span className="text-white"> {uiState.killFeed.id}</span>
          </div>
        </div>
      )}

      {/* BOTTOM LEFT: HEALTH BAR */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-1 w-72 sm:w-80">
        <div className="flex justify-between items-end text-xs">
          <div className="flex items-center gap-1.5 text-[#d4a373]">
            <Heart className="w-4 h-4 fill-[#d4a373]" />
            <span className="font-extrabold tracking-wider">{isZh ? '泰坦选手生命值' : 'HEAVY TITAN HP'}</span>
          </div>
          <span className="text-lg font-black">{uiState.hp} / {uiState.maxHp}</span>
        </div>
        <div className="w-full h-5 bg-[#141722] border border-gray-700 p-0.5 relative overflow-hidden">
          <div 
            className="h-full transition-all duration-150 bg-gradient-to-r from-[#ee3366] via-[#d4a373] to-[#319795]"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* BOTTOM CENTER: SPECIALIZATION SKILL BAR */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className={`relative bg-[#141722]/95 border p-2.5 flex items-center gap-3 transition-all ${
          uiState.isCharging || uiState.isShieldActive ? 'border-[#d4a373] scale-105' : uiState.skillCooldown === 0 ? 'border-[#319795]' : 'border-gray-700 opacity-70'
        }`}>
          <div className={`w-10 h-10 flex items-center justify-center text-lg font-black border ${
            uiState.isCharging || uiState.isShieldActive ? 'bg-[#d4a373] text-black border-white' : uiState.skillCooldown === 0 ? 'bg-[#319795]/20 text-[#319795] border-[#319795]' : 'bg-gray-800 text-gray-400 border-gray-600'
          }`}>
            Q
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-[#d4a373] font-black tracking-wider uppercase">
              {isZh ? selectedSConfig.nameZh : selectedSConfig.nameEn}
            </span>
            {uiState.isCharging ? (
              <span className="text-xs font-black text-white animate-pulse">{isZh ? '冲撞中! 随时下砸!' : 'RUSHING! SLAM ANYTIME!'}</span>
            ) : uiState.isShieldActive ? (
              <span className="text-xs font-black text-[#319795] animate-pulse">
                {isZh ? `网格护盾开启 (${uiState.shieldHp} HP)` : `MESH SHIELD ACTIVE (${uiState.shieldHp} HP)`}
              </span>
            ) : uiState.skillCooldown === 0 ? (
              <span className="text-xs font-bold text-[#319795]">{isZh ? '就绪 (按Q键/右键)' : 'READY (PRESS Q / R-CLICK)'}</span>
            ) : (
              <span className="text-xs font-bold text-gray-400">{isZh ? '冷却中:' : 'COOLDOWN:'} {uiState.skillCooldown.toFixed(1)}s</span>
            )}
          </div>
        </div>
      </div>

      {/* GADGET BAR (bottom center-right) */}
      <div className="absolute bottom-24 right-1/4 flex gap-2">
        {engine && [0, 1, 2, 3].map(slot => {
          const info = engine.getGadgetSlotInfo()[slot];
          if (!info || !info.gadgetId) return null;
          const cfg = (window as any).__GADGET_CONFIGS?.[info.gadgetId];
          if (!cfg) return null;
          const isSelected = info.selected;
          const isReloading = info.respawnTimer !== null && info.respawnTimer > 0;
          return (
            <button
              key={slot}
              onClick={() => engine.selectGadgetSlot(slot)}
              className={`relative w-16 h-16 border-2 flex flex-col items-center justify-center cursor-pointer transition-all ${
                isSelected
                  ? 'border-[#18c7dc] bg-[#18c7dc]/20 scale-110'
                  : 'border-gray-700 bg-black/60 hover:border-gray-500'
              }`}
            >
              <div className="text-xl">{cfg.icon}</div>
              <div className="absolute bottom-0.5 left-0.5 text-[9px] font-black text-white bg-black/80 px-1">
                {slot + 1}
              </div>
              <div className="absolute top-0.5 right-0.5 text-[9px] font-black text-white">
                {info.ammo !== null ? info.ammo : '∞'}
              </div>
              {isReloading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <div className="text-[8px] font-black text-[#18c7dc]">{Math.ceil(info.respawnTimer!)}s</div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* BOTTOM RIGHT: WEAPON HUD */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-400 font-bold tracking-wider uppercase">
            {isZh ? selectedWConfig.nameZh : selectedWConfig.nameEn}
          </span>
          <Flame className="w-3.5 h-3.5 text-[#d4a373]" />
        </div>

        <div className="bg-[#141722]/95 border border-[#d4a373] px-4 py-2 flex items-center gap-3 shadow-md">
          {/* SA1216 Burst Indicator */}
          {uiState.selectedWeapon === 'sa1216' && (
            <div className="flex flex-col items-end border-r border-gray-700 pr-3">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-2.5 h-4 transition-all duration-75 ${
                      i < burstShotsRemaining && !uiState.isRotatingCylinder && !uiState.isReloading
                        ? 'bg-[#d4a373]'
                        : 'bg-gray-800 border border-gray-700'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[9px] text-gray-400 mt-0.5 uppercase font-bold">
                {uiState.isRotatingCylinder ? (isZh ? '旋转弹匣中...' : 'SPINNING...') : uiState.isReloading ? (isZh ? '换弹中...' : 'RELOADING...') : (isZh ? '4连发爆发' : '4-BURST')}
              </span>
            </div>
          )}

          {/* Ammo Count */}
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-white tracking-tighter">{uiState.ammo}</span>
            <span className="text-sm text-gray-500 font-bold">/ {selectedWConfig.maxMagazine}</span>
          </div>
        </div>
      </div>

      {/* MOBILE TOUCH CONTROLS */}
      {isTouchDevice && (
        <div className="absolute inset-0 pointer-events-auto flex justify-between items-end p-6 pb-24 z-50">
          <div
            className="w-36 h-36 bg-white/10 border border-white/30 rounded-full flex items-center justify-center relative touch-none"
            onTouchStart={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              const touch = e.touches[0];
              const dx = (touch.clientX - cx) / (rect.width / 2);
              const dy = (touch.clientY - cy) / (rect.height / 2);
              engine?.setJoystickInput(Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, dy)));
            }}
            onTouchMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              const touch = e.touches[0];
              const dx = (touch.clientX - cx) / (rect.width / 2);
              const dy = (touch.clientY - cy) / (rect.height / 2);
              engine?.setJoystickInput(Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, dy)));
            }}
            onTouchEnd={() => {
              engine?.setJoystickInput(0, 0);
            }}
          >
            <div className="w-14 h-14 bg-[#d4a373]/40 border border-[#d4a373] rounded-full pointer-events-none" />
          </div>

          <div className="flex flex-col gap-3 items-end">
            <div className="flex gap-2">
              <button
                className="w-14 h-14 bg-[#319795]/80 border border-white text-white text-xs font-black rounded-full flex items-center justify-center shadow-md active:scale-95"
                onTouchStart={() => engine?.initiateReload()}
              >
                {isZh ? '换弹' : 'RELOAD'}
              </button>
              <button
                className="w-14 h-14 bg-white/80 border border-white text-black text-xs font-black rounded-full flex items-center justify-center shadow-md active:scale-95"
                onTouchStart={() => {
                  const ev = new KeyboardEvent('keydown', { key: ' ' });
                  window.dispatchEvent(ev);
                }}
              >
                {isZh ? '跳跃' : 'JUMP'}
              </button>
            </div>
            
            <div className="flex gap-3 items-center">
              <button
                className={`w-18 h-18 border-2 font-black rounded-full flex flex-col items-center justify-center shadow-md transition-all ${
                  uiState.isCharging || uiState.isShieldActive ? 'bg-[#ee3366] text-white border-white animate-pulse' : uiState.skillCooldown === 0 ? 'bg-[#d4a373] text-black border-white' : 'bg-gray-800 text-gray-500 border-gray-600'
                }`}
                onTouchStart={() => engine?.triggerSpecializationSkill()}
              >
                <span className="text-[10px]">{isZh ? '绝招' : 'SKILL'}</span>
                <span className="text-xs">{isZh ? '技能' : 'ACT'}</span>
              </button>

              <button
                className="w-20 h-20 bg-[#ee3366] border-2 border-[#d4a373] text-white font-black text-xl rounded-full flex items-center justify-center shadow-md active:scale-95 select-none"
                onTouchStart={() => engine?.setFiring(true)}
                onTouchEnd={() => engine?.setFiring(false)}
              >
                {isZh ? '开火' : 'FIRE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
