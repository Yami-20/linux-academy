import { create } from 'zustand';

export interface FileNode { name: string; is_dir: boolean; }
export interface CommandLog { id: string; command: string; output: string; isError: boolean; }
export interface OSWindow { id: string; title: string; content: string; type: 'editor' | 'app'; x: number; y: number; zIndex: number; }

// ─── Zone definitions (Stardew-style areas unlocked as you level up) ──────────
export interface Zone {
  id: string;
  name: string;
  bgColor: string;
  borderColor: string;
  unlockLevel: number;
  description: string;
}

export const ZONES: Zone[] = [
  { id: 'home',     name: 'Home Base',      bgColor: '#4a7c4e', borderColor: '#2d5230', unlockLevel: 1,  description: 'Your starting zone.' },
  { id: 'fortress', name: 'Fortress',        bgColor: '#6b4c8a', borderColor: '#3d2a52', unlockLevel: 5,  description: 'A fortified directory zone.' },
  { id: 'projects', name: 'Projects Lab',    bgColor: '#c97c2e', borderColor: '#7a4a18', unlockLevel: 10, description: 'Where builds are made.' },
  { id: 'archives', name: 'Data Archives',   bgColor: '#2e7a8a', borderColor: '#184a52', unlockLevel: 15, description: 'Ancient file repositories.' },
  { id: 'core',     name: 'System Core',     bgColor: '#8a2e2e', borderColor: '#521818', unlockLevel: 20, description: 'The heart of the system.' },
];

// ─── Quest system ──────────────────────────────────────────────────────────────
export interface Quest {
  level: number;
  zone: string;
  title: string;
  description: string;
  hint: string;
  xpReward: number;
  validate: (cmd: string, args: string[], data: any) => boolean;
}

