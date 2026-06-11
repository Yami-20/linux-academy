import React, { useState } from 'react';
import { useEngineStore } from '../store/engineStore';
import type { OSWindow } from '../store/engineStore';

const DraggableWindow = ({ win }: { win: OSWindow }) => {
  const { closeWindow, focusWindow, moveWindow, executeCommand } = useEngineStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [content, setContent] = useState(win.content);

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

  const handleSave = () => executeCommand(`echo "${content}" > ${win.title}`);

  return (
    <div 
      className="absolute flex flex-col bg-white border-4 border-black rounded-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto font-mono"
      style={{ left: win.x, top: win.y, zIndex: win.zIndex, width: 400, height: 300 }}
      onPointerDown={() => focusWindow(win.id)}
    >
      {/* RPG Menu Header */}
      <div 
        className="flex justify-between items-center bg-gray-200 border-b-4 border-black px-4 py-2 cursor-move select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <span className="text-black font-bold text-lg pointer-events-none uppercase tracking-widest">
          {win.title} {win.type === 'editor' && " [EDIT]"}
        </span>
        <button onClick={() => closeWindow(win.id)} className="text-black hover:text-red-600 font-bold text-xl leading-none">X</button>
      </div>

      {/* Menu Body */}
      <div className="flex-1 flex flex-col p-4 bg-white text-black">
        {win.type === 'editor' ? (
          <>
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 w-full bg-transparent text-black font-bold text-base resize-none outline-none leading-relaxed"
              spellCheck={false}
            />
            <div className="flex justify-end pt-2 mt-2">
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-white border-4 border-black text-black font-bold uppercase hover:bg-gray-200 active:translate-y-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
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