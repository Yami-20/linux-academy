import { useState, useRef, useEffect, useCallback } from 'react';
import { useEngineStore } from '../store/engineStore';

export const TerminalHUD = () => {
  const [input, setInput]         = useState('');
  const [historyIdx, setHistIdx]  = useState(-1);
  const [localHistory, setLocalH] = useState<string[]>([]);
  const [showTip, setShowTip]     = useState(true);

  const history      = useEngineStore(s => s.history);
  const currentPath  = useEngineStore(s => s.currentPath);
  const executeCommand = useEngineStore(s => s.executeCommand);
  const scrollRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  // Auto-hide tip after first command
  useEffect(() => {
    if (history.length > 0) setShowTip(false);
  }, [history]);

  const submit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setLocalH(prev => [trimmed, ...prev.slice(0, 49)]);
    setHistIdx(-1);
    executeCommand(trimmed);
    setInput('');
  }, [input, executeCommand]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIdx = Math.min(historyIdx + 1, localHistory.length - 1);
      setHistIdx(nextIdx);
      setInput(localHistory[nextIdx] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = Math.max(historyIdx - 1, -1);
      setHistIdx(nextIdx);
      setInput(nextIdx === -1 ? '' : localHistory[nextIdx] ?? '');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Simple tab: complete common commands
      const completions = ['ls', 'cd', 'pwd', 'mkdir', 'touch', 'cat', 'echo', 'rm', 'cp', 'mv', 'grep', 'find', 'chmod', 'wc', 'head', 'tail', 'history', 'man', 'clear'];
      const match = completions.find(c => c.startsWith(input));
      if (match) setInput(match + ' ');
    }
  };

  const displayPath = currentPath.replace('/home/', '~/');

  return (
    <div
      className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[96%] max-w-3xl pointer-events-auto z-40"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="bg-[#0d1117]/95 border-2 border-[#e2b96f] rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,0.7)] flex flex-col font-mono" style={{ height: '220px' }}>

        {/* Title bar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#e2b96f]/30 bg-[#1a1a2e] rounded-t shrink-0">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[#888] text-[10px] flex-1 text-center">terminal — {displayPath}</span>
          <span className="text-[#444] text-[10px]">↑↓ history · Tab complete</span>
        </div>

        {/* Output */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin" ref={scrollRef}>
          {history.length === 0 && showTip && (
            <div className="text-[#444] text-xs italic">
              Type a command and press Enter. Try <span className="text-[#7ec8e3]">help</span> or <span className="text-[#7ec8e3]">man ls</span> to get started.
            </div>
          )}
          {history.map((log) => (
            <div key={log.id} className="text-xs leading-relaxed">
              <div className="flex gap-1.5 flex-wrap">
                <span className="text-[#7ec8e3] shrink-0">{displayPath} $</span>
                <span className="text-[#cdd6f4]">{log.command}</span>
              </div>
              {log.output && (
                <div className={`whitespace-pre-wrap pl-4 mt-0.5 ${log.isError ? 'text-[#f38ba8]' : 'text-[#a6e3a1]'}`}>
                  {log.output}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input row */}
        <div className="flex gap-2 items-center border-t border-[#e2b96f]/30 px-3 py-2 shrink-0">
          <span className="text-[#7ec8e3] text-xs shrink-0">{displayPath} $</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); setHistIdx(-1); }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-[#cdd6f4] text-xs outline-none placeholder-[#444] caret-[#e2b96f]"
            spellCheck={false}
            autoFocus
            placeholder="enter command..."
          />
          <button
            onClick={submit}
            className="text-[10px] border border-[#e2b96f]/50 px-2 py-0.5 text-[#e2b96f] hover:bg-[#e2b96f]/10 rounded-sm shrink-0"
          >RUN ↵</button>
        </div>
      </div>
    </div>
  );
};
