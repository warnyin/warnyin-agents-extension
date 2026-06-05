import { useEffect, useMemo, useRef, useState } from 'react';

import type { AgentSnapshot, WarnyinState } from './types';
import { vscode } from './vscode';

const TILE = 16;
const CHAR_W = 16;
const CHAR_H = 32;
const CHAR_FRAMES = 4;
const ROOM_ZOOM = 3;
const VIEW_TOP_ROW = 8;

type Direction = 'down' | 'up' | 'right' | 'left';
type AgentMode = 'idle' | 'walk' | 'type' | 'read';

interface PixelLayout {
  cols: number;
  rows: number;
  tiles: number[];
  furniture: Array<{ uid: string; type: string; col: number; row: number }>;
}

interface SpriteDef {
  src: string;
  width: number;
  height: number;
  footprintW: number;
  footprintH: number;
  mirrored?: boolean;
  wall?: boolean;
}

interface PixelAgent {
  id: string;
  source: AgentSnapshot;
  characterIndex: number;
  x: number;
  y: number;
  tileCol: number;
  tileRow: number;
  targetCol: number;
  targetRow: number;
  path: Array<{ col: number; row: number }>;
  mode: AgentMode;
  direction: Direction;
  frame: number;
  frameTime: number;
  bubble?: string;
}

const spriteDefs: Record<string, SpriteDef> = {
  BIN: asset('furniture/BIN/BIN.png', 16, 32, 1, 2),
  BOOKSHELF: asset('furniture/BOOKSHELF/BOOKSHELF.png', 32, 48, 2, 3),
  CACTUS: asset('furniture/CACTUS/CACTUS.png', 16, 32, 1, 2),
  CLOCK: asset('furniture/CLOCK/CLOCK.png', 16, 32, 1, 2, true),
  COFFEE: asset('furniture/COFFEE/COFFEE.png', 16, 16, 1, 1),
  COFFEE_TABLE: asset('furniture/COFFEE_TABLE/COFFEE_TABLE.png', 32, 32, 2, 2),
  CUSHIONED_BENCH: asset('furniture/CUSHIONED_BENCH/CUSHIONED_BENCH.png', 32, 32, 2, 2),
  DESK_FRONT: asset('furniture/DESK/DESK_FRONT.png', 48, 32, 3, 2),
  DESK_SIDE: asset('furniture/DESK/DESK_SIDE.png', 16, 64, 1, 4),
  DOUBLE_BOOKSHELF: asset('furniture/DOUBLE_BOOKSHELF/DOUBLE_BOOKSHELF.png', 48, 64, 3, 4),
  HANGING_PLANT: asset('furniture/HANGING_PLANT/HANGING_PLANT.png', 16, 32, 1, 2, true),
  LARGE_PAINTING: asset('furniture/LARGE_PAINTING/LARGE_PAINTING.png', 48, 32, 3, 2, true),
  LARGE_PLANT: asset('furniture/LARGE_PLANT/LARGE_PLANT.png', 32, 48, 2, 3),
  PC_BACK: asset('furniture/PC/PC_BACK.png', 16, 32, 1, 2),
  PC_FRONT_OFF: asset('furniture/PC/PC_FRONT_OFF.png', 16, 32, 1, 2),
  PC_FRONT_ON_1: asset('furniture/PC/PC_FRONT_ON_1.png', 16, 32, 1, 2),
  PC_FRONT_ON_2: asset('furniture/PC/PC_FRONT_ON_2.png', 16, 32, 1, 2),
  PC_FRONT_ON_3: asset('furniture/PC/PC_FRONT_ON_3.png', 16, 32, 1, 2),
  PC_SIDE: asset('furniture/PC/PC_SIDE.png', 16, 32, 1, 2),
  'PC_SIDE:left': asset('furniture/PC/PC_SIDE.png', 16, 32, 1, 2, false, true),
  PLANT: asset('furniture/PLANT/PLANT.png', 16, 32, 1, 2),
  PLANT_2: asset('furniture/PLANT_2/PLANT_2.png', 16, 32, 1, 2),
  SMALL_PAINTING: asset('furniture/SMALL_PAINTING/SMALL_PAINTING.png', 32, 32, 2, 2, true),
  SMALL_PAINTING_2: asset('furniture/SMALL_PAINTING_2/SMALL_PAINTING_2.png', 32, 32, 2, 2, true),
  SMALL_TABLE_FRONT: asset('furniture/SMALL_TABLE/SMALL_TABLE_FRONT.png', 32, 32, 2, 2),
  SMALL_TABLE_SIDE: asset('furniture/SMALL_TABLE/SMALL_TABLE_SIDE.png', 16, 32, 1, 2),
  SOFA_BACK: asset('furniture/SOFA/SOFA_BACK.png', 32, 32, 2, 2),
  SOFA_FRONT: asset('furniture/SOFA/SOFA_FRONT.png', 32, 32, 2, 2),
  SOFA_SIDE: asset('furniture/SOFA/SOFA_SIDE.png', 16, 48, 1, 3),
  'SOFA_SIDE:left': asset('furniture/SOFA/SOFA_SIDE.png', 16, 48, 1, 3, false, true),
  TABLE_FRONT: asset('furniture/TABLE_FRONT/TABLE_FRONT.png', 64, 32, 4, 2),
  WHITEBOARD: asset('furniture/WHITEBOARD/WHITEBOARD.png', 48, 32, 3, 2, true),
  WOODEN_CHAIR_BACK: asset('furniture/WOODEN_CHAIR/WOODEN_CHAIR_BACK.png', 16, 32, 1, 2),
  WOODEN_CHAIR_FRONT: asset('furniture/WOODEN_CHAIR/WOODEN_CHAIR_FRONT.png', 16, 32, 1, 2),
  WOODEN_CHAIR_SIDE: asset('furniture/WOODEN_CHAIR/WOODEN_CHAIR_SIDE.png', 16, 32, 1, 2),
  'WOODEN_CHAIR_SIDE:left': asset('furniture/WOODEN_CHAIR/WOODEN_CHAIR_SIDE.png', 16, 32, 1, 2, false, true),
};

