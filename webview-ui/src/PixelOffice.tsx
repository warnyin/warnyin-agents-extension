import { Download, Edit3, MousePointer2, Redo2, RotateCcw, Save, Trash2, Undo2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  AgentSnapshot,
  FurnitureItem,
  FurnitureKind,
  OfficeLayout,
  OfficeSeat,
  RolePaletteEntry,
  WarnyinState,
} from './types';
import { FURNITURE_ASSET_MANIFEST, drawPixelSprite } from './pixelAssets';
import { vscode } from './vscode';

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 520;
const HISTORY_LIMIT = 50;

interface BulkDragOrigin {
  point: { x: number; y: number };
  layout: OfficeLayout;
  seatIds: string[];
  furnitureIds: string[];
}

const statusColors: Record<string, string> = {
  offline: '#8a7d6d',
  waiting: '#c28a2c',
  thinking: '#3e4f7d',
  running: '#2d6f62',
  blocked: '#b65b4c',
  complete: '#8a9a62',
  failed: '#b65b4c',
};

export default function PixelOffice({ state }: { state: WarnyinState }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draftLayout, setDraftLayout] = useState<OfficeLayout>(state.officeLayout);
  const [layoutHistory, setLayoutHistory] = useState<{ past: OfficeLayout[]; future: OfficeLayout[] }>({
    past: [],
    future: [],
  });
  const [dragSeatId, setDragSeatId] = useState<string | null>(null);
  const [dragFurnitureId, setDragFurnitureId] = useState<string | null>(null);
  const [bulkDragOrigin, setBulkDragOrigin] = useState<BulkDragOrigin | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [selectedFurnitureIds, setSelectedFurnitureIds] = useState<string[]>([]);
  const [placementKind, setPlacementKind] = useState<FurnitureKind | ''>('');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetName, setPresetName] = useState('');
  const agents = useMemo(() => {
    const activeIds = new Set(state.transcript.agents.map((agent) => agent.id));
    return [
      ...state.transcript.agents,
      ...state.roleBench.filter((agent) => !activeIds.has(agent.id)),
    ].slice(0, 13);
  }, [state.roleBench, state.transcript.agents]);
  const activeLayout = editMode ? draftLayout : state.officeLayout;
  const placements = useMemo(() => placeAgents(agents, activeLayout), [activeLayout, agents]);
  const selectedAgent = placements.find(({ agent }) => agent.id === selectedAgentId)?.agent;
  const selectedPreset = state.officePresets.find((preset) => preset.id === selectedPresetId);
  const palette = useMemo(() => {
    return new Map(state.rolePalette.entries.map((entry) => [entry.role, entry]));
  }, [state.rolePalette.entries]);

  useEffect(() => {
    if (!editMode) {
      setDraftLayout(state.officeLayout);
      setLayoutHistory({ past: [], future: [] });
      setBulkDragOrigin(null);
      setSelectedSeatIds([]);
      setSelectedFurnitureIds([]);
    }
  }, [editMode, state.officeLayout]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    let frame = 0;
    let animationId = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform((rect.width * dpr) / LOGICAL_WIDTH, 0, 0, (rect.height * dpr) / LOGICAL_HEIGHT, 0, 0);
    };

    const render = () => {
      frame += 1;
      drawOffice(ctx, placements, state, activeLayout, palette, editMode, selectedAgentId, selectedSeatIds, selectedFurnitureIds, frame);
      animationId = window.requestAnimationFrame(render);
    };

    resize();
    render();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationId);
    };
  }, [activeLayout, editMode, palette, placements, selectedAgentId, selectedFurnitureIds, selectedSeatIds, state]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointerToLogicalPoint(event);
    if (!editMode) {
      const placement = findAgentAt(placements, point.x, point.y);
      if (!placement) {
        setSelectedAgentId(null);
        return;
      }
      if (placement.agent.kind === 'main') {
        vscode.postMessage({ type: 'focusTerminal' });
      }
      setSelectedAgentId(placement.agent.id);
      return;
    }
    const furniture = findFurnitureAt(activeLayout.furniture, point.x, point.y);
    if (furniture) {
      const nextFurnitureIds = event.shiftKey
        ? toggleSelection(selectedFurnitureIds, furniture.id)
        : selectedFurnitureIds.includes(furniture.id)
          ? selectedFurnitureIds
          : [furniture.id];
      const nextSeatIds = event.shiftKey ? selectedSeatIds : selectedFurnitureIds.includes(furniture.id) ? selectedSeatIds : [];
      setSelectedFurnitureIds(nextFurnitureIds);
      setSelectedSeatIds(nextSeatIds);
      setSelectedAgentId(null);
      setPlacementKind('');
      if (event.shiftKey) {
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      pushLayoutHistory(draftLayout);
      setDragFurnitureId(furniture.id);
      if (nextFurnitureIds.length + nextSeatIds.length > 1) {
        setBulkDragOrigin({
          point,
          layout: cloneLayout(draftLayout),
          seatIds: nextSeatIds,
          furnitureIds: nextFurnitureIds,
        });
      } else {
        setBulkDragOrigin(null);
        moveFurniture(furniture.id, point.x, point.y);
      }
      return;
    }
    const seat = findSeatAt(activeLayout.seats, point.x, point.y);
    if (!seat) {
      if (placementKind) {
        addFurniture(placementKind, point.x, point.y);
      } else {
        setSelectedSeatIds([]);
        setSelectedFurnitureIds([]);
      }
      return;
    }
    const nextSeatIds = event.shiftKey
      ? toggleSelection(selectedSeatIds, seat.id)
      : selectedSeatIds.includes(seat.id)
        ? selectedSeatIds
        : [seat.id];
    const nextFurnitureIds = event.shiftKey ? selectedFurnitureIds : selectedSeatIds.includes(seat.id) ? selectedFurnitureIds : [];
    setSelectedSeatIds(nextSeatIds);
    setSelectedFurnitureIds(nextFurnitureIds);
    setSelectedAgentId(null);
    setPlacementKind('');
    if (event.shiftKey) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    pushLayoutHistory(draftLayout);
    setDragSeatId(seat.id);
    if (nextSeatIds.length + nextFurnitureIds.length > 1) {
      setBulkDragOrigin({
        point,
        layout: cloneLayout(draftLayout),
        seatIds: nextSeatIds,
        furnitureIds: nextFurnitureIds,
      });
    } else {
      setBulkDragOrigin(null);
      moveSeat(seat.id, point.x, point.y);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!editMode) {
      return;
    }
    const point = pointerToLogicalPoint(event);
    if (bulkDragOrigin && (dragSeatId || dragFurnitureId)) {
      moveSelection(bulkDragOrigin, point);
      return;
    }
    if (dragSeatId) {
      moveSeat(dragSeatId, point.x, point.y);
    }
    if (dragFurnitureId) {
      moveFurniture(dragFurnitureId, point.x, point.y);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragSeatId(null);
    setDragFurnitureId(null);
    setBulkDragOrigin(null);
  };

  const moveSeat = (seatId: string, x: number, y: number) => {
    setDraftLayout((layout) => ({
      ...layout,
      seats: layout.seats.map((seat) => seat.id === seatId ? {
        ...seat,
        x: clamp(Math.round(x / 14) * 14, 84, 876),
        y: clamp(Math.round(y / 14) * 14, 178, 386),
      } : seat),
      updatedAt: Date.now(),
    }));
  };

  const addFurniture = (kind: FurnitureKind, x: number, y: number) => {
    const id = `f-${kind}-${Date.now().toString(36)}`;
    pushLayoutHistory(draftLayout);
    setDraftLayout((layout) => ({
      ...layout,
      furniture: [
        ...layout.furniture,
        {
          id,
          kind,
          x: clamp(Math.round(x / 14) * 14, 52, 908),
          y: clamp(Math.round(y / 14) * 14, 52, 444),
        },
      ],
      updatedAt: Date.now(),
    }));
    setSelectedFurnitureIds([id]);
    setSelectedSeatIds([]);
  };

  const moveFurniture = (furnitureId: string, x: number, y: number) => {
    setDraftLayout((layout) => ({
      ...layout,
      furniture: layout.furniture.map((item) => item.id === furnitureId ? {
        ...item,
        x: clamp(Math.round(x / 14) * 14, 52, 908),
        y: clamp(Math.round(y / 14) * 14, 52, 444),
      } : item),
      updatedAt: Date.now(),
    }));
  };

  const moveSelection = (origin: BulkDragOrigin, point: { x: number; y: number }) => {
    const deltaX = Math.round((point.x - origin.point.x) / 14) * 14;
    const deltaY = Math.round((point.y - origin.point.y) / 14) * 14;
    const seatIds = new Set(origin.seatIds);
    const furnitureIds = new Set(origin.furnitureIds);
    setDraftLayout({
      ...origin.layout,
      seats: origin.layout.seats.map((seat) => seatIds.has(seat.id) ? {
        ...seat,
        x: clamp(seat.x + deltaX, 84, 876),
        y: clamp(seat.y + deltaY, 178, 386),
      } : seat),
      furniture: origin.layout.furniture.map((item) => furnitureIds.has(item.id) ? {
        ...item,
        x: clamp(item.x + deltaX, 52, 908),
        y: clamp(item.y + deltaY, 52, 444),
      } : item),
      updatedAt: Date.now(),
    });
  };

  const deleteSelectedFurniture = () => {
    if (selectedFurnitureIds.length === 0) {
      return;
    }
    pushLayoutHistory(draftLayout);
    const selectedIds = new Set(selectedFurnitureIds);
    setDraftLayout((layout) => ({
      ...layout,
      furniture: layout.furniture.filter((item) => !selectedIds.has(item.id)),
      updatedAt: Date.now(),
    }));
    setSelectedFurnitureIds([]);
  };

  const pushLayoutHistory = (layout: OfficeLayout) => {
    setLayoutHistory((history) => ({
      past: [...history.past.slice(-(HISTORY_LIMIT - 1)), cloneLayout(layout)],
      future: [],
    }));
  };

  const undoLayout = () => {
    setLayoutHistory((history) => {
      const previous = history.past[history.past.length - 1];
      if (!previous) {
        return history;
      }
      setDraftLayout(cloneLayout(previous));
      setSelectedSeatIds([]);
      setSelectedFurnitureIds([]);
      return {
        past: history.past.slice(0, -1),
        future: [cloneLayout(draftLayout), ...history.future].slice(0, HISTORY_LIMIT),
      };
    });
  };

  const redoLayout = () => {
    setLayoutHistory((history) => {
      const next = history.future[0];
      if (!next) {
        return history;
      }
      setDraftLayout(cloneLayout(next));
      setSelectedSeatIds([]);
      setSelectedFurnitureIds([]);
      return {
        past: [...history.past, cloneLayout(draftLayout)].slice(-HISTORY_LIMIT),
        future: history.future.slice(1),
      };
    });
  };

  const saveLayout = () => {
    vscode.postMessage({ type: 'saveOfficeLayout', layout: { ...draftLayout, updatedAt: Date.now() } });
    setEditMode(false);
  };

  const savePreset = () => {
    const name = presetName.trim() || draftLayout.name;
    vscode.postMessage({
      type: 'saveOfficePreset',
      name,
      layout: { ...draftLayout, name, updatedAt: Date.now() },
    });
    setPresetName('');
  };

  const resetLayout = () => {
    vscode.postMessage({ type: 'resetOfficeLayout' });
    setEditMode(false);
  };

  useEffect(() => {
    if (!editMode) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedFurnitureIds.length > 0) {
        event.preventDefault();
        deleteSelectedFurniture();
      }
      if (event.key === 'Escape') {
        setPlacementKind('');
        setSelectedSeatIds([]);
        setSelectedFurnitureIds([]);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redoLayout();
        } else {
          undoLayout();
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redoLayout();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveLayout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftLayout, editMode, layoutHistory, selectedFurnitureIds]);

  return (
    <div className="officeCanvasShell">
      <div className="layoutToolbar">
        <span className="layoutName">{activeLayout.name}</span>
        <div className="layoutActions">
          <select
            className="layoutPresetSelect"
            value={selectedPresetId}
            title="Apply layout preset"
            onChange={(event) => {
              const presetId = event.target.value;
              setSelectedPresetId(presetId);
              if (presetId) {
                vscode.postMessage({ type: 'applyOfficePreset', presetId });
                setEditMode(false);
              }
            }}
          >
            <option value="">Preset</option>
            {state.officePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.custom ? `Custom: ${preset.name}` : preset.name}</option>
            ))}
          </select>
          <input
            className="layoutPresetNameInput"
            value={presetName}
            title="Custom preset name"
            placeholder="preset name"
            disabled={!editMode}
            onChange={(event) => setPresetName(event.target.value)}
          />
          <button className="iconButton" title="Save current layout as custom preset" disabled={!editMode} onClick={savePreset}>
            <Save size={16} />
          </button>
          <button
            className="iconButton"
            title="Delete selected custom preset"
            disabled={!selectedPreset?.custom}
            onClick={() => {
              if (selectedPreset?.custom) {
                vscode.postMessage({ type: 'deleteOfficePreset', presetId: selectedPreset.id });
                setSelectedPresetId('');
              }
            }}
          >
            <Trash2 size={16} />
          </button>
          <select
            className="layoutFurnitureSelect"
            value={placementKind}
            title="Place furniture"
            disabled={!editMode}
            onChange={(event) => setPlacementKind(event.target.value as FurnitureKind | '')}
          >
            <option value="">Furniture</option>
            {state.furnitureCatalog.map((item) => (
              <option key={item.kind} value={item.kind}>{item.label}</option>
            ))}
          </select>
          <button
            className={`iconButton ${editMode && !placementKind ? 'active' : ''}`}
            title="Select and move"
            disabled={!editMode}
            onClick={() => setPlacementKind('')}
          >
            <MousePointer2 size={16} />
          </button>
          <button className="iconButton" title="Undo layout edit" disabled={!editMode || layoutHistory.past.length === 0} onClick={undoLayout}>
            <Undo2 size={16} />
          </button>
          <button className="iconButton" title="Redo layout edit" disabled={!editMode || layoutHistory.future.length === 0} onClick={redoLayout}>
            <Redo2 size={16} />
          </button>
          <button
            className={`iconButton ${editMode ? 'active' : ''}`}
            title="Edit layout"
            onClick={() => setEditMode((current) => !current)}
          >
            <Edit3 size={16} />
          </button>
          <button className="iconButton" title="Save layout" disabled={!editMode} onClick={saveLayout}>
            <Save size={16} />
          </button>
          <button className="iconButton" title="Reset layout" onClick={resetLayout}>
            <RotateCcw size={16} />
          </button>
          <button className="iconButton" title="Delete selected furniture" disabled={!editMode || selectedFurnitureIds.length === 0} onClick={deleteSelectedFurniture}>
            <Trash2 size={16} />
          </button>
          <button className="iconButton" title="Import layout" onClick={() => vscode.postMessage({ type: 'importOfficeLayout' })}>
            <Upload size={16} />
          </button>
          <button className="iconButton" title="Export layout" onClick={() => vscode.postMessage({ type: 'exportOfficeLayout' })}>
            <Download size={16} />
          </button>
        </div>
      </div>
      <div className={`canvasFrame ${editMode ? 'editing' : ''}`}>
        <canvas
          ref={canvasRef}
          aria-label="Warnyin pixel agent office"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      {selectedAgent ? (
        <div className="agentInspector">
          <div>
            <strong>{selectedAgent.name}</strong>
            <span>{selectedAgent.role}</span>
          </div>
          <p>{selectedAgent.activity}</p>
          <dl>
            {selectedAgent.toolName ? (
              <>
                <dt>Tool</dt>
                <dd>{selectedAgent.toolName}</dd>
              </>
            ) : null}
            {selectedAgent.stage ? (
              <>
                <dt>Stage</dt>
                <dd>{selectedAgent.stage}</dd>
              </>
            ) : null}
            {selectedAgent.source ? (
              <>
                <dt>Source</dt>
                <dd>{selectedAgent.source}</dd>
              </>
            ) : null}
            {typeof selectedAgent.elapsedMs === 'number' ? (
              <>
                <dt>Elapsed</dt>
                <dd>{formatElapsed(selectedAgent.elapsedMs)}</dd>
              </>
            ) : null}
            {selectedAgent.tokenUsage ? (
              <>
                <dt>Tokens</dt>
                <dd>{formatTokenUsage(selectedAgent.tokenUsage)}</dd>
              </>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function drawOffice(
  ctx: CanvasRenderingContext2D,
  placements: Array<{ agent: AgentSnapshot; seat: OfficeSeat }>,
  state: WarnyinState,
  layout: OfficeLayout,
  palette: Map<string, RolePaletteEntry>,
  editMode: boolean,
  selectedAgentId: string | null,
  selectedSeatIds: string[],
  selectedFurnitureIds: string[],
  frame: number,
) {
  ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  drawRoom(ctx, state);
  drawStageBoard(ctx, state);
  drawWorkflowActivity(ctx, state, frame);
  drawFurnitureLayer(ctx, layout.furniture, selectedFurnitureIds, editMode);
  if (editMode) {
    drawSeatGrid(ctx, layout.seats, selectedSeatIds);
  }

  placements.forEach(({ agent, seat }, index) => {
    const position = seat;
    if (!position) {
      return;
    }
    if (selectedAgentId === agent.id) {
      drawSelectionRing(ctx, position.x, position.y);
    }
    drawDesk(ctx, position.x, position.y + 36, agent.kind === 'main');
    drawAgent(ctx, agent, position, palette, frame + index * 7);
  });
}

function drawFurnitureLayer(
  ctx: CanvasRenderingContext2D,
  furniture: FurnitureItem[],
  selectedFurnitureIds: string[],
  editMode: boolean,
) {
  const selected = new Set(selectedFurnitureIds);
  for (const item of furniture) {
    if (editMode && selected.has(item.id)) {
      ctx.strokeStyle = '#c28a2c';
      ctx.lineWidth = 4;
      ctx.strokeRect(item.x - 32, item.y - 30, 64, 60);
    }
    drawFurniture(ctx, item);
  }
}

function drawFurniture(ctx: CanvasRenderingContext2D, item: FurnitureItem) {
  const sprite = FURNITURE_ASSET_MANIFEST[item.kind];
  if (sprite) {
    drawPixelSprite(ctx, sprite, item.x, item.y, 5, {
      outline: '#4b2414',
      primary: '#8a5a34',
      secondary: '#3e4f7d',
      accent: '#c28a2c',
      light: '#fff8eb',
      dark: '#6c351d',
      green: '#2d6f62',
      red: '#b65b4c',
    });
    return;
  }
  switch (item.kind) {
    case 'review-table':
      drawReviewTable(ctx, item.x, item.y);
      break;
    case 'build-bench':
      drawBuildBench(ctx, item.x, item.y);
      break;
    case 'qa-station':
      drawQaStation(ctx, item.x, item.y);
      break;
    case 'release-board':
      drawReleaseBoard(ctx, item.x, item.y);
      break;
    case 'docs-shelf':
      drawDocsShelf(ctx, item.x, item.y);
      break;
    case 'plant':
      drawPlant(ctx, item.x, item.y);
      break;
    case 'logo-wall':
      drawLogoWall(ctx, item.x, item.y);
      break;
  }
}

function drawSelectionRing(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = '#c28a2c';
  ctx.lineWidth = 4;
  ctx.strokeRect(x - 52, y - 38, 104, 124);
}

function drawSeatGrid(ctx: CanvasRenderingContext2D, seats: OfficeSeat[], selectedSeatIds: string[]) {
  const selected = new Set(selectedSeatIds);
  for (const seat of seats) {
    ctx.strokeStyle = selected.has(seat.id) ? '#c28a2c' : seat.id === 'main' ? '#3e4f7d' : 'rgba(62, 79, 125, 0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(seat.x - 48, seat.y - 34, 96, 112);
    ctx.fillStyle = 'rgba(255, 248, 235, 0.82)';
    ctx.fillRect(seat.x - 42, seat.y - 50, 84, 18);
    ctx.fillStyle = '#4b2414';
    ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    fitText(ctx, seat.id, seat.x - 36, seat.y - 37, 72);
  }
}

function drawRoom(ctx: CanvasRenderingContext2D, state: WarnyinState) {
  ctx.fillStyle = '#f4ead9';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  ctx.fillStyle = '#ead6b8';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, 118);
  ctx.fillStyle = '#d7bd94';
  ctx.fillRect(0, 116, LOGICAL_WIDTH, 4);

  for (let y = 120; y < LOGICAL_HEIGHT; y += 28) {
    for (let x = 0; x < LOGICAL_WIDTH; x += 28) {
      ctx.fillStyle = (x / 28 + y / 28) % 2 === 0 ? '#f0dfc4' : '#ead7b8';
      ctx.fillRect(x, y, 27, 27);
    }
  }

  ctx.fillStyle = '#caa77a';
  ctx.fillRect(52, 145, 880, 6);
  ctx.fillRect(52, 454, 880, 6);
  ctx.fillRect(52, 145, 6, 315);
  ctx.fillRect(926, 145, 6, 315);

  ctx.fillStyle = '#5a2b18';
  ctx.font = 'bold 22px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('warnyin', 72, 70);
  ctx.fillStyle = '#2d6f62';
  ctx.font = '14px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(state.installed ? 'workflow online' : 'workflow locked', 74, 94);
}

function drawStageBoard(ctx: CanvasRenderingContext2D, state: WarnyinState) {
  ctx.fillStyle = '#fff8eb';
  ctx.fillRect(602, 26, 288, 72);
  ctx.strokeStyle = '#6c351d';
  ctx.lineWidth = 4;
  ctx.strokeRect(602, 26, 288, 72);

  const title = state.activeTopic?.slug ?? state.transcript.latestCommand ?? 'standby';
  ctx.fillStyle = '#4b2414';
  ctx.font = 'bold 16px ui-monospace, SFMono-Regular, Menlo, monospace';
  fitText(ctx, title, 620, 54, 248);
  ctx.fillStyle = '#3e4f7d';
  ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace';
  fitText(ctx, state.transcript.latestCommand ?? 'no command yet', 620, 78, 248);
}

function drawWorkflowActivity(ctx: CanvasRenderingContext2D, state: WarnyinState, frame: number) {
  const stage = state.transcript.currentStage ?? state.activeTopic?.activeStage;
  const workflow = state.activeTopic?.workflow;
  if (!stage || stage === 'init' || stage === 'codemap' || stage === 'skill' || stage === 'explore' || stage === 'next') {
    return;
  }

  if (stage === 'design') {
    drawActivityBadge(ctx, 612, 132, 'review panel', '#3e4f7d');
    ['SA', 'TL', 'QA', 'SEC', 'INFRA'].forEach((label, index) => {
      drawMiniDeskLabel(ctx, 602 + index * 56, 158, label, '#3e4f7d');
    });
    return;
  }

  if (stage === 'build') {
    const waveCount = Math.max(1, Math.min(workflow?.waveCount ?? 1, 4));
    for (let index = 0; index < waveCount; index++) {
      const x = 330 + index * 142;
      drawActivityBadge(ctx, x, 132, `wave ${index + 1}`, index % 2 === 0 ? '#2d6f62' : '#3e4f7d');
      drawWavePulse(ctx, x + 42, 158, frame + index * 9);
    }
    return;
  }

  if (stage === 'verify') {
    drawActivityBadge(ctx, 612, 132, workflow?.verifyPassed ? 'verify pass' : 'tester loop', workflow?.verifyPassed ? '#2d6f62' : '#b65b4c');
    drawLoopArrow(ctx, 750, 160, frame, workflow?.verifyPassed ?? false);
    return;
  }

  if (stage === 'ship') {
    drawActivityBadge(ctx, 612, 132, workflow?.shipReady ? 'archive ready' : 'promote docs', '#c28a2c');
    drawArchiveCrate(ctx, 804, 158);
  }
}

function drawActivityBadge(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string) {
  ctx.fillStyle = '#fff8eb';
  ctx.fillRect(x, y, 120, 28);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, 120, 28);
  ctx.fillStyle = color;
  ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  fitText(ctx, label, x + 8, y + 18, 104);
}

function drawMiniDeskLabel(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 46, 18);
  ctx.fillStyle = '#fff8eb';
  ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  fitText(ctx, label, x + 5, y + 12, 36);
}

function drawWavePulse(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const size = 8 + Math.round((Math.sin(frame / 8) + 1) * 4);
  ctx.strokeStyle = 'rgba(45, 111, 98, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x - size, y - size, size * 2, size * 2);
}

function drawLoopArrow(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, passed: boolean) {
  ctx.strokeStyle = passed ? '#2d6f62' : '#b65b4c';
  ctx.lineWidth = 4;
  ctx.strokeRect(x - 34, y - 18, 68, 36);
  const marker = Math.round((Math.sin(frame / 10) + 1) * 24);
  ctx.fillStyle = passed ? '#2d6f62' : '#b65b4c';
  ctx.fillRect(x - 30 + marker, y - 22, 8, 8);
}

function drawArchiveCrate(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(x - 34, y - 20, 68, 40);
  ctx.strokeStyle = '#4b2414';
  ctx.lineWidth = 4;
  ctx.strokeRect(x - 34, y - 20, 68, 40);
  ctx.fillStyle = '#c28a2c';
  ctx.fillRect(x - 28, y - 14, 56, 8);
  ctx.fillStyle = '#fff8eb';
  ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  fitText(ctx, 'SHIP', x - 15, y + 8, 32);
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, main: boolean) {
  ctx.fillStyle = main ? '#6c351d' : '#8a5a34';
  ctx.fillRect(x - 42, y, 84, 18);
  ctx.fillStyle = '#4b2414';
  ctx.fillRect(x - 36, y + 18, 12, 18);
  ctx.fillRect(x + 24, y + 18, 12, 18);
  ctx.fillStyle = '#fff8eb';
  ctx.fillRect(x - 18, y - 10, 36, 14);
  ctx.fillStyle = '#3e4f7d';
  ctx.fillRect(x - 14, y - 7, 28, 8);
}

function drawReviewTable(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(x - 44, y - 18, 88, 36);
  ctx.fillStyle = '#6c351d';
  ctx.fillRect(x - 38, y - 12, 76, 24);
  ctx.fillStyle = '#fff8eb';
  ctx.fillRect(x - 18, y - 7, 36, 14);
}

function drawBuildBench(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#6c351d';
  ctx.fillRect(x - 46, y - 16, 92, 20);
  ctx.fillStyle = '#3e4f7d';
  ctx.fillRect(x - 38, y - 28, 24, 14);
  ctx.fillRect(x + 14, y - 28, 24, 14);
  ctx.fillStyle = '#2d6f62';
  ctx.fillRect(x - 30, y - 24, 8, 6);
  ctx.fillRect(x + 22, y - 24, 8, 6);
  ctx.fillStyle = '#4b2414';
  ctx.fillRect(x - 38, y + 4, 10, 18);
  ctx.fillRect(x + 28, y + 4, 10, 18);
}

function drawQaStation(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#8a9a62';
  ctx.fillRect(x - 36, y - 30, 72, 48);
  ctx.fillStyle = '#fff8eb';
  ctx.fillRect(x - 28, y - 22, 56, 28);
  ctx.fillStyle = '#3e4f7d';
  ctx.fillRect(x - 22, y - 16, 14, 6);
  ctx.fillRect(x + 8, y - 16, 14, 6);
  ctx.fillStyle = '#2d6f62';
  ctx.fillRect(x - 22, y - 2, 44, 5);
}

function drawReleaseBoard(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#4b2414';
  ctx.fillRect(x - 36, y - 34, 72, 54);
  ctx.fillStyle = '#fff8eb';
  ctx.fillRect(x - 30, y - 28, 60, 42);
  ctx.fillStyle = '#c28a2c';
  ctx.fillRect(x - 24, y - 20, 16, 10);
  ctx.fillStyle = '#2d6f62';
  ctx.fillRect(x + 4, y - 20, 20, 10);
  ctx.fillStyle = '#b65b4c';
  ctx.fillRect(x - 24, y - 2, 44, 6);
}

function drawDocsShelf(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#6c351d';
  ctx.fillRect(x - 32, y - 36, 64, 72);
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(x - 26, y - 30, 52, 60);
  ctx.fillStyle = '#fff8eb';
  for (let row = 0; row < 3; row++) {
    ctx.fillRect(x - 22, y - 24 + row * 18, 44, 4);
  }
  ctx.fillStyle = '#3e4f7d';
  ctx.fillRect(x - 20, y - 18, 8, 12);
  ctx.fillStyle = '#2d6f62';
  ctx.fillRect(x - 8, y - 18, 8, 12);
  ctx.fillStyle = '#c28a2c';
  ctx.fillRect(x + 4, y - 18, 8, 12);
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#6c351d';
  ctx.fillRect(x - 14, y + 4, 28, 22);
  ctx.fillStyle = '#2d6f62';
  ctx.fillRect(x - 8, y - 20, 16, 24);
  ctx.fillRect(x - 22, y - 8, 18, 14);
  ctx.fillRect(x + 4, y - 10, 22, 16);
  ctx.fillStyle = '#8a9a62';
  ctx.fillRect(x - 4, y - 30, 12, 16);
}

function drawLogoWall(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = '#6c351d';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, 28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  for (let index = -2; index <= 2; index++) {
    ctx.beginPath();
    ctx.arc(x, y, 9 + index * 5, Math.PI * 0.18, Math.PI * 1.18);
    ctx.stroke();
  }
}

function drawAgent(
  ctx: CanvasRenderingContext2D,
  agent: AgentSnapshot,
  seat: OfficeSeat,
  palette: Map<string, RolePaletteEntry>,
  frame: number,
) {
  const x = seat.x;
  const y = seat.y;
  const bob = agent.status === 'running' || agent.status === 'thinking' ? Math.round(Math.sin(frame / 8) * 2) : 0;
  const rolePalette = palette.get(agent.role) ?? palette.get(seat.role ?? '') ?? palette.get('Developer');
  const accent = agent.status === 'offline'
    ? statusColors.offline
    : agent.status === 'blocked'
      ? statusColors.blocked
      : rolePalette?.accent ?? statusColors[agent.status] ?? '#2d6f62';
  const skin = rolePalette?.skin ?? (agent.kind === 'main' ? '#e0b083' : '#d09b73');
  const hair = rolePalette?.hair ?? '#4b2414';
  const shirt = rolePalette?.shirt ?? (agent.kind === 'main' ? '#3e4f7d' : agent.kind === 'role' ? '#8a9a62' : '#2d6f62');
  const outline = '#4b2414';
  const yy = y + bob;

  ctx.fillStyle = 'rgba(75, 36, 20, 0.18)';
  ctx.fillRect(x - 22, y + 46, 44, 8);

  ctx.fillStyle = accent;
  ctx.fillRect(x - 24, yy - 28, 48, 6);
  ctx.fillRect(x - 30, yy - 22, 6, 42);
  ctx.fillRect(x + 24, yy - 22, 6, 42);
  ctx.fillRect(x - 24, yy + 20, 48, 6);

  ctx.fillStyle = outline;
  ctx.fillRect(x - 17, yy - 18, 34, 34);
  ctx.fillStyle = skin;
  ctx.fillRect(x - 13, yy - 14, 26, 26);
  ctx.fillStyle = hair;
  drawHair(ctx, x, yy, rolePalette?.hairStyle ?? 'short');
  ctx.fillStyle = outline;
  ctx.fillRect(x - 7, yy - 1, 4, 4);
  ctx.fillRect(x + 5, yy - 1, 4, 4);

  ctx.fillStyle = outline;
  ctx.fillRect(x - 20, yy + 14, 40, 34);
  ctx.fillStyle = shirt;
  ctx.fillRect(x - 15, yy + 18, 30, 26);
  if (rolePalette?.body === 'jacket') {
    ctx.fillStyle = outline;
    ctx.fillRect(x - 15, yy + 18, 7, 26);
    ctx.fillRect(x + 8, yy + 18, 7, 26);
    ctx.fillStyle = '#fff8eb';
    ctx.fillRect(x - 4, yy + 18, 8, 24);
  }
  if (rolePalette?.body === 'apron') {
    ctx.fillStyle = '#fff8eb';
    ctx.fillRect(x - 8, yy + 18, 16, 28);
    ctx.fillStyle = rolePalette.accent;
    ctx.fillRect(x - 10, yy + 18, 20, 4);
  }
  ctx.fillStyle = agent.kind === 'main' ? '#c28a2c' : '#fff8eb';
  ctx.fillRect(x - 7, yy + 23, 14, 4);
  drawAccessory(ctx, x, yy, rolePalette?.accessory ?? (agent.kind === 'main' ? 'badge' : 'none'), rolePalette?.accent ?? '#c28a2c');

  if (agent.status === 'blocked') {
    ctx.fillStyle = '#b65b4c';
    ctx.fillRect(x + 22, yy - 30, 20, 20);
    ctx.fillStyle = '#fff8eb';
    ctx.fillRect(x + 30, yy - 26, 4, 11);
    ctx.fillRect(x + 30, yy - 11, 4, 4);
  }

  ctx.fillStyle = '#4b2414';
  ctx.font = 'bold 12px ui-monospace, SFMono-Regular, Menlo, monospace';
  fitText(ctx, agent.name, x - 46, y + 72, 92);
  ctx.fillStyle = '#6c351d';
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  fitText(ctx, agent.activity, x - 58, y + 90, 116);

  drawSpeechBubble(ctx, agent, x, yy - 44);
}

function drawHair(ctx: CanvasRenderingContext2D, x: number, y: number, style: 'short' | 'side' | 'cap') {
  if (style === 'cap') {
    ctx.fillRect(x - 17, y - 18, 34, 7);
    ctx.fillRect(x - 11, y - 24, 22, 6);
    ctx.fillRect(x + 8, y - 20, 16, 4);
    return;
  }
  if (style === 'side') {
    ctx.fillRect(x - 13, y - 14, 26, 7);
    ctx.fillRect(x - 17, y - 10, 8, 22);
    ctx.fillRect(x + 9, y - 10, 7, 12);
    return;
  }
  ctx.fillRect(x - 13, y - 14, 26, 7);
  ctx.fillRect(x - 11, y - 18, 22, 5);
}

function drawAccessory(ctx: CanvasRenderingContext2D, x: number, y: number, accessory: 'none' | 'badge' | 'headset', accent: string) {
  if (accessory === 'badge') {
    ctx.fillStyle = accent;
    ctx.fillRect(x + 7, y + 24, 7, 7);
    ctx.fillStyle = '#fff8eb';
    ctx.fillRect(x + 9, y + 26, 3, 3);
    return;
  }
  if (accessory === 'headset') {
    ctx.fillStyle = '#4b2414';
    ctx.fillRect(x - 20, y - 8, 5, 12);
    ctx.fillRect(x + 15, y - 8, 5, 12);
    ctx.fillRect(x + 14, y + 3, 10, 4);
  }
}

function placeAgents(agents: AgentSnapshot[], layout: OfficeLayout): Array<{ agent: AgentSnapshot; seat: OfficeSeat }> {
  const mainSeat = layout.seats.find((seat) => seat.id === 'main') ?? layout.seats[0];
  const otherSeats = layout.seats.filter((seat) => seat.id !== 'main');
  return agents.map((agent, index) => ({
    agent,
    seat: agent.kind === 'main' ? mainSeat : otherSeats[Math.max(0, index - 1)] ?? otherSeats[0] ?? mainSeat,
  }));
}

function pointerToLogicalPoint(event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * LOGICAL_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * LOGICAL_HEIGHT,
  };
}

