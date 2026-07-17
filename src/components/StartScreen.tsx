import React, { useState, useEffect } from 'react';
import { Play, Trophy, Settings, Smartphone, Monitor, Crosshair, TerminalSquare, Shield, Zap, Anchor, CircleDot, Eye, Target } from 'lucide-react';
import { GameSettings, HighScoreRecord, SelectedWeapon, SelectedSkill, SelectedOptic, GadgetId } from '../game/types';
import { WEAPON_CONFIGS, SKILL_CONFIGS, OPTIC_CONFIGS, GADGET_CONFIGS } from '../game/constants';
import { soundEngine } from '../utils/sound';

interface StartScreenProps {
  onStartGame: (
    settings: GameSettings, useTouch: boolean,
    weapon: SelectedWeapon, skill: SelectedSkill, optic: SelectedOptic
  ) => void;
  initialSettings: GameSettings;
  selectedWeapon: SelectedWeapon;
  selectedSkill: SelectedSkill;
  selectedOptic: SelectedOptic;
  onSelectLoadout: (weapon: SelectedWeapon, skill: SelectedSkill, optic: SelectedOptic) => void;
}

type SlotKey = 'weapon' | 'skill' | 'optic' | 'gadget0' | 'gadget1' | 'gadget2' | 'gadget3' | null;