const floorSources = Array.from({ length: 9 }, (_, index) => `assets/floors/floor_${index}.png`);
const characterSources = Array.from({ length: 6 }, (_, index) => `assets/characters/char_${index}.png`);
const seatTiles = [
  { col: 3, row: 13, dir: 'up' as Direction },
  { col: 7, row: 13, dir: 'up' as Direction },
  { col: 4, row: 17, dir: 'right' as Direction },
  { col: 4, row: 19, dir: 'right' as Direction },
  { col: 6, row: 17, dir: 'left' as Direction },
  { col: 6, row: 19, dir: 'left' as Direction },
  { col: 15, row: 14, dir: 'down' as Direction },
  { col: 14, row: 16, dir: 'up' as Direction },
  { col: 17, row: 19, dir: 'left' as Direction },
  { col: 1, row: 18, dir: 'right' as Direction },
];

export default function PixelAgentsOffice({ state }: { state: WarnyinState }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const agentsRef = useRef<Map<string, PixelAgent>>(new Map());
  const [layout, setLayout] = useState<PixelLayout | null>(null);
  const assets = usePixelAssets();
  const agentSnapshots = useMemo(() => {
    const activeIds = new Set(state.transcript.agents.map((agent) => agent.id));
    return [
      ...state.transcript.agents,
      ...state.roleBench.filter((agent) => !activeIds.has(agent.id)),
    ].slice(0, seatTiles.length);
  }, [state.roleBench, state.transcript.agents]);

  useEffect(() => {
    let cancelled = false;
    fetch('assets/default-layout-1.json')
      .then((response) => response.json())
      .then((data: PixelLayout) => {
        if (!cancelled) {
          setLayout(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLayout(createFallbackLayout());
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!layout) {
      return;
    }
    syncAgents(agentsRef.current, agentSnapshots, layout);
  }, [agentSnapshots, layout]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout || !assets.ready) {
      return undefined;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }

    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.imageSmoothingEnabled = false;
    };

    const loop = (time: number) => {
      const dt = Math.min(0.1, (time - last) / 1000);
      last = time;
      updateAgents(agentsRef.current, layout, dt);
      render(ctx, canvas, layout, assets, state, agentsRef.current);
      raf = window.requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener('resize', resize);
    raf = window.requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(raf);
    };
  }, [assets, layout, state]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!layout) {
      return;
    }
    const hit = screenToTile(event.currentTarget, event.clientX, event.clientY, layout);
    if (!hit) {
      return;
    }
    const agents = agentsRef.current;
    const clicked = findAgentAt(agents, hit.worldX, hit.worldY);
    if (clicked) {
      if (clicked.source.kind === 'main') {
        vscode.postMessage({ type: 'focusTerminal' });
      }
      return;
    }
    const main = [...agents.values()].find((agent) => agent.source.kind === 'main') ?? [...agents.values()][0];
    if (!main) {
      return;
    }
    const path = findPath(layout, main.tileCol, main.tileRow, hit.col, hit.row);
    if (path.length > 0) {
      main.path = path;
      main.targetCol = hit.col;
      main.targetRow = hit.row;
      main.mode = 'walk';
    }
  };

  return (
    <div className="pixelAgentsShell">
      <div className="pixelAgentsHeader">
        <strong>Warnyin Pixel Agents</strong>
        <span>{state.terminal.isOpen ? 'terminal linked' : 'terminal ready'}</span>
      </div>
      <div className="pixelAgentsCanvasFrame">
        <canvas
          ref={canvasRef}
          aria-label="Warnyin Pixel Agents office"
          onPointerDown={handlePointerDown}
        />
      </div>
      <div className="pixelAgentsFooter">
        <code>{state.commandHistory[0]?.command ?? state.transcript.latestCommand ?? '/warnyin:init'}</code>
        <span>{state.transcript.agents.length} agents</span>
      </div>
    </div>
  );
}

