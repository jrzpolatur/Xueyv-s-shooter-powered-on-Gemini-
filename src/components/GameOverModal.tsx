import React, { useEffect, useState } from 'react';
import { RotateCcw, Home, Trophy, DollarSign, Crosshair, Skull, Clock } from 'lucide-react';
import { HighScoreRecord, SelectedWeapon, SelectedSkill, Language } from '../game/types';
import confetti from 'canvas-confetti';
import { soundEngine } from '../utils/sound';

interface GameOverModalProps {
  stats: {
    cashOut: number;
    wave: number;
    kills: number;
    accuracy: number;
    timeSurvived: string;
    weapon?: SelectedWeapon;
    skill?: SelectedSkill;
  };
  onRestart: () => void;
  onHome: () => void;
  language?: Language;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ stats, onRestart, onHome, language = 'zh' }) => {
  const [isNewRecord, setIsNewRecord] = useState(false);
  const isZh = language === 'zh';

  useEffect(() => {
    soundEngine.playKillExplosion();

    const saved = localStorage.getItem('finals_highscores');
    let scores: HighScoreRecord[] = [];
    if (saved) {
      try { scores = JSON.parse(saved); } catch { scores = []; }
    }

    const maxPrevious = scores.length > 0 ? Math.max(...scores.map(s => s.cashOut)) : 0;
    if (stats.cashOut > maxPrevious && stats.cashOut > 0) {
      setIsNewRecord(true);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#d4a373', '#ee3366', '#319795', '#ffffff'],
      });
    }

    const newRecord: HighScoreRecord = {
      id: Math.random().toString(),
      date: isZh ? `第 ${stats.wave} 局实战模拟` : `WAVE ${stats.wave} SIMULATION`,
      cashOut: stats.cashOut,
      wave: stats.wave,
      kills: stats.kills,
      timeSurvived: stats.timeSurvived,
      weapon: stats.weapon || 'sa1216',
      skill: stats.skill || 'charge_slam',
    };

    const updated = [newRecord, ...scores].sort((a, b) => b.cashOut - a.cashOut).slice(0, 10);
    localStorage.setItem('finals_highscores', JSON.stringify(updated));
  }, [stats, isZh]);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-lg z-50 flex items-center justify-center p-4 select-none font-finals overflow-y-auto">
      <div className="bg-[#11131a] border-2 border-[#ee3366] w-full max-w-xl p-6 sm:p-8 flex flex-col items-center relative my-8 shadow-2xl">
        {isNewRecord && (
          <div className="absolute -top-4 bg-[#d4a373] text-black font-black text-xs px-4 py-1 uppercase tracking-widest animate-bounce shadow-lg flex items-center gap-1.5">
            <Trophy className="w-4 h-4 fill-black" />
            <span>{isZh ? '刷新历史最高提现记录！' : 'NEW PERSONAL BEST CASH OUT RECORD!'}</span>
          </div>
        )}

        <div className="text-xs bg-[#ee3366] text-white font-black px-3 py-0.5 uppercase tracking-widest mt-2 mb-1">
          {isZh ? '比赛终局' : 'MATCH TERMINATED'}
        </div>
        <h2 className="text-4xl font-black text-white tracking-tighter">
          {isZh ? '最终提现总额' : 'CASH OUT TOTAL'}
        </h2>

        {/* CASH OUT BIG DISPLAY */}
        <div className="bg-[#181b26] border border-[#d4a373] px-8 py-3.5 my-5 flex items-center gap-3 w-full justify-center shadow-md">
          <DollarSign className="w-9 h-9 text-[#d4a373]" />
          <span className="text-4xl sm:text-5xl font-black text-[#d4a373] tracking-tighter">
            ${stats.cashOut.toLocaleString()}
          </span>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-2 gap-3 w-full my-2 font-sans text-xs">
          <div className="bg-[#181b26] border border-gray-800 p-3.5 flex items-center gap-3">
            <div className="p-2 bg-[#d4a373]/10 border border-[#d4a373] text-[#d4a373]">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-gray-400 font-bold">{isZh ? '最高局数' : 'WAVE REACHED'}</div>
              <div className="text-xl font-black text-white font-finals">WAVE {stats.wave}</div>
            </div>
          </div>

          <div className="bg-[#181b26] border border-gray-800 p-3.5 flex items-center gap-3">
            <div className="p-2 bg-[#ee3366]/10 border border-[#ee3366] text-[#ee3366]">
              <Skull className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-gray-400 font-bold">{isZh ? '击杀数量' : 'HOSTILES KILLED'}</div>
              <div className="text-xl font-black text-white font-finals">{stats.kills}</div>
            </div>
          </div>

          <div className="bg-[#181b26] border border-gray-800 p-3.5 flex items-center gap-3">
            <div className="p-2 bg-[#319795]/10 border border-[#319795] text-[#319795]">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-gray-400 font-bold">{isZh ? '命中精度' : 'ACCURACY'}</div>
              <div className="text-xl font-black text-[#319795] font-finals">{stats.accuracy}%</div>
            </div>
          </div>

          <div className="bg-[#181b26] border border-gray-800 p-3.5 flex items-center gap-3">
            <div className="p-2 bg-white/10 border border-white text-white">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-gray-400 font-bold">{isZh ? '存活时长' : 'TIME SURVIVED'}</div>
              <div className="text-xl font-black text-white font-finals">{stats.timeSurvived}</div>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="w-full flex flex-col sm:flex-row gap-3 mt-5">
          <button
            onClick={() => { soundEngine.playUI(); onRestart(); }}
            className="flex-1 bg-[#d4a373] hover:bg-white text-black font-black text-lg py-3 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            <span>{isZh ? '再战一局 (R键)' : 'PLAY AGAIN (R)'}</span>
          </button>

          <button
            onClick={() => { soundEngine.playUI(); onHome(); }}
            className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-6 py-3 flex items-center justify-center gap-2 border border-gray-700 transition cursor-pointer text-xs"
          >
            <Home className="w-4 h-4" />
            <span>{isZh ? '主菜单' : 'MENU'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
