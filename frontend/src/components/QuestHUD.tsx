import { useState } from 'react';
import { useEngineStore, ZONES } from '../store/engineStore';

export const QuestHUD = () => {
  const activeQuest  = useEngineStore(s => s.activeQuest);
  const gameLevel    = useEngineStore(s => s.gameLevel);
  const gameWon      = useEngineStore(s => s.gameWon);
  const xp           = useEngineStore(s => s.xp);
  const xpToNext     = useEngineStore(s => s.xpToNext);
  const currentZone  = useEngineStore(s => s.currentZone);
  const commandCount = useEngineStore(s => s.commandCount);
  const [showHint, setShowHint] = useState(false);
  const [showMap, setShowMap]   = useState(false);

  if (gameWon) return null;

  const xpPct = Math.min(100, Math.round((xp / xpToNext) * 100));
  const totalLevels = 25;

  return (
    <>
      {/* ── Top HUD bar ── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[96%] max-w-3xl pointer-events-auto z-50 flex gap-2">

        {/* Quest card */}
        <div className="flex-1 bg-[#1a1a2e] border-2 border-[#e2b96f] rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,0.6)] flex overflow-hidden">
          {/* Level badge */}
          <div className="w-14 shrink-0 bg-[#e2b96f] flex flex-col items-center justify-center gap-0.5 border-r-2 border-[#c49a50]">
            <span className="text-[#1a1a2e] font-black text-xs leading-none">LVL</span>
            <span className="text-[#1a1a2e] font-black text-2xl leading-none">{gameLevel}</span>
            <span className="text-[#1a1a2e] font-black text-[9px] leading-none">/{totalLevels}</span>
          </div>

          {/* Quest info */}
          <div className="flex-1 flex flex-col justify-center px-3 py-2 font-mono min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[#7ec8e3] text-[10px] font-bold uppercase tracking-widest shrink-0">
                  {currentZone.name}
                </span>
                <span className="text-[#e2b96f] font-bold text-sm truncate">{activeQuest.title}</span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => { setShowMap(!showMap); setShowHint(false); }}
                  className="text-[10px] border border-[#7ec8e3] px-2 py-0.5 text-[#7ec8e3] font-bold hover:bg-[#7ec8e3]/20 rounded-sm"
                >MAP</button>
                <button
                  onClick={() => { setShowHint(!showHint); setShowMap(false); }}
                  className="text-[10px] border border-[#e2b96f] px-2 py-0.5 text-[#e2b96f] font-bold hover:bg-[#e2b96f]/20 rounded-sm"
                >{showHint ? 'HIDE' : 'HINT'}</button>
              </div>
            </div>
            <p className="text-[#cdd6f4] text-xs leading-snug">{activeQuest.description}</p>
            {showHint && (
              <div className="mt-1.5 text-[11px] border-t border-[#e2b96f]/30 pt-1.5 text-[#e2b96f] italic">
                💡 {activeQuest.hint}
              </div>
            )}
          </div>

          {/* XP reward */}
          <div className="w-12 shrink-0 bg-[#0d1117] flex flex-col items-center justify-center gap-0.5 border-l-2 border-[#e2b96f]/30">
            <span className="text-[#e2b96f] font-bold text-xs">+{activeQuest.xpReward}</span>
            <span className="text-[#888] text-[9px]">XP</span>
          </div>
        </div>

        {/* Stats panel */}
        <div className="bg-[#1a1a2e] border-2 border-[#e2b96f] rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,0.6)] flex flex-col justify-center px-3 py-2 font-mono shrink-0 min-w-[110px]">
          {/* XP bar */}
          <div className="mb-1.5">
            <div className="flex justify-between text-[9px] mb-0.5">
              <span className="text-[#7ec8e3]">XP</span>
              <span className="text-[#cdd6f4]">{xp}/{xpToNext}</span>
            </div>
            <div className="w-full h-2 bg-[#0d1117] rounded-full border border-[#e2b96f]/30 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#7ec8e3] to-[#e2b96f] transition-all duration-500"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>
          <div className="text-[9px] text-[#888] flex justify-between">
            <span>CMDS</span><span className="text-[#cdd6f4]">{commandCount}</span>
          </div>
        </div>
      </div>

      {/* ── Zone map overlay ── */}
      {showMap && (
        <div
          className="absolute top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-auto bg-[#1a1a2e] border-2 border-[#e2b96f] rounded shadow-[6px_6px_0px_0px_rgba(0,0,0,0.7)] p-4 font-mono w-80"
        >
          <div className="text-[#e2b96f] font-bold text-xs uppercase tracking-widest mb-3 flex justify-between">
            <span>🗺 World Map</span>
            <button onClick={() => setShowMap(false)} className="text-[#888] hover:text-white">✕</button>
          </div>
          <div className="space-y-2">
            {ZONES.map(zone => {
              const locked = zone.unlockLevel > gameLevel;
              const isCurrent = zone.id === currentZone.id;
              return (
                <div
                  key={zone.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded border text-xs ${
                    isCurrent
                      ? 'border-[#e2b96f] bg-[#e2b96f]/10 text-[#e2b96f]'
                      : locked
                      ? 'border-[#333] text-[#444]'
                      : 'border-[#3a3a5e] text-[#cdd6f4]'
                  }`}
                >
                  <span className="text-base">{locked ? '🔒' : isCurrent ? '📍' : '✅'}</span>
                  <div className="flex-1">
                    <div className="font-bold">{zone.name}</div>
                    <div className="text-[9px] opacity-70">{locked ? `Unlocks at level ${zone.unlockLevel}` : zone.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