function usePixelAssets() {
  const [assets, setAssets] = useState<{
    ready: boolean;
    images: Map<string, HTMLImageElement>;
  }>({ ready: false, images: new Map() });

  useEffect(() => {
    let cancelled = false;
    const sources = new Set<string>([
      ...floorSources,
      ...characterSources,
      ...Object.values(spriteDefs).map((def) => def.src),
    ]);
    const images = new Map<string, HTMLImageElement>();
    Promise.allSettled([...sources].map((src) => loadImage(src).then((image) => images.set(src, image))))
      .then(() => {
        if (!cancelled) {
          setAssets({ ready: true, images });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return assets;
}

function render(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  layout: PixelLayout,
  assets: { ready: boolean; images: Map<string, HTMLImageElement> },
  state: WarnyinState,
  agents: Map<string, PixelAgent>,
) {
  const width = canvas.width;
  const height = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const viewport = roomViewport(canvas, layout);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#07112e');
  gradient.addColorStop(0.72, '#111a3f');
  gradient.addColorStop(1, '#4438b5');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawBackdropGrid(ctx, width, height, viewport.zoom);

  ctx.save();
  ctx.setTransform(
    viewport.zoom,
    0,
    0,
    viewport.zoom,
    viewport.offsetX,
    viewport.offsetY - VIEW_TOP_ROW * TILE * viewport.zoom,
  );
  drawManualOfficeFloor(ctx, layout);
  drawTiles(ctx, layout, assets);
  drawWallTitle(ctx, state);

  const renderables: Array<{ y: number; draw: () => void }> = [];
  for (const item of layout.furniture) {
    const def = spriteDefs[item.type];
    const image = def ? assets.images.get(def.src) : undefined;
    if (!def || !image) {
      continue;
    }
    renderables.push({
      y: (item.row + def.footprintH) * TILE,
      draw: () => drawFurnitureSprite(ctx, image, def, item.col * TILE, item.row * TILE),
    });
  }
  for (const agent of agents.values()) {
    const image = assets.images.get(characterSources[agent.characterIndex % characterSources.length]);
    if (!image) {
      continue;
    }
    renderables.push({
      y: agent.y + CHAR_H,
      draw: () => drawCharacter(ctx, image, agent),
    });
  }
  renderables.sort((a, b) => a.y - b.y).forEach((item) => item.draw());
  drawTerminalScreen(ctx, state, layout.cols * TILE - 118, 18);
  ctx.restore();
}

function drawManualOfficeFloor(ctx: CanvasRenderingContext2D, layout: PixelLayout) {
  const startRow = 10;
  const endRow = layout.rows - 2;
  ctx.fillStyle = '#3e496d';
  ctx.fillRect(0, startRow * TILE, layout.cols * TILE, TILE);
  ctx.fillRect(0, startRow * TILE, TILE, (endRow - startRow + 1) * TILE);
  ctx.fillRect((layout.cols - 2) * TILE, startRow * TILE, TILE, (endRow - startRow + 1) * TILE);
  for (let row = startRow + 1; row <= endRow; row++) {
    for (let col = 1; col < layout.cols - 2; col++) {
      const leftZone = col < 10;
      const meetingZone = row >= 19 && col >= 11;
      ctx.fillStyle = meetingZone
        ? (row + col) % 2 === 0 ? '#e7e7e7' : '#1b203a'
        : leftZone
          ? (row + col) % 2 === 0 ? '#9b9b92' : '#7f827c'
          : '#8b8b86';
      ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
    }
  }
}

function drawTiles(
  ctx: CanvasRenderingContext2D,
  layout: PixelLayout,
  assets: { images: Map<string, HTMLImageElement> },
) {
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      const tile = layout.tiles[row * layout.cols + col] ?? 255;
      if (tile === 255) {
        continue;
      }
      if (tile === 0) {
        ctx.fillStyle = '#3e496d';
        ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
        continue;
      }
      const floor = assets.images.get(floorSources[Math.max(0, Math.min(tile - 1, floorSources.length - 1))]);
      if (floor) {
        ctx.drawImage(floor, col * TILE, row * TILE, TILE, TILE);
      } else {
        ctx.fillStyle = tile === 7 ? '#9a6848' : '#59788d';
        ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
      }
    }
  }
}

function drawWallTitle(ctx: CanvasRenderingContext2D, state: WarnyinState) {
  ctx.fillStyle = '#ccebdc';
  ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('WARNYIN AGENTS', 116, 174);
  ctx.fillStyle = state.installed ? '#86f2c6' : '#f1b453';
  ctx.font = 'bold 4px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(state.installed ? 'workflow online' : 'workflow locked', 129, 182);
}

function drawFurnitureSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  def: SpriteDef,
  x: number,
  y: number,
) {
  const drawY = y + def.footprintH * TILE - def.height;
  if (def.mirrored) {
    ctx.save();
    ctx.translate(x + def.width, drawY);
    ctx.scale(-1, 1);
    ctx.drawImage(image, 0, 0, def.width, def.height);
    ctx.restore();
    return;
  }
  ctx.drawImage(image, x, drawY, def.width, def.height);
}

function drawCharacter(ctx: CanvasRenderingContext2D, image: HTMLImageElement, agent: PixelAgent) {
  const dirRow = agent.direction === 'down' ? 0 : agent.direction === 'up' ? 1 : 2;
  const frame = agent.mode === 'walk'
    ? agent.frame % 4
    : agent.mode === 'type' || agent.mode === 'read'
      ? agent.frame % 2
      : 1;
  const sx = frame * CHAR_W;
  const sy = dirRow * CHAR_H;
  const x = Math.round(agent.x - CHAR_W / 2);
  const y = Math.round(agent.y - CHAR_H + 6);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  ctx.fillRect(x + 2, y + CHAR_H - 4, CHAR_W - 4, 3);
  if (agent.direction === 'left') {
    ctx.save();
    ctx.translate(x + CHAR_W, y);
    ctx.scale(-1, 1);
    ctx.drawImage(image, sx, sy, CHAR_W, CHAR_H, 0, 0, CHAR_W, CHAR_H);
    ctx.restore();
  } else {
    ctx.drawImage(image, sx, sy, CHAR_W, CHAR_H, x, y, CHAR_W, CHAR_H);
  }
  drawAgentBubble(ctx, agent, x + CHAR_W / 2, y - 4);
}

function drawAgentBubble(ctx: CanvasRenderingContext2D, agent: PixelAgent, x: number, y: number) {
  if (!agent.bubble) {
    return;
  }
  const text = agent.bubble;
  const w = Math.max(16, text.length * 4 + 6);
  ctx.fillStyle = agent.source.status === 'blocked' || agent.source.status === 'failed' ? '#b65b4c' : '#fff8eb';
  ctx.fillRect(x - w / 2, y - 10, w, 9);
  ctx.strokeStyle = '#4b2414';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - w / 2, y - 10, w, 9);
  ctx.fillStyle = agent.source.status === 'blocked' || agent.source.status === 'failed' ? '#fff8eb' : '#4b2414';
  ctx.font = 'bold 4px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(text.slice(0, 12), x - w / 2 + 3, y - 3);
}

function drawTerminalScreen(ctx: CanvasRenderingContext2D, state: WarnyinState, x: number, y: number) {
  ctx.fillStyle = '#08122d';
  ctx.fillRect(x, y, 104, 58);
  ctx.strokeStyle = '#4aa3ff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, 104, 58);
  ctx.fillStyle = '#26365e';
  ctx.fillRect(x, y, 104, 9);
  ctx.fillStyle = '#ccebdc';
  ctx.font = 'bold 4px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('Warnyin Terminal', x + 5, y + 6);
  ctx.fillStyle = '#86f2c6';
  ctx.fillText(`$ ${state.terminal.launchCommand}`, x + 8, y + 20);
  ctx.fillStyle = '#8bc6ff';
  ctx.fillText((state.commandHistory[0]?.command ?? state.transcript.latestCommand ?? '/warnyin:init').slice(0, 30), x + 8, y + 31);
  ctx.fillStyle = '#d7c4ff';
  ctx.fillText(`agents ${state.transcript.agents.length} sessions ${state.transcript.sessionCount}`, x + 8, y + 42);
}

function drawBackdropGrid(ctx: CanvasRenderingContext2D, width: number, height: number, zoom: number) {
  ctx.strokeStyle = 'rgba(151, 184, 230, 0.08)';
  ctx.lineWidth = Math.max(1, zoom / 3);
  for (let x = -width; x < width * 2; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + width * 0.42, height);
    ctx.stroke();
  }
  for (let x = 0; x < width * 2; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - width * 0.42, height);
    ctx.stroke();
  }
}