function findSeatAt(seats: OfficeSeat[], x: number, y: number): OfficeSeat | undefined {
  return [...seats]
    .sort((a, b) => distanceSquared(a, x, y) - distanceSquared(b, x, y))
    .find((seat) => Math.abs(seat.x - x) <= 52 && Math.abs(seat.y + 18 - y) <= 76);
}

function findAgentAt(
  placements: Array<{ agent: AgentSnapshot; seat: OfficeSeat }>,
  x: number,
  y: number,
): { agent: AgentSnapshot; seat: OfficeSeat } | undefined {
  return [...placements]
    .sort((a, b) => distanceSquared(a.seat, x, y) - distanceSquared(b.seat, x, y))
    .find(({ seat }) => Math.abs(seat.x - x) <= 44 && Math.abs(seat.y + 20 - y) <= 76);
}

function findFurnitureAt(furniture: FurnitureItem[], x: number, y: number): FurnitureItem | undefined {
  return [...furniture]
    .sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - ((b.x - x) ** 2 + (b.y - y) ** 2))
    .find((item) => Math.abs(item.x - x) <= 48 && Math.abs(item.y - y) <= 48);
}

function distanceSquared(seat: OfficeSeat, x: number, y: number): number {
  return (seat.x - x) ** 2 + (seat.y - y) ** 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function cloneLayout(layout: OfficeLayout): OfficeLayout {
  return {
    ...layout,
    seats: layout.seats.map((seat) => ({ ...seat })),
    furniture: layout.furniture.map((item) => ({ ...item })),
  };
}

function toggleSelection(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  let value = text;
  while (value.length > 3 && ctx.measureText(`${value}...`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  ctx.fillText(`${value}...`, x, y);
}

function drawSpeechBubble(ctx: CanvasRenderingContext2D, agent: AgentSnapshot, x: number, y: number) {
  if (agent.status !== 'blocked' && agent.status !== 'failed' && agent.status !== 'running' && agent.status !== 'thinking') {
    return;
  }
  const text = agent.status === 'blocked'
    ? '!'
    : agent.status === 'failed'
      ? 'fail'
      : agent.toolName
        ? agent.toolName
        : agent.status === 'thinking'
          ? '...'
          : 'run';
  const width = text.length <= 1 ? 24 : 58;
  ctx.fillStyle = agent.status === 'blocked' || agent.status === 'failed' ? '#b65b4c' : '#fff8eb';
  ctx.fillRect(x - width / 2, y - 18, width, 20);
  ctx.strokeStyle = '#4b2414';
  ctx.lineWidth = 3;
  ctx.strokeRect(x - width / 2, y - 18, width, 20);
  ctx.fillStyle = agent.status === 'blocked' || agent.status === 'failed' ? '#fff8eb' : '#4b2414';
  ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  fitText(ctx, text, x - width / 2 + 5, y - 4, width - 10);
}

function formatElapsed(ms: number): string {
  if (ms < 1_000) {
    return '<1s';
  }
  if (ms < 60_000) {
    return `${Math.round(ms / 1_000)}s`;
  }
  return `${Math.round(ms / 60_000)}m`;
}

function formatTokenUsage(usage: { input: number; output: number }) {
  return `${compactNumber(usage.input + usage.output)}`;
}

function compactNumber(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return `${value}`;
}