const QUESTS: Quest[] = [
  // ── Zone 1: Home Base (levels 1-9) ──────────────────────────────────────
  {
    level: 1, zone: 'home',
    title: 'Reconnaissance',
    description: 'System rebooted after an intrusion. Print your current absolute path to establish coordinates.',
    hint: 'Use the command that prints the working directory: pwd',
    xpReward: 100,
    validate: (cmd) => cmd === 'pwd',
  },
  {
    level: 2, zone: 'home',
    title: 'Survey the Land',
    description: 'List all files and directories in your current location to survey what\'s here.',
    hint: 'Use ls to list directory contents.',
    xpReward: 120,
    validate: (cmd) => cmd === 'ls',
  },
  {
    level: 3, zone: 'home',
    title: 'Read Briefing',
    description: 'A mission file was left for you. Read the contents of mission.txt.',
    hint: 'Use cat to display file contents: cat mission.txt',
    xpReward: 150,
    validate: (cmd, args) => cmd === 'cat' && args.some(a => a.includes('mission.txt')),
  },
  {
    level: 4, zone: 'home',
    title: 'Establish Sector',
    description: 'Create a new secure directory named "fortress" to quarantine corrupted files.',
    hint: 'Use mkdir to create a directory: mkdir fortress',
    xpReward: 180,
    validate: (cmd, args, data) => cmd === 'mkdir' && data?.contents?.some((f: FileNode) => f.name === 'fortress' && f.is_dir),
  },
  {
    level: 5, zone: 'home',
    title: 'Infiltrate Fortress',
    description: 'Move inside the "fortress" directory you just created.',
    hint: 'Use cd to change directory: cd fortress',
    xpReward: 200,
    validate: (cmd, args, data) => cmd === 'cd' && data?.pwd?.endsWith('/fortress'),
  },
  {
    level: 6, zone: 'fortress',
    title: 'Forge the Manifest',
    description: 'Inside fortress, create an empty file named "log.txt" to track mutations.',
    hint: 'Use touch to create an empty file: touch log.txt',
    xpReward: 220,
    validate: (cmd, args, data) => cmd === 'touch' && data?.contents?.some((f: FileNode) => f.name === 'log.txt' && !f.is_dir),
  },
  {
    level: 7, zone: 'fortress',
    title: 'Inject Access Key',
    description: 'Write the text "CLASSIFIED" into log.txt using redirection.',
    hint: 'Use echo with > redirection: echo CLASSIFIED > log.txt',
    xpReward: 250,
    validate: (cmd, args) => cmd === 'echo' && args.includes('>') && args.some(a => a.includes('log.txt')),
  },
  {
    level: 8, zone: 'fortress',
    title: 'Read Telemetry',
    description: 'Verify the file contains the injected data. Display contents of log.txt.',
    hint: 'Use cat to read the file: cat log.txt',
    xpReward: 280,
    validate: (cmd, args) => cmd === 'cat' && args.some(a => a.includes('log.txt')),
  },
  {
    level: 9, zone: 'fortress',
    title: 'Tactical Retreat',
    description: 'Exit the fortress. Move back to the parent (home) directory.',
    hint: 'Use cd with double-dot to go up: cd ..',
    xpReward: 300,
    validate: (cmd, args, data) => cmd === 'cd' && !data?.pwd?.endsWith('/fortress'),
  },

  // ── Zone 2: Projects Lab (levels 10-14) ────────────────────────────────
  {
    level: 10, zone: 'projects',
    title: 'Enter the Lab',
    description: 'The Projects Lab awaits. Navigate into the "projects" directory.',
    hint: 'Use cd projects',
    xpReward: 350,
    validate: (cmd, args, data) => cmd === 'cd' && data?.pwd?.endsWith('/projects'),
  },
  {
    level: 11, zone: 'projects',
    title: 'Detail Scan',
    description: 'Run a long-format listing to see file permissions and metadata in the projects dir.',
    hint: 'Use ls with the -l flag: ls -l',
    xpReward: 380,
    validate: (cmd, args) => cmd === 'ls' && args.includes('-l'),
  },
  {
    level: 12, zone: 'projects',
    title: 'Build Workspace',
    description: 'Create two directories in one command: "src" and "bin".',
    hint: 'mkdir accepts multiple names: mkdir src bin',
    xpReward: 400,
    validate: (cmd, args, data) =>
      cmd === 'mkdir' &&
      data?.contents?.some((f: FileNode) => f.name === 'src' && f.is_dir) &&
      data?.contents?.some((f: FileNode) => f.name === 'bin' && f.is_dir),
  },
  {
    level: 13, zone: 'projects',
    title: 'Deploy Source',
    description: 'Create a file named "main.sh" inside the src directory using a path.',
    hint: 'Use touch with a path: touch src/main.sh',
    xpReward: 430,
    validate: (cmd, args) => cmd === 'touch' && args.some(a => a.includes('src/main.sh') || a === 'main.sh'),
  },
  {
    level: 14, zone: 'projects',
    title: 'Write the Script',
    description: 'Write "#!/bin/bash" into src/main.sh using echo and redirection.',
    hint: 'echo "#!/bin/bash" > src/main.sh',
    xpReward: 460,
    validate: (cmd, args) => cmd === 'echo' && args.some(a => a.includes('main.sh')),
  },

  // ── Zone 3: Archives (levels 15-19) ────────────────────────────────────
  {
    level: 15, zone: 'archives',
    title: 'Reach the Archives',
    description: 'Navigate back home, then into the "docs" directory to access the archives.',
    hint: 'cd ~ then cd docs, or cd ../../docs',
    xpReward: 500,
    validate: (cmd, args, data) => cmd === 'cd' && data?.pwd?.endsWith('/docs'),
  },
  {
    level: 16, zone: 'archives',
    title: 'Search the Archive',
    description: 'Use grep to search for the word "Welcome" inside README.txt.',
    hint: 'grep PATTERN FILE — try: grep Welcome README.txt',
    xpReward: 550,
    validate: (cmd, args) => cmd === 'grep' && args.some(a => a.includes('README.txt')),
  },
  {
    level: 17, zone: 'archives',
    title: 'Count the Lines',
    description: 'Count how many lines are in README.txt using the word-count tool.',
    hint: 'wc -l README.txt',
    xpReward: 580,
    validate: (cmd, args) => cmd === 'wc' && args.some(a => a.includes('README.txt')),
  },
  {
    level: 18, zone: 'archives',
    title: 'Duplicate the Record',
    description: 'Copy README.txt to a new file named "README.bak" for backup.',
    hint: 'cp README.txt README.bak',
    xpReward: 620,
    validate: (cmd, args, data) =>
      cmd === 'cp' && data?.contents?.some((f: FileNode) => f.name === 'README.bak'),
  },
  {
    level: 19, zone: 'archives',
    title: 'Rename the Log',
    description: 'Rename README.bak to archive.txt using the move command.',
    hint: 'mv README.bak archive.txt',
    xpReward: 660,
    validate: (cmd, args, data) =>
      cmd === 'mv' && data?.contents?.some((f: FileNode) => f.name === 'archive.txt'),
  },

  // ── Zone 4: System Core — Boss levels (20-25) ──────────────────────────
  {
    level: 20, zone: 'core',
    title: 'Reach the Core',
    description: 'Navigate back home. The system core is at ~/projects. Get there.',
    hint: 'cd ~ to go home, then cd projects',
    xpReward: 700,
    validate: (cmd, args, data) => cmd === 'cd' && (data?.pwd?.endsWith('/projects') || data?.pwd?.endsWith('/player')),
  },
  {
    level: 21, zone: 'core',
    title: 'Find All Scripts',
    description: 'Use the find command to locate all files named "main.sh" under the current directory.',
    hint: 'find . -name main.sh',
    xpReward: 750,
    validate: (cmd, args) => cmd === 'find' && args.includes('-name'),
  },
  {
    level: 22, zone: 'core',
    title: 'Secure Permissions',
    description: 'Make main.sh executable by changing its permissions to 755.',
    hint: 'chmod 755 src/main.sh',
    xpReward: 800,
    validate: (cmd, args) => cmd === 'chmod' && args.some(a => a.includes('main.sh')),
  },
  {
    level: 23, zone: 'core',
    title: 'Append to the Log',
    description: 'Append "MISSION_COMPLETE" to log.txt without overwriting it. Use >> operator.',
    hint: 'Navigate to fortress first, then: echo MISSION_COMPLETE >> log.txt',
    xpReward: 850,
    validate: (cmd, args) => cmd === 'echo' && args.includes('>>'),
  },
  {
    level: 24, zone: 'core',
    title: 'Demolition (Boss)',
    description: 'CRITICAL: The fortress is breached! Destroy it and everything inside. Use rm -rf.',
    hint: 'From home: rm -rf fortress',
    xpReward: 1000,
    validate: (cmd, args, data) =>
      (cmd === 'rm' || cmd === 'rmdir') &&
      !data?.contents?.some((f: FileNode) => f.name === 'fortress'),
  },
  {
    level: 25, zone: 'core',
    title: 'Final Audit',
    description: 'System secured! Run a final ls to confirm the fortress is gone and the system is clean.',
    hint: 'ls',
    xpReward: 1500,
    validate: (cmd) => cmd === 'ls',
  },
];

