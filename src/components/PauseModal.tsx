import React from 'react';
import { Play, RotateCcw, Home, ShoppingBag, Settings, TerminalSquare } from 'lucide-react';
import { GameSettings } from '../game/types';
import { soundEngine } from '../utils/sound';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
  onOpenShop: () => void;
  onAddCash?: (amt: number) => void;
  settings: GameSettings;
  onUpdateSettings: (s: Partial<GameSettings>) => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onHome,
  onOpenShop,
  onAddCash,
  settings,
  onUpdateSettings,
}) => {
  const isZh = settings.language === 'zh';

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none font-finals">
      <div className="bg-[#11131a] border-2 border-[#d4a373] w-full max-w-lg p-6 flex flex-col items-center shadow-2xl">
        <div className="text-xs bg-[#d4a373] text-black font-black px-3 py-0.5 uppercase tracking-widest mb-1">
          {isZh ? '比赛暂停中' : 'PAUSED'}
        </div>
        <h2 className="text-3xl font-black text-white tracking-tight">
          {isZh ? '比赛已暂停' : 'SIMULATION PAUSED'}
        </h2>

        {/* SETTINGS ADJUSTMENTS */}
        <div className="w-full bg-[#181b26] border border-gray-800 p-4 my-4 space-y-3 font-sans text-xs">
          <div className="flex items-center justify-between text-[#319795] font-bold text-sm border-b border-gray-800 pb-1.5 font-finals">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span>{isZh ? '实时竞技设置' : 'ON-THE-FLY TUNING'}</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between font-bold text-gray-300 mb-1">
              <span>{isZh ? '灵敏度' : 'SENSITIVITY'}</span>
              <span className="text-[#319795]">{settings.sensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.1"
              value={settings.sensitivity}
              onChange={(e) => onUpdateSettings({ sensitivity: parseFloat(e.target.value) })}
              className="w-full accent-[#319795] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between font-bold text-gray-300 mb-1">
              <span>{isZh ? '视野 FOV' : 'FIELD OF VIEW (FOV)'}</span>
              <span className="text-[#d4a373]">{settings.fov}°</span>
            </div>
            <input
              type="range"
              min="70"
              max="110"
              step="2"
              value={settings.fov}
              onChange={(e) => onUpdateSettings({ fov: parseInt(e.target.value) })}
              className="w-full accent-[#d4a373] cursor-pointer"
            />
          </div>

          {/* QUICK DEV CHEATS TOGGLES */}
          <div className="pt-2 border-t border-gray-800">
            <div className="flex items-center gap-1.5 text-[#cc4422] font-bold mb-2 font-finals">
              <TerminalSquare className="w-4 h-4" />
              <span>{isZh ? '控制台快捷作弊开关' : 'DEV CONSOLE CHEATS'}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateSettings({
                  cheats: { ...settings.cheats, godMode: !settings.cheats.godMode }
                })}
                className={`p-1.5 border text-center font-bold transition cursor-pointer ${
                  settings.cheats.godMode ? 'bg-[#cc4422] text-white border-[#cc4422]' : 'bg-[#0d0e15] text-gray-400 border-gray-700'
                }`}
              >
                {isZh ? '无敌' : 'GOD'}: {settings.cheats.godMode ? 'ON' : 'OFF'}
              </button>

              <button
                onClick={() => onUpdateSettings({
                  cheats: { ...settings.cheats, infiniteAmmo: !settings.cheats.infiniteAmmo }
                })}
                className={`p-1.5 border text-center font-bold transition cursor-pointer ${
                  settings.cheats.infiniteAmmo ? 'bg-[#cc4422] text-white border-[#cc4422]' : 'bg-[#0d0e15] text-gray-400 border-gray-700'
                }`}
              >
                {isZh ? '无限弹药' : 'AMMO'}: {settings.cheats.infiniteAmmo ? 'ON' : 'OFF'}
              </button>

              {onAddCash && (
                <button
                  onClick={() => onAddCash(100000)}
                  className="p-1.5 border border-[#d4a373] bg-[#d4a373]/20 text-[#d4a373] font-bold col-span-2 hover:bg-[#d4a373] hover:text-black transition cursor-pointer"
                >
                  +{isZh ? '注入 $100,000 现金' : 'INJECT $100,000 CASH'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={() => { soundEngine.playUI(); onResume(); }}
            className="w-full bg-[#d4a373] hover:bg-white text-black font-black text-lg py-3 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Play className="w-5 h-5 fill-black" />
            <span>{isZh ? '继续比赛 (ESC)' : 'RESUME MATCH (ESC)'}</span>
          </button>

          <button
            onClick={() => { soundEngine.playUI(); onOpenShop(); }}
            className="w-full bg-[#319795]/20 border border-[#319795] hover:bg-[#319795] hover:text-white text-[#319795] font-black text-base py-2.5 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>{isZh ? '打开提现升级商店 (B键)' : 'OPEN UPGRADE SHOP (B)'}</span>
          </button>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={() => { soundEngine.playUI(); onRestart(); }}
              className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 flex items-center justify-center gap-2 border border-gray-700 transition cursor-pointer text-xs"
            >
              <RotateCcw className="w-4 h-4 text-[#ee3366]" />
              <span>{isZh ? '重新开始' : 'RESTART'}</span>
            </button>
            <button
              onClick={() => { soundEngine.playUI(); onHome(); }}
              className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 flex items-center justify-center gap-2 border border-gray-700 transition cursor-pointer text-xs"
            >
              <Home className="w-4 h-4 text-[#d4a373]" />
              <span>{isZh ? '主菜单' : 'MAIN MENU'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