function syncAgents(agents: Map<string, PixelAgent>, snapshots: AgentSnapshot[], layout: PixelLayout) {
  const seen = new Set<string>();
  snapshots.forEach((snapshot, index) => {
    seen.add(snapshot.id);
    const seat = seatTiles[index % seatTiles.length];
    const existing = agents.get(snapshot.id);
    const mode = modeForAgent(snapshot);
    const bubble = bubbleForAgent(snapshot);
    if (existing) {
      existing.source = snapshot;
      existing.mode = existing.mode === 'walk' ? 'walk' : mode;
      existing.bubble = bubble;
      if (snapshot.status === 'running' || snapshot.status === 'thinking') {
        existing.targetCol = seat.col;
        existing.targetRow = seat.row;
      }
      return;
    }
    agents.set(snapshot.id, {
      id: snapshot.id,
      source: snapshot,
      characterIndex: index,
      x: seat.col * TILE + TILE / 2,
      y: seat.row * TILE + TILE / 2,
      tileCol: seat.col,
      tileRow: seat.row,
      targetCol: seat.col,
      targetRow: seat.row,
      path: [],
      mode,
      direction: seat.dir,
      frame: 0,
      frameTime: 0,
      bubble,
    });
  });
  for (const id of [...agents.keys()]) {
    if (!seen.has(id)) {
      agents.delete(id);
    }
  }
  for (const agent of agents.values()) {
    if ((agent.source.status === 'running' || agent.source.status === 'thinking') && agent.path.length === 0) {
      const path = findPath(layout, agent.tileCol, agent.tileRow, agent.targetCol, agent.targetRow);
      if (path.length > 0) {
        agent.path = path;
      }
    }
  }
}