// ─── Store types ───────────────────────────────────────────────────────────────
export interface EngineState {
  history: CommandLog[];
  currentPath: string;
  contents: FileNode[];
  windows: OSWindow[];
  highestZ: number;

  gameLevel: number;
  xp: number;
  xpToNext: number;
  activeQuest: Quest;
  gameWon: boolean;
  currentZone: Zone;
  commandCount: number;
  unlockedZones: string[];

  syncWorld: () => Promise<void>;
  executeCommand: (cmd: string) => Promise<void>;
  openWindow: (title: string, content: string, type: 'editor' | 'app') => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
}

const getZoneForLevel = (level: number): Zone => {
  const quest = QUESTS.find(q => q.level === level);
  return ZONES.find(z => z.id === quest?.zone) ?? ZONES[0];
};

const getXpToNext = (level: number) => Math.floor(100 * Math.pow(1.3, level));

export const useEngineStore = create<EngineState>((set, get) => ({
  history: [],
  currentPath: '~/player',
  contents: [],
  windows: [],
  highestZ: 100,
  gameLevel: 1,
  xp: 0,
  xpToNext: getXpToNext(1),
  activeQuest: QUESTS[0],
  gameWon: false,
  currentZone: ZONES[0],
  commandCount: 0,
  unlockedZones: ['home'],

  openWindow: (title, content, type) => set((state) => {
    if (state.windows.some(w => w.title === title)) return state;
    const newZ = state.highestZ + 1;
    return {
      highestZ: newZ,
      windows: [...state.windows, {
        id: Math.random().toString(36).substring(2, 9),
        title, content, type,
        x: window.innerWidth / 2 - 200 + (state.windows.length * 30),
        y: 100 + (state.windows.length * 30),
        zIndex: newZ
      }]
    };
  }),

  closeWindow: (id) => set((state) => ({ windows: state.windows.filter(w => w.id !== id) })),
  focusWindow: (id) => set((state) => {
    const newZ = state.highestZ + 1;
    return { highestZ: newZ, windows: state.windows.map(w => w.id === id ? { ...w, zIndex: newZ } : w) };
  }),
  moveWindow: (id, x, y) => set((state) => ({ windows: state.windows.map(w => w.id === id ? { ...w, x, y } : w) })),

  syncWorld: async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'pwd' })
      });
      const data = await res.json();
      set({ currentPath: data?.pwd?.replace('/home/', '~/') || '~/', contents: data?.contents || [] });
    } catch (e) { console.error('VFS fault'); }
  },

  executeCommand: async (rawCmd: string) => {
    const normalized = rawCmd.trim().replace(/\s+/g, ' ');
    if (!normalized) return;

    const tokens = normalized.split(' ');
    const cmd = tokens[0];
    const args = tokens.slice(1);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: normalized })
      });
      const data = await res.json();

      if (data.event === 'CLEAR_TERMINAL') {
        set((state) => ({ ...state, history: [], currentPath: data?.pwd?.replace('/home/', '~/') || '~/', contents: data?.contents || [] }));
        return;
      }

      if (cmd === 'cat' && data?.status !== 'error') {
        const filename = args.find(a => !a.startsWith('-')) || '';
        if (filename) get().openWindow(filename, data.output, 'editor');
      }

      // ── Evaluate quest ────────────────────────────────────────────────
      const state = get();
      const quest = state.activeQuest;
      const level = state.gameLevel;

      const success = quest.validate(cmd, args, data);
      let newLevel = level;
      let newXp = state.xp;
      let newXpToNext = state.xpToNext;
      let newQuest = quest;
      let won = state.gameWon;
      let newZone = state.currentZone;
      let unlockedZones = [...state.unlockedZones];

      if (success && data?.status !== 'error') {
        newXp = state.xp + quest.xpReward;
        while (newXp >= newXpToNext && newLevel < QUESTS.length) {
          newXp -= newXpToNext;
          newLevel++;
          newXpToNext = getXpToNext(newLevel);
        }
        if (newLevel > QUESTS.length) {
          won = true;
          newLevel = QUESTS.length;
        } else {
          newQuest = QUESTS[newLevel - 1];
          newZone = getZoneForLevel(newLevel);
          const zoneEntry = ZONES.find(z => z.id === newZone.id);
          if (zoneEntry && !unlockedZones.includes(zoneEntry.id)) {
            unlockedZones.push(zoneEntry.id);
          }
        }
      }

      set((state) => ({
        currentPath: data?.pwd?.replace('/home/', '~/') || '~/',
        contents: data?.contents || [],
        gameLevel: newLevel,
        xp: newXp,
        xpToNext: newXpToNext,
        activeQuest: newQuest,
        gameWon: won,
        currentZone: newZone,
        unlockedZones,
        commandCount: state.commandCount + 1,
        history: [...state.history, {
          id: Math.random().toString(36).substring(2, 9),
          command: normalized,
          output: data?.output || '',
          isError: data?.status === 'error'
        }]
      }));

    } catch {
      set((state) => ({
        history: [...state.history, {
          id: Math.random().toString(36).substring(2, 9),
          command: normalized,
          output: 'CONNECTION LOST — is the backend running? (python main.py)',
          isError: true
        }]
      }));
    }
  }
}));
