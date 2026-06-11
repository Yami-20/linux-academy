import React, { useState } from 'react';
import { useEngineStore } from '../store/engineStore';
import type { OSWindow } from '../store/engineStore';

const DraggableWindow = ({ win }: { win: OSWindow }) => {
  const { closeWindow, focusWindow, moveWindow, executeCommand } = useEngineStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [content, setContent] = useState(win.content);
  const [saved, setSaved] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    focusWindow(win.id);
    setIsDragging(true);
    setDragOffset({ x: e.clientX - win.x, y: e.clientY - win.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) moveWindow(win.id, e.clientX - dragOffset.x, e.clientY - dragOffset.y);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleSave = async () => {
    // Write content line-by-line using >> so multiline content is preserved
    // First, overwrite with the first line, then append the rest
    const lines = content.split('\n');
    // Use the API directly to write the full content atomically
    try {
      const res = await fetch('http://127.0.0.1:8000/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Write first line with >, then append remaining lines
        body: JSON.stringify({ command: `echo ${JSON.stringify(lines[0] ?? '')} > ${win.title}` })
      });
      await res.json();
      for (let i = 1; i < lines.length; i++) {
        const appendRes = await fetch('http://127.0.0.1:8000/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: `echo ${JSON.stringify(lines[i])} >> ${win.title}` })
        });
        await appendRes.json();
      }
      // Sync world state
      useEngineStore.getState().syncWorld();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      // fallback: best-effort single echo
      executeCommand(`echo ${JSON.stringify(content)} > ${win.title}`);
    }
  };

  return (
    <div
      className="absolute flex flex-col bg-white border-4 border-black rounded-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto font-mono"
      style={{ left: win.x, top: win.y, zIndex: win.zIndex, width: 420, height: 320 }}
      onPointerDown={() => focusWindow(win.id)}
    >
      {/* Header */}
      <div
        className="flex justify-between items-center bg-gray-200 border-b-4 border-black px-4 py-2 cursor-move select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <span className="text-black font-bold text-sm pointer-events-none uppercase tracking-widest truncate max-w-[280px]">
          {win.title}{win.type === 'editor' && ' [EDIT]'}
        </span>
        <button onClick={() => closeWindow(win.id)} className="text-black hover:text-red-600 font-bold text-xl leading-none ml-2">✕</button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col p-4 bg-white text-black min-h-0">
        {win.type === 'editor' ? (
          <>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 w-full bg-transparent text-black font-mono text-sm resize-none outline-none leading-relaxed"
              spellCheck={false}
            />
            <div className="flex justify-end items-center gap-3 pt-2 mt-2 border-t border-gray-200 shrink-0">
              {saved && <span className="text-green-600 text-xs font-bold">✓ Saved!</span>}
              <button
                onClick={handleSave}
                className="px-4 py-1.5 bg-white border-4 border-black text-black font-bold uppercase text-sm hover:bg-gray-200 active:translate-y-0.5 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                SAVE
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-black font-bold text-xl uppercase animate-pulse">
            ▶ RUNNING APP...
          </div>
        )}
      </div>
    </div>
  );
};

export const WindowManager = () => {
  const windows = useEngineStore((state) => state.windows);
  return <>{windows.map((win) => <DraggableWindow key={win.id} win={win} />)}</>;
};