function updateAgents(agents: Map<string, PixelAgent>, layout: PixelLayout, dt: number) {
  for (const agent of agents.values()) {
    agent.frameTime += dt;
    const frameDuration = agent.mode === 'walk' ? 0.15 : 0.32;
    if (agent.frameTime >= frameDuration) {
      agent.frameTime -= frameDuration;
      agent.frame = (agent.frame + 1) % CHAR_FRAMES;
    }
    if (agent.path.length === 0) {
      if (agent.mode === 'walk') {
        agent.mode = modeForAgent(agent.source);
      }
      continue;
    }
    agent.mode = 'walk';
    const next = agent.path[0];
    const targetX = next.col * TILE + TILE / 2;
    const targetY = next.row * TILE + TILE / 2;
    const dx = targetX - agent.x;
    const dy = targetY - agent.y;
    agent.direction = Math.abs(dx) > Math.abs(dy)
      ? dx >= 0 ? 'right' : 'left'
      : dy >= 0 ? 'down' : 'up';
    const distance = Math.hypot(dx, dy);
    const step = 48 * dt;
    if (distance <= step) {
      agent.x = targetX;
      agent.y = targetY;
      agent.tileCol = next.col;
      agent.tileRow = next.row;
      agent.path.shift();
      if (!isWalkable(layout, agent.tileCol, agent.tileRow)) {
        agent.path = [];
      }
      continue;
    }
    agent.x += (dx / distance) * step;
    agent.y += (dy / distance) * step;
  }
}

