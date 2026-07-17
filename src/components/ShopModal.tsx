import React, { useState } from 'react';
import { DollarSign, Zap, RotateCcw, Flame, Hammer, Magnet, Shield, Activity, Heart, X, Check } from 'lucide-react';
import { UpgradeItem, PlayerUpgrades, Language } from '../game/types';
import { INITIAL_UPGRADE_ITEMS } from '../game/constants';
import { soundEngine } from '../utils/sound';

interface ShopModalProps {
  cashOut: number;
  onBuyUpgrade: (id: keyof PlayerUpgrades | 'heal', cost: number) => boolean;
  onClose: () => void;
  upgrades: PlayerUpgrades;
  language?: Language;
}

export const ShopModal: React.FC<ShopModalProps> = ({ cashOut, onBuyUpgrade, onClose, upgrades, language = 'zh' }) => {
  const [items, setItems] = useState<UpgradeItem[]>(INITIAL_UPGRADE_ITEMS);
  const [lastBoughtId, setLastBoughtId] = useState<string | null>(null);

  const isZh = language === 'zh';

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Heart': return <Heart className="w-6 h-6 text-[#ee3366]" />;
      case 'Zap': return <Zap className="w-6 h-6 text-[#319795]" />;
      case 'RotateCcw': return <RotateCcw className="w-6 h-6 text-[#319795]" />;
      case 'Flame': return <Flame className="w-6 h-6 text-[#cc4422]" />;
      case 'Hammer': return <Hammer className="w-6 h-6 text-[#d4a373]" />;
      case 'Magnet': return <Magnet className="w-6 h-6 text-[#319795]" />;
      case 'Shield': return <Shield className="w-6 h-6 text-[#d4a373]" />;
      case 'Activity': return <Activity className="w-6 h-6 text-[#ee3366]" />;
      default: return <DollarSign className="w-6 h-6 text-[#d4a373]" />;
    }
  };

  const getLevelDisplay = (id: keyof PlayerUpgrades | 'heal') => {
    if (id === 'heal') return isZh ? '即时单次' : 'INSTANT';
    if (id === 'reloadSpeedMultiplier') return `LVL ${Math.round((upgrades.reloadSpeedMultiplier - 1.0) / 0.25)}`;
    if (id === 'skillCooldownReduction') return `LVL ${Math.round(upgrades.skillCooldownReduction / 1.5)}`;
    if (id === 'magnetRadius') return `LVL ${Math.round((upgrades.magnetRadius - 5.0) / 5.0)}`;
    if (id === 'maxHpBonus') return `+${upgrades.maxHpBonus} HP`;
    if (id === 'movementSpeedBonus') return `+${Math.round(upgrades.movementSpeedBonus * 100)}%`;
    return '';
  };

  const handleBuy = (item: UpgradeItem) => {
    if (item.id !== 'heal' && item.level >= item.maxLevel) return;
    if (cashOut < item.cost) {
      soundEngine.playHit(false);
      return;
    }

    const success = onBuyUpgrade(item.id, item.cost);
    if (success) {
      setLastBoughtId(item.id);
      setTimeout(() => setLastBoughtId(null), 1000);
      if (item.id !== 'heal') {
        setItems(items.map(i => i.id === item.id ? { ...i, level: i.level + 1, cost: Math.round(i.cost * 1.4) } : i));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 select-none font-finals">
      <div className="bg-[#11131a] border-2 border-[#d4a373] w-full max-w-4xl max-h-[90vh] flex flex-col relative shadow-xl">
        {/* HEADER */}
        <div className="bg-[#181b26] border-b border-gray-800 p-5 flex justify-between items-center">
          <div>
            <div className="text-[#d4a373] text-xs font-black tracking-widest uppercase">
              {isZh ? '选手提现终端 // 升级工具库' : 'VIRTUAL TERMINAL // UPGRADE DEPOT'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
              {isZh ? '提现商店 (CASH OUT SHOP)' : 'CASH OUT SHOP'}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-black/60 border border-[#d4a373] px-4 py-1.5 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#d4a373]" />
              <span className="text-xl font-black text-[#d4a373]">${cashOut.toLocaleString()}</span>
            </div>
            <button
              onClick={onClose}
              className="bg-gray-800 hover:bg-gray-700 text-white p-2 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ITEMS GRID */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          {items.map(item => {
            const isMax = item.id !== 'heal' && item.level >= item.maxLevel;
            const canAfford = cashOut >= item.cost;
            const justBought = lastBoughtId === item.id;

            return (
              <div
                key={item.id}
                className={`border p-4 flex flex-col justify-between transition relative ${
                  isMax
                    ? 'bg-black/40 border-gray-800 opacity-60'
                    : canAfford
                    ? 'bg-[#181b26] border-gray-700 hover:border-[#d4a373]'
                    : 'bg-[#14151c] border-gray-800 opacity-80'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-black/50 border border-gray-800">
                        {getIcon(item.icon)}
                      </div>
                      <div>
                        <h4 className="font-black text-white text-base tracking-tight">
                          {isZh ? item.titleZh : item.titleEn}
                        </h4>
                        <span className="text-xs font-bold text-[#d4a373] bg-[#d4a373]/10 px-2 py-0.5 inline-block mt-0.5">
                          {getLevelDisplay(item.id)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-300 mt-3 font-sans leading-relaxed">
                    {isZh ? item.descriptionZh : item.descriptionEn}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800 flex justify-between items-center text-xs">
                  <span className="text-gray-400 font-bold uppercase">{isZh ? '价格:' : 'PRICE:'}</span>
                  {isMax ? (
                    <span className="bg-gray-800 text-gray-400 font-black px-3 py-1 text-xs">
                      {isZh ? '已满级' : 'MAXED OUT'}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleBuy(item)}
                      disabled={!canAfford}
                      className={`px-4 py-2 font-black flex items-center gap-2 transition cursor-pointer ${
                        justBought
                          ? 'bg-[#d4a373] text-black scale-105'
                          : canAfford
                          ? 'bg-[#d4a373] hover:bg-white text-black active:scale-95'
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {justBought ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>{isZh ? '已安装!' : 'INSTALLED!'}</span>
                        </>
                      ) : (
                        <>
                          <span>{isZh ? '购买' : 'BUY'}</span>
                          <span className="font-extrabold">${item.cost.toLocaleString()}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="bg-[#181b26] border-t border-gray-800 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#d4a373] hover:bg-white text-black font-black px-6 py-2.5 text-sm transition cursor-pointer"
          >
            {isZh ? '返回战场 (RESUME)' : 'RETURN TO ARENA'}
          </button>
        </div>
      </div>
    </div>
  );
};
