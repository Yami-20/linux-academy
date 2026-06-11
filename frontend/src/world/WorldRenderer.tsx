import { useEffect, useRef, useState } from 'react';
import { Application, Graphics, Text, Container, TextStyle } from 'pixi.js';
import { useEngineStore, ZONES } from '../store/engineStore';

const ZONE_COLORS: Record<string, { bg: number; border: number; ground: number; accent: number }> = {
  home:     { bg: 0x2d5a27, border: 0x1a3a16, ground: 0x4a7c4e, accent: 0x7ec850 },
  fortress: { bg: 0x3d2a52, border: 0x251634, ground: 0x6b4c8a, accent: 0xa07cc8 },
  projects: { bg: 0x7a4a18, border: 0x4a2c0a, ground: 0xc97c2e, accent: 0xf0a850 },
  archives: { bg: 0x184a52, border: 0x0a2c34, ground: 0x2e7a8a, accent: 0x50b0c8 },
  core:     { bg: 0x521818, border: 0x340a0a, ground: 0x8a2e2e, accent: 0xc85050 },
};

export const WorldRenderer = () => {
  const containerRef      = useRef<HTMLDivElement>(null);
  const appRef            = useRef<Application | null>(null);
  const itemsContainerRef = useRef<Container | null>(null);
  const bgRef             = useRef<Graphics | null>(null);
  const decorRef          = useRef<Container | null>(null);
  const [isReady, setIsReady] = useState(false);

  const contents     = useEngineStore(s => s.contents);
  const currentPath  = useEngineStore(s => s.currentPath);
  const currentZone  = useEngineStore(s => s.currentZone);
  const executeCommand = useEngineStore(s => s.executeCommand);
  const gameLevel    = useEngineStore(s => s.gameLevel);

  // ── Init PixiJS once ───────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const app = new Application();
      await app.init({ background: 0x0d1117, resizeTo: window, antialias: true });
      if (!mounted) { app.destroy(true, { children: true, texture: true }); return; }
      if (containerRef.current) containerRef.current.appendChild(app.canvas as HTMLCanvasElement);

      const bg = new Graphics();
      app.stage.addChild(bg);
      bgRef.current = bg;

      const decor = new Container();
      app.stage.addChild(decor);
      decorRef.current = decor;

      const items = new Container();
      app.stage.addChild(items);
      itemsContainerRef.current = items;

      appRef.current = app;
      setIsReady(true);
    };
    init();
    return () => {
      mounted = false;
      if (appRef.current) { appRef.current.destroy(true, { children: true, texture: true }); appRef.current = null; }
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  // ── Draw world whenever zone/path/contents change ──────────────────────
  useEffect(() => {
    if (!isReady || !appRef.current || !bgRef.current || !itemsContainerRef.current || !decorRef.current) return;

    const app   = appRef.current;
    const bg    = bgRef.current;
    const items = itemsContainerRef.current;
    const decor = decorRef.current;

    const zoneId = currentZone?.id ?? 'home';
    const colors = ZONE_COLORS[zoneId] ?? ZONE_COLORS.home;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const PAD = 12;
    const TOP = 90;      // below HUD
    const BOT = 240;     // above terminal

    // ── Draw background ─────────────────────────────────────────────────
    bg.clear();

    // Sky / outer dark
    bg.rect(0, 0, W, H);
    bg.fill({ color: 0x0d1117 });

    // Ground zone rect
    const zoneH = H - TOP - BOT - PAD;
    bg.roundRect(PAD, TOP, W - PAD * 2, zoneH, 8);
    bg.fill({ color: colors.ground });
    bg.stroke({ width: 3, color: colors.border });

    // Subtle grid overlay (Stardew-style ground texture)
    const gridSize = 48;
    bg.setStrokeStyle({ width: 1, color: colors.border, alpha: 0.25 });
    for (let gx = PAD; gx < W - PAD; gx += gridSize) {
      bg.moveTo(gx, TOP);
      bg.lineTo(gx, TOP + zoneH);
    }
    for (let gy = TOP; gy < TOP + zoneH; gy += gridSize) {
      bg.moveTo(PAD, gy);
      bg.lineTo(W - PAD, gy);
    }
    bg.stroke();

    // Zone name label (bottom-right corner of the zone)
    bg.setStrokeStyle({ width: 0 });

    // ── Decorative elements (trees/rocks/crystals by zone) ──────────────
    decor.removeChildren();

    const drawTree = (x: number, y: number, scale = 1) => {
      const g = new Graphics();
      // trunk
      g.rect(-4 * scale, 0, 8 * scale, 16 * scale);
      g.fill({ color: 0x8B5E3C });
      // canopy
      g.poly([-16 * scale, 0, 16 * scale, 0, 0, -28 * scale]);
      g.fill({ color: colors.accent });
      g.x = x; g.y = y;
      decor.addChild(g);
    };

    const drawRock = (x: number, y: number, scale = 1) => {
      const g = new Graphics();
      g.ellipse(0, 0, 14 * scale, 9 * scale);
      g.fill({ color: 0x888888 });
      g.stroke({ width: 1, color: 0x555555 });
      g.x = x; g.y = y;
      decor.addChild(g);
    };

    const drawCrystal = (x: number, y: number, scale = 1) => {
      const g = new Graphics();
      g.poly([0, -20 * scale, 8 * scale, 0, 0, 8 * scale, -8 * scale, 0]);
      g.fill({ color: colors.accent });
      g.stroke({ width: 1, color: 0xffffff, alpha: 0.3 });
      g.x = x; g.y = y;
      decor.addChild(g);
    };

    // Decorative border elements based on zone
    const decorY = TOP + zoneH - 30;
    if (zoneId === 'home') {
      for (let i = 0; i < 5; i++) drawTree(PAD + 40 + i * (W / 6), decorY, 0.8);
      drawRock(W - 80, TOP + 40, 1.2); drawRock(W - 50, TOP + 55, 0.8);
    } else if (zoneId === 'fortress') {
      // Fortress pillars
      for (let i = 0; i < 4; i++) {
        const g = new Graphics();
        g.rect(0, 0, 18, 50);
        g.fill({ color: 0x554488 });
        g.stroke({ width: 2, color: 0x332266 });
        g.x = PAD + 30 + i * (W / 5);
        g.y = decorY - 35;
        decor.addChild(g);
      }
      for (let i = 0; i < 6; i++) drawCrystal(PAD + 60 + i * (W / 7), decorY - 10, 0.7);
    } else if (zoneId === 'projects') {
      // Gear-like structures
      for (let i = 0; i < 3; i++) {
        const g = new Graphics();
        g.circle(0, 0, 20);
        g.fill({ color: 0xd4880a });
        g.circle(0, 0, 10);
        g.fill({ color: colors.bg });
        g.x = PAD + 80 + i * (W / 4);
        g.y = decorY - 10;
        decor.addChild(g);
      }
      for (let i = 0; i < 4; i++) drawRock(PAD + 50 + i * (W / 5), decorY + 5, 0.6);
    } else if (zoneId === 'archives') {
      // Data pillars
      for (let i = 0; i < 5; i++) {
        const g = new Graphics();
        g.rect(0, 0, 12, 60 + i * 8);
        g.fill({ color: 0x2a7a8a });
        g.x = PAD + 50 + i * (W / 6);
        g.y = decorY - 45 - i * 8;
        decor.addChild(g);
      }
    } else if (zoneId === 'core') {
      // Lava / core elements
      for (let i = 0; i < 7; i++) {
        const g = new Graphics();
        g.circle(0, 0, 6 + (i % 3) * 3);
        g.fill({ color: i % 2 === 0 ? 0xff4422 : 0xff9900 });
        g.x = PAD + 40 + i * (W / 8);
        g.y = decorY + 8;
        decor.addChild(g);
      }
      for (let i = 0; i < 4; i++) drawCrystal(PAD + 70 + i * (W / 5), decorY - 15, 1.2);
    }

    // Zone label
    const zoneLabel = new Text({
      text: `[ ${currentZone?.name ?? 'Home Base'} ]  •  ${currentPath}`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fill: 0xffffff, alpha: 0.5 })
    });
    zoneLabel.x = PAD + 12;
    zoneLabel.y = TOP + zoneH - 20;
    decor.addChild(zoneLabel);

    // ── Draw file/dir icons ──────────────────────────────────────────────
    items.removeChildren();

    const ITEM_W   = 80;
    const ITEM_H   = 80;
    const cols     = Math.max(1, Math.floor((W - PAD * 2 - 40) / (ITEM_W + 16)));
    const startX   = PAD + 24;
    const startY   = TOP + 20;

    contents.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const ix  = startX + col * (ITEM_W + 16);
      const iy  = startY + row * (ITEM_H + 10);

      if (iy + ITEM_H > TOP + zoneH - 40) return; // don't overflow zone

      const group = new Container();
      const icon  = new Graphics();

      if (item.is_dir) {
        // Folder body
        icon.roundRect(0, 8, 50, 36, 3);
        icon.fill({ color: 0xc97c2e });
        icon.stroke({ width: 2, color: 0x8a4a10 });
        // Folder tab
        icon.roundRect(0, 2, 22, 12, 2);
        icon.fill({ color: 0xe89940 });
        // Lock icon for system dirs
        if (['projects', 'docs'].includes(item.name)) {
          icon.circle(25, 26, 5);
          icon.fill({ color: 0xffe066 });
        }
      } else {
        // File shadow
        icon.rect(4, 4, 38, 48);
        icon.fill({ color: 0x000000, alpha: 0.3 });
        // File body
        icon.rect(0, 0, 38, 48);
        icon.fill({ color: 0xf0f0f0 });
        icon.stroke({ width: 2, color: 0xcccccc });
        // Folded corner
        icon.poly([28, 0, 38, 0, 38, 10]);
        icon.fill({ color: 0xcccccc });
        // Text lines
        icon.rect(6, 14, 18, 3); icon.fill({ color: 0xaaaaaa });
        icon.rect(6, 21, 22, 3); icon.fill({ color: 0xaaaaaa });
        icon.rect(6, 28, 16, 3); icon.fill({ color: 0xaaaaaa });

        // Color-code by extension
        const ext = item.name.split('.').pop() ?? '';
        const extColors: Record<string, number> = {
          sh: 0x50c878, txt: 0x87ceeb, log: 0xffa500,
          bak: 0x888888, md: 0xa8d8ea, json: 0xffe066,
        };
        if (extColors[ext]) {
          icon.rect(0, 0, 38, 5);
          icon.fill({ color: extColors[ext] });
        }
      }

      group.addChild(icon);

      // Label
      const maxChars = 9;
      const labelText = item.name.length > maxChars ? item.name.slice(0, maxChars - 1) + '…' : item.name;
      const label = new Text({
        text: labelText,
        style: new TextStyle({
          fontFamily: 'monospace',
          fontSize: 10,
          fill: 0xffffff,
          fontWeight: 'bold',
          dropShadow: { color: 0x000000, blur: 3, distance: 1 }
        })
      });
      label.x = Math.max(0, (item.is_dir ? 25 : 19) - label.width / 2);
      label.y = item.is_dir ? 48 : 52;
      group.addChild(label);

      group.x = ix;
      group.y = iy;

      // Spawn animation
      group.scale.set(0);
      const spd = 0.08 + index * 0.01;
      const anim = () => {
        if (group.scale.x < 1) group.scale.set(Math.min(1, group.scale.x + spd));
        else app.ticker.remove(anim);
      };
      app.ticker.add(anim);

      // Interaction
      group.eventMode = 'static';
      group.cursor = 'pointer';
      let dragging = false;
      let startP = { x: 0, y: 0 };
      let dragOff = { x: 0, y: 0 };

      group.on('pointerover', () => { icon.tint = 0xddddff; });
      group.on('pointerout', () => { if (!dragging) icon.tint = 0xffffff; });
      group.on('pointerdown', (e: any) => {
        dragging = true; icon.tint = 0xaaaaee;
        startP = { x: group.x, y: group.y };
        dragOff = { x: group.x - e.global.x, y: group.y - e.global.y };
      });
      group.on('globalpointermove', (e: any) => {
        if (dragging) { group.x = e.global.x + dragOff.x; group.y = e.global.y + dragOff.y; }
      });
      group.on('pointerup', () => {
        dragging = false; icon.tint = 0xffffff;
        const dist = Math.abs(group.x - startP.x) + Math.abs(group.y - startP.y);
        if (dist < 5) {
          if (item.is_dir) executeCommand(`cd ${item.name}`);
          else executeCommand(`cat ${item.name}`);
        }
      });
      group.on('pointerupoutside', () => { dragging = false; icon.tint = 0xffffff; });

      items.addChild(group);
    });

    // "Empty" hint
    if (contents.length === 0) {
      const hint = new Text({
        text: 'Empty directory — try touch <filename> or mkdir <dirname>',
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 12, fill: 0xffffff, alpha: 0.4 })
      });
      hint.x = W / 2 - hint.width / 2;
      hint.y = TOP + zoneH / 2 - 10;
      items.addChild(hint);
    }

  }, [contents, currentPath, currentZone, isReady, gameLevel, executeCommand]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};