export const StartScreen: React.FC<StartScreenProps> = ({
  onStartGame, initialSettings,
  selectedWeapon, selectedSkill, selectedOptic,
  onSelectLoadout,
}) => {
  const [settings, setSettings] = useState<GameSettings>(initialSettings);
  const [useTouch, setUseTouch] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'deploy' | 'settings' | 'console' | 'scores'>('deploy');
  const [highScores, setHighScores] = useState<HighScoreRecord[]>([]);
  const [openSlot, setOpenSlot] = useState<SlotKey>(null);
  const [devTab, setDevTab] = useState<'cheats' | 'weapons' | 'skills' | 'enemies'>('cheats');
  const [selectedDevWeapon, setSelectedDevWeapon] = useState<SelectedWeapon>('sa1216');
  const [selectedDevSkill, setSelectedDevSkill] = useState<SelectedSkill>('charge_slam');

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || ('ontouchstart' in window);
    setUseTouch(isMobile);
    const saved = localStorage.getItem('finals_highscores');
    if (saved) { try { setHighScores(JSON.parse(saved)); } catch { setHighScores([]); } }
    else {
      const initial: HighScoreRecord[] = [
        { id: '1', date: 'VIRTUAL ARENA 01', cashOut: 45000, wave: 8, kills: 64, timeSurvived: '6m 12s', weapon: 'sa1216', skill: 'charge_slam' },
        { id: '2', date: 'MONACO SIMULATION', cashOut: 28500, wave: 5, kills: 38, timeSurvived: '4m 05s', weapon: 'lewis', skill: 'mesh_shield' },
      ];
      setHighScores(initial);
    }
  }, []);

  const isZh = settings.language === 'zh';
  const currentWeapon = WEAPON_CONFIGS[selectedWeapon];
  const currentSkill = SKILL_CONFIGS[selectedSkill];
  const currentOptic = OPTIC_CONFIGS[selectedOptic];

  const handleDeploy = () => {
    soundEngine.playKillExplosion();
    onStartGame(settings, useTouch, selectedWeapon, selectedSkill, selectedOptic);
  };

  // THE FINALS-style slot card
  const SlotCard = ({ label, icon, value, onClick, accent }: {
    label: string; icon: React.ReactNode; value: string; onClick: () => void; accent: string;
  }) => (
    <button
      onClick={() => { soundEngine.playUI(); onClick(); }}
      className={`group relative w-[120px] h-[140px] bg-[#0a0b10] border border-gray-800 hover:border-[${accent}] transition-all cursor-pointer overflow-hidden flex flex-col`}
    >
      {/* Diagonal corner flash */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity bg-gradient-to-br from-[${accent}] to-transparent`} />
      <div className="absolute top-1 left-1.5 text-[9px] tracking-widest font-black text-gray-500 uppercase">{label}</div>
      <div className="flex-1 flex items-center justify-center text-gray-300 group-hover:text-white transition-colors">
        {icon}
      </div>
      <div className={`px-2 py-1.5 bg-black/80 text-[10px] font-black uppercase tracking-wider border-t border-gray-800 text-[${accent}] truncate`}>
        {value}
      </div>
    </button>
  );

  return (
    <div className="absolute inset-0 text-white flex flex-col select-none font-finals overflow-hidden z-50">
      {/* === BACKGROUND: Diagonal cyan split like THE FINALS lobby === */}
      <div className="absolute inset-0 bg-[#06070a] pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(115deg, #06070a 0%, #06070a 38%, #0fb4c9 38.2%, #18c7dc 58%, #06070a 58.2%, #06070a 100%)',
          opacity: 0.85,
        }}
      />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_60%)]" />
      {/* Faint grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* === TOP BAR === */}
      <div className="relative z-10 flex items-center justify-between px-6 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-300">
          <div className="w-2 h-2 rounded-full bg-[#18c7dc] animate-pulse" />
          <span>{isZh ? '等待玩家连接' : 'WAITING FOR PLAYERS'} (1/12)</span>
        </div>
        {/* NAV TABS */}
        <div className="flex gap-1 text-[11px] font-black uppercase tracking-widest">
          {([
            { k: 'deploy',  zh: '部署',    en: 'DEPLOY',    icon: Play },
            { k: 'settings',zh: '设置',    en: 'SETTINGS',  icon: Settings },
            { k: 'console', zh: '控制台',  en: 'CONSOLE',   icon: TerminalSquare },
            { k: 'scores',  zh: '记录',    en: 'RECORDS',   icon: Trophy },
          ] as const).map(t => {
            const Icon = t.icon;
            const active = activeTab === t.k;
            return (
              <button
                key={t.k}
                onClick={() => { setActiveTab(t.k); soundEngine.playUI(); }}
                className={`px-3 py-1.5 border transition flex items-center gap-1.5 cursor-pointer ${
                  active ? 'bg-white text-black border-white' : 'bg-black/40 text-gray-300 border-white/10 hover:border-white/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{isZh ? t.zh : t.en}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 border-2 border-white flex items-center justify-center" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
              <div className="w-2 h-2 bg-white" />
            </div>
            <div className="text-right leading-none">
              <div className="text-lg font-black tracking-tighter text-white">THE FINALS</div>
              <div className="text-[9px] tracking-widest text-gray-400">VIRTUAL ARENA</div>
            </div>
          </div>
        </div>
      </div>

      {/* === MAIN CONTENT === */}
      <div className="relative z-10 flex-1 overflow-auto">
        {activeTab === 'deploy' && (
          <div className="h-full flex flex-col justify-between p-6">
            {/* Loadout identity strip */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-1">
                  {isZh ? '我的配装' : 'MY OUTFITS'}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-5xl font-black tracking-tighter text-white">
                    {isZh ? currentWeapon.nameZh.split(' ')[0] : currentWeapon.nameEn.split(' ')[0]}
                  </div>
                  <div className={`w-10 h-10 flex items-center justify-center text-2xl font-black border-2 ${
                    currentWeapon.weaponClass === 'H' ? 'bg-[#ee3366] border-white text-white' :
                    currentWeapon.weaponClass === 'M' ? 'bg-[#d4a373] border-white text-black' :
                                                       'bg-[#18c7dc] border-white text-black'
                  }`}>
                    {currentWeapon.weaponClass}
                  </div>
                </div>
              </div>

              {/* Live weapon spec sheet */}
              <div className="bg-black/60 border border-white/10 backdrop-blur px-4 py-3 min-w-[320px]">
                <div className="text-[10px] tracking-widest text-gray-400 uppercase mb-1">{isZh ? '武器规格' : 'WEAPON SPEC'}</div>
                <div className="text-xl font-black text-white">{isZh ? currentWeapon.nameZh : currentWeapon.nameEn}</div>
                <div className="text-[10px] text-[#18c7dc] uppercase tracking-wider mb-2">{isZh ? currentWeapon.typeZh : currentWeapon.typeEn}</div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <Spec label={isZh ? '伤害' : 'DMG'}  value={currentWeapon.damagePerShot} />
                  <Spec label={isZh ? '射速' : 'RPM'}  value={Math.round(60 / currentWeapon.fireRate)} />
                  <Spec label={isZh ? '弹匣' : 'MAG'}  value={currentWeapon.maxMagazine} />
                  <Spec label={isZh ? '射程' : 'RNG'}  value={`${currentWeapon.range}m`} />
                  <Spec label={isZh ? '换弹' : 'RLD'}  value={`${currentWeapon.reloadTime}s`} />
                  <Spec label={isZh ? '类别' : 'CLASS'} value={currentWeapon.weaponClass} />
                </div>
              </div>
            </div>

            {/* Center character placeholder (silhouette) */}
            <div className="flex-1 flex items-center justify-center relative my-4">
              <div className="relative">
                {/* Glow */}
                <div className="absolute inset-0 blur-3xl bg-[#18c7dc]/30 scale-110" />
                {/* Silhouette card */}
                <div className="relative w-[220px] h-[320px] border border-white/10 bg-gradient-to-b from-white/5 to-transparent flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center text-3xl font-black text-white/40">
                    {currentWeapon.weaponClass}
                  </div>
                  <div className="mt-3 text-[10px] tracking-widest text-gray-400 uppercase">
                    {isZh ? '选手预览' : 'CONTESTANT'}
                  </div>
                  <div className="mt-1 text-xs text-white/70">
                    {isZh ? currentWeapon.nameZh : currentWeapon.nameEn}
                  </div>
                  <div className="mt-1 text-[10px] text-[#18c7dc]">
                    + {isZh ? currentSkill.nameZh : currentSkill.nameEn}
                  </div>
                </div>
              </div>
            </div>

            {/* === THE FINALS BOTTOM BAR === */}
            <div className="bg-black/70 border border-white/10 p-3 flex items-stretch gap-2">
              {/* CONTESTANT slot (read-only) */}
              <div className="w-[120px] h-[140px] bg-[#0a0b10] border border-gray-800 flex flex-col">
                <div className="px-2 pt-1 text-[9px] tracking-widest font-black text-gray-500 uppercase">{isZh ? '选手' : 'CONTESTANT'}</div>
                <div className="flex-1 flex items-center justify-center">
                  <div className={`w-14 h-14 flex items-center justify-center text-3xl font-black ${
                    currentWeapon.weaponClass === 'H' ? 'bg-[#ee3366] text-white' :
                    currentWeapon.weaponClass === 'M' ? 'bg-[#d4a373] text-black' :
                                                       'bg-[#18c7dc] text-black'
                  }`}>
                    {currentWeapon.weaponClass}
                  </div>
                </div>
                <div className="px-2 py-1.5 bg-black/80 text-[10px] font-black uppercase tracking-wider border-t border-gray-800 text-white truncate">
                  {currentWeapon.weaponClass}{isZh ? ' 重型' : currentWeapon.weaponClass === 'M' ? ' 中型' : ' 轻型'}
                </div>
              </div>

              <Divider />

              <SlotCard
                label={isZh ? '绝招' : 'SPECIALIZATION'}
                icon={<SkillIcon id={selectedSkill} />}
                value={isZh ? currentSkill.nameZh : currentSkill.nameEn}
                onClick={() => setOpenSlot('skill')}
                accent="#18c7dc"
              />
              <SlotCard
                label={isZh ? '武器' : 'WEAPON'}
                icon={<WeaponIcon id={selectedWeapon} />}
                value={isZh ? currentWeapon.nameZh : currentWeapon.nameEn}
                onClick={() => setOpenSlot('weapon')}
                accent="#d4a373"
              />
              <SlotCard
                label={isZh ? '瞄具' : 'OPTIC'}
                icon={<OpticIcon id={selectedOptic} />}
                value={isZh ? currentOptic.nameZh : currentOptic.nameEn}
                onClick={() => setOpenSlot('optic')}
                accent="#66ffaa"
              />

              {/* Gadget Slots */}
              <div className="w-px self-stretch bg-white/10" />
              {[0, 1, 2, 3].map(slot => {
                const gadgetId = settings.gadgetSlots[slot];
                const cfg = gadgetId ? GADGET_CONFIGS[gadgetId] : null;
                return (
                  <SlotCard
                    key={slot}
                    label={isZh ? `道具${slot + 1}` : `GADGET${slot + 1}`}
                    icon={cfg ? <span className="text-2xl">{cfg.icon}</span> : <span className="text-xl text-gray-600">—</span>}
                    value={cfg ? (isZh ? cfg.nameZh : cfg.nameEn) : (isZh ? '空' : 'EMPTY')}
                    onClick={() => setOpenSlot(`gadget${slot}` as SlotKey)}
                    accent="#ff6600"
                  />
                );
              })}

              <div className="flex-1" />

              {/* DEPLOY button */}
              <button
                onClick={handleDeploy}
                className="px-8 bg-white text-black font-black text-xl tracking-widest hover:bg-[#18c7dc] transition cursor-pointer flex items-center gap-3 border-2 border-white"
              >
                <Play className="w-6 h-6 fill-black" />
                <span>{isZh ? '部署' : 'DEPLOY'}</span>
              </button>
            </div>

            {/* Control mode toggle */}
            <div className="mt-3 flex items-center justify-between text-[10px] tracking-widest uppercase">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setUseTouch(false); soundEngine.playUI(); }}
                  className={`px-3 py-1 border flex items-center gap-1.5 cursor-pointer ${
                    !useTouch ? 'bg-white text-black border-white' : 'bg-black/40 text-gray-400 border-white/10'
                  }`}
                >
                  <Monitor className="w-3 h-3" /><span>{isZh ? '键鼠' : 'DESKTOP'}</span>
                </button>
                <button
                  onClick={() => { setUseTouch(true); soundEngine.playUI(); }}
                  className={`px-3 py-1 border flex items-center gap-1.5 cursor-pointer ${
                    useTouch ? 'bg-white text-black border-white' : 'bg-black/40 text-gray-400 border-white/10'
                  }`}
                >
                  <Smartphone className="w-3 h-3" /><span>{isZh ? '触控' : 'MOBILE'}</span>
                </button>
              </div>
              <div className="text-gray-500">
                {isZh ? '左键开火 · 右键开镜 · Q 技能 · R 换弹' : 'LMB FIRE · RMB ADS · Q SKILL · R RELOAD'}
              </div>
            </div>
          </div>
        )}

        {/* === SLOT POPUP SELECTORS === */}
        {openSlot === 'weapon' && (
          <SelectorPopup
            title={isZh ? '选择武器' : 'SELECT WEAPON'}
            onClose={() => setOpenSlot(null)}
            items={(Object.keys(WEAPON_CONFIGS) as SelectedWeapon[]).map(id => ({
              id,
              label: isZh ? WEAPON_CONFIGS[id].nameZh : WEAPON_CONFIGS[id].nameEn,
              sub: isZh ? WEAPON_CONFIGS[id].typeZh : WEAPON_CONFIGS[id].typeEn,
              icon: <WeaponIcon id={id} />,
              corner: WEAPON_CONFIGS[id].weaponClass,
              selected: selectedWeapon === id,
            }))}
            onPick={(id) => { onSelectLoadout(id as SelectedWeapon, selectedSkill, selectedOptic); setOpenSlot(null); }}
            accent="#d4a373"
          />
        )}
        {openSlot === 'skill' && (
          <SelectorPopup
            title={isZh ? '选择绝招' : 'SELECT SPECIALIZATION'}
            onClose={() => setOpenSlot(null)}
            items={(Object.keys(SKILL_CONFIGS) as SelectedSkill[]).map(id => ({
              id,
              label: isZh ? SKILL_CONFIGS[id].nameZh : SKILL_CONFIGS[id].nameEn,
              sub: `${SKILL_CONFIGS[id].cooldown}s CD`,
              icon: <SkillIcon id={id} />,
              selected: selectedSkill === id,
            }))}
            onPick={(id) => { onSelectLoadout(selectedWeapon, id as SelectedSkill, selectedOptic); setOpenSlot(null); }}
            accent="#18c7dc"
          />
        )}
        {openSlot === 'optic' && (
          <SelectorPopup
            title={isZh ? '选择瞄具' : 'SELECT OPTIC'}
            onClose={() => setOpenSlot(null)}
            items={(Object.keys(OPTIC_CONFIGS) as SelectedOptic[]).map(id => ({
              id,
              label: isZh ? OPTIC_CONFIGS[id].nameZh : OPTIC_CONFIGS[id].nameEn,
              sub: `${isZh ? '放大' : 'ZOOM'} -${OPTIC_CONFIGS[id].fovReduction}° FOV`,
              icon: <OpticIcon id={id} />,
              selected: selectedOptic === id,
            }))}
            onPick={(id) => { onSelectLoadout(selectedWeapon, selectedSkill, id as SelectedOptic); setOpenSlot(null); }}
            accent="#66ffaa"
          />
        )}
        {[0, 1, 2, 3].map(slot => openSlot === `gadget${slot}` && (
          <SelectorPopup
            key={slot}
            title={`${isZh ? '选择道具' : 'SELECT GADGET'} #${slot + 1}`}
            onClose={() => setOpenSlot(null)}
            items={[null as GadgetId | null, ...(Object.keys(GADGET_CONFIGS) as GadgetId[])].map(id => ({
              id: id || 'empty',
              label: id ? (isZh ? GADGET_CONFIGS[id].nameZh : GADGET_CONFIGS[id].nameEn) : (isZh ? '空' : 'EMPTY'),
              sub: id ? `${GADGET_CONFIGS[id].maxAmmo} ${isZh ? '枚' : 'PCS'}` : '',
              icon: id ? <span className="text-3xl">{GADGET_CONFIGS[id].icon}</span> : <span className="text-xl text-gray-600">—</span>,
              selected: settings.gadgetSlots[slot] === id,
            }))}
            onPick={(id) => {
              const newSlots = [...settings.gadgetSlots];
              newSlots[slot] = id === 'empty' ? null : id as GadgetId;
              setSettings({ ...settings, gadgetSlots: newSlots });
              setOpenSlot(null);
            }}
            accent="#ff6600"
          />
        ))}

        {/* === SETTINGS TAB === */}
        {activeTab === 'settings' && (
          <SettingsTab settings={settings} setSettings={setSettings} isZh={isZh} />
        )}

        {/* === CONSOLE TAB === */}
        {activeTab === 'console' && (
          <ConsoleTab
            settings={settings} setSettings={setSettings} isZh={isZh}
            devTab={devTab} setDevTab={setDevTab}
            selectedDevWeapon={selectedDevWeapon} setSelectedDevWeapon={setSelectedDevWeapon}
            selectedDevSkill={selectedDevSkill} setSelectedDevSkill={setSelectedDevSkill}
          />
        )}

        {/* === SCORES TAB === */}
        {activeTab === 'scores' && (
          <div className="p-6 max-w-4xl mx-auto">
            <div className="bg-black/60 border border-white/10 p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <h2 className="text-2xl font-black tracking-tighter text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#d4a373]" />
                  {isZh ? '最高提现纪录' : 'TOP CASH OUT RECORDS'}
                </h2>
                <span className="text-[10px] tracking-widest text-gray-400 uppercase">HALL OF FAME</span>
              </div>
              {highScores.length === 0 ? (
                <p className="text-center text-gray-500 py-8">{isZh ? '暂无比赛纪录。' : 'No records yet.'}</p>
              ) : (
                <div className="space-y-2">
                  {highScores.map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between bg-black/40 border border-white/5 p-3 hover:border-[#d4a373] transition">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-black text-[#d4a373] w-6">#{i + 1}</span>
                        <div>
                          <div className="font-bold text-white">{s.date}</div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                            {s.weapon.toUpperCase()} · {s.skill.replace('_', ' ').toUpperCase()} · {s.timeSurvived} · {s.kills} {isZh ? '击杀' : 'KILLS'}
                          </div>
                        </div>
                      </div>
                      <div className="text-2xl font-black text-[#d4a373]">${s.cashOut.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================================================== */
/* Helper components                                            */
/* =========================================================== */

const Spec = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="bg-black/40 border border-white/5 px-2 py-1.5">
    <div className="text-gray-500 uppercase tracking-widest text-[8px]">{label}</div>
    <div className="text-white font-black text-sm">{value}</div>
  </div>
);

const Divider = () => <div className="w-px self-stretch bg-white/10" />;

const WeaponIcon = ({ id }: { id: SelectedWeapon }) => {
  // Stylised SVG silhouettes per weapon family
  const paths: Record<SelectedWeapon, React.ReactNode> = {
    sa1216:     <ShotgunSvg />,
    lewis:      <LMGSvg />,
    flamethrower:<FlameThrowerSvg />,
    cl40:       <LauncherSvg />,
    xp54:       <SMGSvg />,
    fcar:       <RifleSvg />,
    m60:        <LMGSvg />,
    m11:        <PistolSvg />,
    pike556:    <DMRSvg />,
  };
  return <div className="w-20 h-12 flex items-center justify-center">{paths[id]}</div>;
};

const SkillIcon = ({ id }: { id: SelectedSkill }) => {
  if (id === 'charge_slam') return <Zap className="w-8 h-8" />;
  if (id === 'mesh_shield') return <Shield className="w-8 h-8" />;
  return <Anchor className="w-8 h-8" />;
};

const OpticIcon = ({ id }: { id: SelectedOptic }) => {
  if (id === 'reddot') return <CircleDot className="w-8 h-8" />;
  if (id === 'holo')   return <Target className="w-8 h-8" />;
  if (id === 'acog')   return <Crosshair className="w-8 h-8" />;
  if (id === 'scope4x')return <Eye className="w-8 h-8" />;
  return <div className="w-8 h-0.5 bg-white/80" />;
};

/* ---- SVG silhouettes ---- */
const ShotgunSvg = () => (
  <svg viewBox="0 0 80 30" className="w-full h-full" fill="currentColor">
    <rect x="6" y="12" width="50" height="6" />
    <rect x="18" y="6" width="18" height="8" rx="1" />
    <rect x="56" y="13" width="20" height="4" />
    <rect x="10" y="18" width="8" height="8" />
  </svg>
);
const LMGSvg = () => (
  <svg viewBox="0 0 80 30" className="w-full h-full" fill="currentColor">
    <rect x="4" y="13" width="60" height="5" />
    <circle cx="32" cy="10" r="7" />
    <rect x="64" y="14" width="14" height="3" />
    <rect x="10" y="18" width="6" height="7" />
  </svg>
);
const FlameThrowerSvg = () => (
  <svg viewBox="0 0 80 30" className="w-full h-full" fill="currentColor">
    <rect x="6" y="10" width="50" height="8" rx="2" />
    <circle cx="18" cy="22" r="4" />
    <circle cx="30" cy="22" r="4" />
    <rect x="56" y="12" width="20" height="4" />
  </svg>
);
const LauncherSvg = () => (
  <svg viewBox="0 0 80 30" className="w-full h-full" fill="currentColor">
    <rect x="8" y="11" width="50" height="8" rx="2" />
    <rect x="20" y="19" width="30" height="4" />
    <rect x="10" y="22" width="8" height="6" />
  </svg>
);
const SMGSvg = () => (
  <svg viewBox="0 0 80 30" className="w-full h-full" fill="currentColor">
    <rect x="14" y="12" width="40" height="6" />
    <rect x="54" y="13" width="16" height="4" />
    <rect x="22" y="18" width="6" height="10" />
  </svg>
);
const RifleSvg = () => (
  <svg viewBox="0 0 80 30" className="w-full h-full" fill="currentColor">
    <rect x="6" y="13" width="52" height="5" />
    <rect x="58" y="14" width="18" height="3" />
    <rect x="20" y="8" width="14" height="5" />
    <rect x="22" y="18" width="6" height="9" />
    <rect x="4" y="13" width="6" height="5" />
  </svg>
);
const PistolSvg = () => (
  <svg viewBox="0 0 80 30" className="w-full h-full" fill="currentColor">
    <rect x="24" y="10" width="28" height="6" />
    <rect x="26" y="16" width="10" height="10" />
    <rect x="52" y="12" width="6" height="2" />
  </svg>
);
const DMRSvg = () => (
  <svg viewBox="0 0 80 30" className="w-full h-full" fill="currentColor">
    <rect x="4" y="13" width="60" height="4" />
    <rect x="64" y="14" width="14" height="2" />
    <rect x="22" y="8" width="18" height="5" />
    <rect x="24" y="17" width="6" height="9" />
    <rect x="2" y="11" width="6" height="8" />
  </svg>
);

/* ---- Selector popup ---- */
const SelectorPopup = ({ title, items, onPick, onClose, accent }: {
  title: string;
  items: { id: string; label: string; sub?: string; icon: React.ReactNode; corner?: string; selected: boolean }[];
  onPick: (id: string) => void;
  onClose: () => void;
  accent: string;
}) => (
  <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur flex items-center justify-center p-6" onClick={onClose}>
    <div className="bg-[#0a0b10] border border-white/10 max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <h3 className="text-xl font-black tracking-tighter text-white">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none cursor-pointer">×</button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 p-5">
        {items.map(it => (
          <button
            key={it.id}
            onClick={() => { soundEngine.playUI(); onPick(it.id); }}
            className={`relative aspect-square bg-[#141722] border-2 transition-all cursor-pointer flex flex-col items-center justify-center p-2 hover:scale-[1.03] ${
              it.selected ? 'border-white bg-white/5' : 'border-white/10 hover:border-white/40'
            }`}
          >
            {it.corner && (
              <div className={`absolute top-1 left-1 w-5 h-5 flex items-center justify-center text-[10px] font-black ${
                it.corner === 'H' ? 'bg-[#ee3366] text-white' :
                it.corner === 'M' ? 'bg-[#d4a373] text-black' :
                                    'bg-[#18c7dc] text-black'
              }`}>{it.corner}</div>
            )}
            {it.selected && (
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: accent }} />
            )}
            <div className="text-gray-300 mb-2">{it.icon}</div>
            <div className="text-[11px] font-black uppercase tracking-wider text-white text-center leading-tight">{it.label}</div>
            {it.sub && <div className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{it.sub}</div>}
          </button>
        ))}
      </div>
    </div>
  </div>
);

/* =========================================================== */
/* Settings / Console tabs (extracted for clarity)              */
/* =========================================================== */

const SettingsTab = ({ settings, setSettings, isZh }: {
  settings: GameSettings;
  setSettings: React.Dispatch<React.SetStateAction<GameSettings>>;
  isZh: boolean;
}) => (
  <div className="p-6 max-w-3xl mx-auto">
    <div className="bg-black/60 border border-white/10 p-5 space-y-4">
      <h2 className="text-2xl font-black tracking-tighter text-white border-b border-white/10 pb-2">
        {isZh ? '设置' : 'SETTINGS'}
      </h2>

      <div className="flex justify-between items-center">
        <span className="text-sm font-bold">{isZh ? '界面语言' : 'LANGUAGE'}</span>
        <div className="flex gap-2">
          {(['zh', 'en'] as const).map(l => (
            <button key={l}
              onClick={() => { setSettings({ ...settings, language: l }); soundEngine.playUI(); }}
              className={`px-3 py-1 text-xs font-bold border cursor-pointer ${
                settings.language === l ? 'bg-white text-black border-white' : 'bg-black/40 text-gray-400 border-white/10'
              }`}
            >{l === 'zh' ? '中文' : 'EN'}</button>
          ))}
        </div>
      </div>

      <Slider label={isZh ? '视角灵敏度' : 'SENSITIVITY'} value={settings.sensitivity} min={0.2} max={3} step={0.1} suffix="x"
        onChange={(v) => setSettings({ ...settings, sensitivity: v })} />
      <Slider label={isZh ? '视野 FOV' : 'FIELD OF VIEW'} value={settings.fov} min={70} max={110} step={2} suffix="°"
        onChange={(v) => setSettings({ ...settings, fov: v })} />
      <Slider label={isZh ? '主音量' : 'MASTER VOLUME'} value={settings.volume * 100} min={0} max={100} step={5} suffix="%"
        onChange={(v) => { setSettings({ ...settings, volume: v / 100 }); soundEngine.setVolume(v / 100); }} />

      <div className="flex justify-between items-center pt-2 border-t border-white/10">
        <span className="text-sm font-bold">{isZh ? '屏幕震动' : 'SCREEN SHAKE'}</span>
        <button
          onClick={() => setSettings({ ...settings, screenShake: !settings.screenShake })}
          className={`px-3 py-1 text-xs font-bold border cursor-pointer ${
            settings.screenShake ? 'bg-[#18c7dc] text-black border-[#18c7dc]' : 'bg-black/40 text-gray-400 border-white/10'
          }`}
        >{settings.screenShake ? 'ON' : 'OFF'}</button>
      </div>
    </div>
  </div>
);

const Slider = ({ label, value, min, max, step, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step: number; suffix?: string;
  onChange: (v: number) => void;
}) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="font-bold uppercase tracking-wider text-gray-300">{label}</span>
      <span className="font-black text-white">{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}{suffix}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-[#18c7dc] cursor-pointer" />
  </div>
);

const ConsoleTab = ({ settings, setSettings, isZh, devTab, setDevTab, selectedDevWeapon, setSelectedDevWeapon, selectedDevSkill, setSelectedDevSkill }: any) => {
  const wDebug = settings.debug.weapons[selectedDevWeapon];
  const sDebug = settings.debug.skills[selectedDevSkill];
  const eDebug = settings.debug.enemies;
  const setW = (patch: any) => setSettings({ ...settings, debug: { ...settings.debug, weapons: { ...settings.debug.weapons, [selectedDevWeapon]: { ...wDebug, ...patch } } } });
  const setS = (patch: any) => setSettings({ ...settings, debug: { ...settings.debug, skills: { ...settings.debug.skills, [selectedDevSkill]: { ...sDebug, ...patch } } } });
  const setE = (patch: any) => setSettings({ ...settings, debug: { ...settings.debug, enemies: { ...eDebug, ...patch } } });
  const setCheat = (patch: any) => setSettings({ ...settings, cheats: { ...settings.cheats, ...patch } });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="bg-black/60 border border-white/10 p-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
          <h2 className="text-2xl font-black tracking-tighter text-white flex items-center gap-2">
            <TerminalSquare className="w-5 h-5 text-[#cc4422]" />
            {isZh ? '开发人员数值控制台' : 'DEV TUNING CONSOLE'}
          </h2>
          <span className="text-[10px] tracking-widest text-[#cc4422] uppercase">SANDBOX</span>
        </div>

        <div className="flex gap-1 text-[11px] font-black uppercase tracking-widest mb-4">
          {(['cheats','weapons','skills','enemies'] as const).map(k => (
            <button key={k}
              onClick={() => { setDevTab(k); soundEngine.playUI(); }}
              className={`px-3 py-1.5 border cursor-pointer ${devTab === k ? 'bg-[#cc4422] text-white border-[#cc4422]' : 'bg-black/40 text-gray-400 border-white/10'}`}
            >{k}</button>
          ))}
        </div>

        {devTab === 'cheats' && (
          <div className="grid grid-cols-2 gap-3">
            <Toggle label={isZh ? '无敌模式' : 'GOD MODE'} on={settings.cheats.godMode} onClick={() => setCheat({ godMode: !settings.cheats.godMode })} />
            <Toggle label={isZh ? '无限弹药' : 'INFINITE AMMO'} on={settings.cheats.infiniteAmmo} onClick={() => setCheat({ infiniteAmmo: !settings.cheats.infiniteAmmo })} />
            <Toggle label={isZh ? '技能零冷却' : 'INSTANT SKILL CD'} on={settings.cheats.instantCooldown} onClick={() => setCheat({ instantCooldown: !settings.cheats.instantCooldown })} />
            <Slider label={isZh ? '全局伤害倍率' : 'DAMAGE MULTI'} value={settings.cheats.damageMultiplier} min={0.5} max={10} step={0.5} suffix="x" onChange={(v) => setCheat({ damageMultiplier: v })} />
            <Slider label={isZh ? '玩家速度倍率' : 'SPEED MULTI'} value={settings.cheats.speedMultiplier} min={0.5} max={3} step={0.1} suffix="x" onChange={(v) => setCheat({ speedMultiplier: v })} />
            <Slider label={isZh ? '敌人生成倍率' : 'SPAWN MULTI'} value={settings.cheats.enemySpawnMultiplier} min={0.2} max={3} step={0.1} suffix="x" onChange={(v) => setCheat({ enemySpawnMultiplier: v })} />
          </div>
        )}

        {devTab === 'weapons' && (
          <div>
            <div className="flex flex-wrap gap-1 mb-3">
              {(Object.keys(settings.debug.weapons) as SelectedWeapon[]).map(w => (
                <button key={w}
                  onClick={() => setSelectedDevWeapon(w)}
                  className={`px-2 py-1 text-[10px] font-black uppercase border cursor-pointer ${selectedDevWeapon === w ? 'bg-[#d4a373] text-black border-[#d4a373]' : 'bg-black/40 text-gray-400 border-white/10'}`}
                >{w}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Slider label={isZh ? '单发伤害' : 'DAMAGE'} value={wDebug.damagePerShot} min={1} max={300} step={1} onChange={(v) => setW({ damagePerShot: v })} />
              <Slider label={isZh ? '弹匣容量' : 'MAG SIZE'} value={wDebug.maxMagazine} min={1} max={200} step={1} onChange={(v) => setW({ maxMagazine: v })} />
              <Slider label={isZh ? '换弹时间 (s)' : 'RELOAD (s)'} value={wDebug.reloadTime} min={0.3} max={8} step={0.1} onChange={(v) => setW({ reloadTime: v })} />
              <Slider label={isZh ? '射击间隔 (s)' : 'FIRE RATE (s)'} value={wDebug.fireRate} min={0.02} max={2} step={0.01} onChange={(v) => setW({ fireRate: v })} />
              <Slider label={isZh ? '射程 (m)' : 'RANGE (m)'} value={wDebug.range} min={5} max={150} step={1} onChange={(v) => setW({ range: v })} />
              {wDebug.pelletCount !== undefined && (
                <Slider label={isZh ? '弹丸数' : 'PELLETS'} value={wDebug.pelletCount} min={1} max={20} step={1} onChange={(v) => setW({ pelletCount: v })} />
              )}
              {wDebug.explosionRadius !== undefined && (
                <Slider label={isZh ? '爆炸半径' : 'BLAST RADIUS'} value={wDebug.explosionRadius} min={1} max={15} step={0.5} onChange={(v) => setW({ explosionRadius: v })} />
              )}
              {wDebug.flameRange !== undefined && (
                <Slider label={isZh ? '火焰距离' : 'FLAME RANGE'} value={wDebug.flameRange} min={4} max={40} step={1} onChange={(v) => setW({ flameRange: v })} />
              )}
              {wDebug.burstSize !== undefined && (
                <Slider label={isZh ? '连发发数' : 'BURST SIZE'} value={wDebug.burstSize} min={1} max={8} step={1} onChange={(v) => setW({ burstSize: v })} />
              )}
            </div>
          </div>
        )}

        {devTab === 'skills' && (
          <div>
            <div className="flex gap-1 mb-3">
              {(Object.keys(settings.debug.skills) as SelectedSkill[]).map(s => (
                <button key={s}
                  onClick={() => setSelectedDevSkill(s)}
                  className={`px-2 py-1 text-[10px] font-black uppercase border cursor-pointer ${selectedDevSkill === s ? 'bg-[#18c7dc] text-black border-[#18c7dc]' : 'bg-black/40 text-gray-400 border-white/10'}`}
                >{s}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Slider label={isZh ? '技能冷却 (s)' : 'COOLDOWN (s)'} value={sDebug.cooldown} min={0.5} max={30} step={0.5} onChange={(v) => setS({ cooldown: v })} />
              {sDebug.duration !== undefined && <Slider label={isZh ? '持续时间' : 'DURATION'} value={sDebug.duration} min={0.5} max={20} step={0.5} onChange={(v) => setS({ duration: v })} />}
              {sDebug.chargeSpeed !== undefined && <Slider label={isZh ? '冲撞速度' : 'CHARGE SPEED'} value={sDebug.chargeSpeed} min={5} max={60} step={1} onChange={(v) => setS({ chargeSpeed: v })} />}
              {sDebug.chargeDamage !== undefined && <Slider label={isZh ? '冲撞伤害' : 'CHARGE DMG'} value={sDebug.chargeDamage} min={10} max={500} step={5} onChange={(v) => setS({ chargeDamage: v })} />}
              {sDebug.slamDamage !== undefined && <Slider label={isZh ? '下砸伤害' : 'SLAM DMG'} value={sDebug.slamDamage} min={10} max={800} step={5} onChange={(v) => setS({ slamDamage: v })} />}
              {sDebug.slamRadius !== undefined && <Slider label={isZh ? '下砸半径' : 'SLAM RADIUS'} value={sDebug.slamRadius} min={2} max={30} step={1} onChange={(v) => setS({ slamRadius: v })} />}
              {sDebug.shieldHp !== undefined && <Slider label={isZh ? '护盾血量' : 'SHIELD HP'} value={sDebug.shieldHp} min={100} max={3000} step={50} onChange={(v) => setS({ shieldHp: v })} />}
              {sDebug.pullForce !== undefined && <Slider label={isZh ? '铁爪拉力' : 'PULL FORCE'} value={sDebug.pullForce} min={10} max={100} step={5} onChange={(v) => setS({ pullForce: v })} />}
              {sDebug.range !== undefined && <Slider label={isZh ? '技能射程' : 'SKILL RANGE'} value={sDebug.range} min={5} max={100} step={1} onChange={(v) => setS({ range: v })} />}
            </div>
          </div>
        )}

        {devTab === 'enemies' && (
          <div className="grid grid-cols-2 gap-3">
            <Slider label={isZh ? '基础刷怪数' : 'SPAWN BASE'} value={eDebug.spawnBase} min={1} max={20} step={1} onChange={(v) => setE({ spawnBase: v })} />
            <Slider label={isZh ? '每波递增' : 'SPAWN / WAVE'} value={eDebug.spawnPerWave} min={0} max={8} step={0.5} onChange={(v) => setE({ spawnPerWave: v })} />
            <Slider label={isZh ? '生命倍率' : 'HP MULTI'} value={eDebug.hpMultiplier} min={0.3} max={5} step={0.1} suffix="x" onChange={(v) => setE({ hpMultiplier: v })} />
            <Slider label={isZh ? '每波额外生命' : 'HP BONUS / WAVE'} value={eDebug.hpBonusPerWave} min={0} max={200} step={5} onChange={(v) => setE({ hpBonusPerWave: v })} />
          </div>
        )}
      </div>
    </div>
  );
};

const Toggle = ({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) => (
  <div className="flex items-center justify-between bg-black/40 border border-white/5 p-3">
    <span className="text-xs font-bold uppercase tracking-wider text-gray-300">{label}</span>
    <button
      onClick={() => { soundEngine.playUI(); onClick(); }}
      className={`px-3 py-1 text-xs font-black border cursor-pointer ${on ? 'bg-[#cc4422] text-white border-[#cc4422]' : 'bg-black/40 text-gray-400 border-white/10'}`}
    >{on ? 'ON' : 'OFF'}</button>
  </div>
);