function findPath(layout: PixelLayout, fromCol: number, fromRow: number, toCol: number, toRow: number) {
  if (!isWalkable(layout, toCol, toRow)) {
    return [];
  }
  const queue = [{ col: fromCol, row: fromRow }];
  const cameFrom = new Map<string, string>();
  const startKey = `${fromCol},${fromRow}`;
  cameFrom.set(startKey, '');
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (current.col === toCol && current.row === toRow) {
      break;
    }
    for (const next of neighbors(current.col, current.row)) {
      const key = `${next.col},${next.row}`;
      if (cameFrom.has(key) || !isWalkable(layout, next.col, next.row)) {
        continue;
      }
      cameFrom.set(key, `${current.col},${current.row}`);
      queue.push(next);
    }
  }
  const endKey = `${toCol},${toRow}`;
  if (!cameFrom.has(endKey)) {
    return [];
  }
  const path: Array<{ col: number; row: number }> = [];
  let current = endKey;
  while (current && current !== startKey) {
    const [col, row] = current.split(',').map(Number);
    path.unshift({ col, row });
    current = cameFrom.get(current) ?? '';
  }
  return path;
}

function neighbors(col: number, row: number) {
  return [
    { col: col + 1, row },
    { col: col - 1, row },
    { col, row: row + 1 },
    { col, row: row - 1 },
  ];
}

