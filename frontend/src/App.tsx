import { useEffect, useState } from 'react';
import { TerminalHUD } from './components/TerminalHUD';
import { WorldRenderer } from './world/WorldRenderer';
import { WindowManager } from './components/WindowManager';
import { QuestHUD } from './components/QuestHUD';
import { useEngineStore } from './store/engineStore';

function App() {
  const syncWorld    = useEngineStore(s => s.syncWorld);
  const gameWon      = useEngineStore(s => s.gameWon);
  const gameLevel    = useEngineStore(s => s.gameLevel);
  const commandCount = useEngineStore(s => s.commandCount);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [prevLevel, setPrevLevel]     = useState(gameLevel);

  useEffect(() => { syncWorld(); }, [syncWorld]);

  // Level-up toast
  useEffect(() => {
    if (gameLevel > prevLevel) {
      setShowLevelUp(true);
      setPrevLevel(gameLevel);
      const t = setTimeout(() => setShowLevelUp(false), 2800);
      return () => clearTimeout(t);
    }
  }, [gameLevel, prevLevel]);

  return (
    <div className="w-screen h-screen bg-[#0d1117] relative overflow-hidden font-sans select-none">
      <WorldRenderer />

      <div className="absolute inset-0 z-50 pointer-events-none">
        <div className="pointer-events-none w-full h-full relative">
          <QuestHUD />
          <TerminalHUD />
          <WindowManager />

          {/* Level-up toast */}
          {showLevelUp && (
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-[90]
              bg-[#1a1a2e] border-2 border-[#e2b96f] rounded px-6 py-3 shadow-[0_0_20px_rgba(226,185,111,0.4)]
              font-mono text-center animate-bounce"
            >
              <div className="text-[#e2b96f] font-black text-xl tracking-widest">⬆ LEVEL UP!</div>
              <div className="text-[#7ec8e3] text-sm mt-1">Now Level {gameLevel}</div>
            </div>
          )}

          {/* Win screen */}
          {gameWon && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center pointer-events-auto z-[100]">
              <div className="text-center font-mono max-w-lg px-6">
                <div className="text-6xl mb-6">🏆</div>
                <h1 className="text-4xl font-black text-[#e2b96f] uppercase tracking-widest mb-3 drop-shadow-[2px_2px_0_#000]">
                  System Secured
                </h1>
                <p className="text-[#cdd6f4] text-sm mb-2 leading-relaxed">
                  You've mastered 25 Linux commands across 5 zones.<br/>
                  The Virtual File System is safe.
                </p>
                <p className="text-[#7ec8e3] text-xs mb-8">
                  Commands executed: {commandCount}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-8 py-3 bg-[#e2b96f] border-2 border-[#c49a50] text-[#1a1a2e] font-black text-lg uppercase tracking-widest hover:bg-[#f0cc88] transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.6)] active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.6)]"
                >
                  PLAY AGAIN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