function isWalkable(layout: PixelLayout, col: number, row: number) {
  if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) {
    return false;
  }
  const tile = layout.tiles[row * layout.cols + col] ?? 255;
  return tile !== 255 && tile !== 0;
}

function findAgentAt(agents: Map<string, PixelAgent>, x: number, y: number) {
  return [...agents.values()]
    .sort((a, b) => b.y - a.y)
    .find((agent) => Math.abs(agent.x - x) <= 10 && y >= agent.y - 28 && y <= agent.y + 6);
}

function screenToTile(canvas: HTMLCanvasElement, clientX: number, clientY: number, layout: PixelLayout) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const viewport = roomViewport(canvas, layout);
  const worldX = ((clientX - rect.left) * dpr - viewport.offsetX) / viewport.zoom;
  const worldY = ((clientY - rect.top) * dpr - viewport.offsetY) / viewport.zoom + VIEW_TOP_ROW * TILE;
  return {
    worldX,
    worldY,
    col: Math.floor(worldX / TILE),
    row: Math.floor(worldY / TILE),
  };
}

function roomViewport(canvas: HTMLCanvasElement, layout: PixelLayout) {
  const width = canvas.width;
  const height = canvas.height;
  const visibleRows = layout.rows - VIEW_TOP_ROW;
  const zoom = Math.max(
    1,
    Math.min(
      ROOM_ZOOM,
      width / (layout.cols * TILE * 1.08),
      height / (visibleRows * TILE * 1.12),
    ),
  );
  const roomW = layout.cols * TILE * zoom;
  const roomH = visibleRows * TILE * zoom;
  return {
    zoom,
    offsetX: Math.floor((width - roomW) / 2),
    offsetY: Math.floor((height - roomH) / 2) + 6,
  };
}

function modeForAgent(agent: AgentSnapshot): AgentMode {
  if (agent.status === 'running' || agent.status === 'thinking') {
    return isReadingTool(agent.toolName) ? 'read' : 'type';
  }
  return 'idle';
}

function bubbleForAgent(agent: AgentSnapshot): string | undefined {
  if (agent.status === 'blocked') {
    return '!';
  }
  if (agent.status === 'failed') {
    return 'fail';
  }
  if (agent.status === 'running' || agent.status === 'thinking') {
    return agent.toolName?.slice(0, 8) ?? 'run';
  }
  return undefined;
}

function isReadingTool(tool: string | undefined) {
  if (!tool) {
    return false;
  }
  return ['Read', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch'].includes(tool);
}

function asset(
  src: string,
  width: number,
  height: number,
  footprintW: number,
  footprintH: number,
  wall = false,
  mirrored = false,
): SpriteDef {
  return {
    src: `assets/${src}`,
    width,
    height,
    footprintW,
    footprintH,
    wall,
    mirrored,
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function createFallbackLayout(): PixelLayout {
  const cols = 21;
  const rows = 22;
  return {
    cols,
    rows,
    tiles: Array.from({ length: cols * rows }, (_, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      if (row < 10 || row > 20 || col > 19) {
        return 255;
      }
      if (row === 10 || col === 0 || col === 19) {
        return 0;
      }
      return col < 10 ? 7 : 1;
    }),
    furniture: [
      { uid: 'desk-main', type: 'DESK_FRONT', col: 2, row: 12 },
      { uid: 'pc-main', type: 'PC_FRONT_ON_1', col: 3, row: 12 },
      { uid: 'desk-dev', type: 'DESK_FRONT', col: 6, row: 12 },
      { uid: 'pc-dev', type: 'PC_FRONT_ON_2', col: 7, row: 12 },
      { uid: 'shelf', type: 'DOUBLE_BOOKSHELF', col: 2, row: 9 },
      { uid: 'plant', type: 'PLANT', col: 18, row: 10 },
    ],
  };
}
