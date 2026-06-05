import {
  CheckCircle2,
  Code2,
  Compass,
  Download,
  Hammer,
  History,
  ListChecks,
  Lock,
  Palette,
  PackageCheck,
  PenTool,
  Play,
  Radio,
  RefreshCcw,
  Route,
  Search,
  Send,
  ShieldCheck,
  Terminal,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import PixelOffice from './PixelOffice';
import type {
  CharacterAccessory,
  CharacterBody,
  CharacterHairStyle,
  ExtensionMessage,
  StageId,
  WarnyinState,
} from './types';
import { logoUri, vscode } from './vscode';

const defaultStageFlow = [
  { id: 'discovery' as const, label: 'Discovery', status: 'active' as const, fileCount: 0 },
  { id: 'design' as const, label: 'Design', status: 'pending' as const, fileCount: 0 },
  { id: 'build' as const, label: 'Build', status: 'pending' as const, fileCount: 0 },
  { id: 'verify' as const, label: 'Verify', status: 'pending' as const, fileCount: 0 },
  { id: 'ship' as const, label: 'Ship', status: 'pending' as const, fileCount: 0 },
];

const defaultOfficeLayout = {
  version: 1 as const,
  name: 'Warnyin Paper Office',
  seats: [
    { id: 'main', x: 202, y: 244, role: 'Main Controller' },
    { id: 'slot-1', x: 420, y: 206, role: 'BA / PO' },
    { id: 'slot-2', x: 570, y: 206, role: 'SA' },
    { id: 'slot-3', x: 720, y: 206, role: 'Tech Lead' },
    { id: 'slot-4', x: 840, y: 206, role: 'QA' },
    { id: 'slot-5', x: 420, y: 354, role: 'Developer' },
    { id: 'slot-6', x: 570, y: 354, role: 'Developer' },
    { id: 'slot-7', x: 720, y: 354, role: 'Security' },
    { id: 'slot-8', x: 840, y: 354, role: 'Infra' },
    { id: 'slot-9', x: 280, y: 354, role: 'Developer' },
    { id: 'slot-10', x: 280, y: 206, role: 'Reviewer' },
    { id: 'slot-11', x: 112, y: 354, role: 'Standby' },
    { id: 'slot-12', x: 112, y: 206, role: 'Standby' },
  ],
  furniture: [
    { id: 'f-logo-wall', kind: 'logo-wall' as const, x: 164, y: 70 },
    { id: 'f-docs-shelf', kind: 'docs-shelf' as const, x: 84, y: 190 },
    { id: 'f-review-table', kind: 'review-table' as const, x: 618, y: 278 },
    { id: 'f-release-board', kind: 'release-board' as const, x: 790, y: 70 },
    { id: 'f-plant', kind: 'plant' as const, x: 890, y: 424 },
  ],
  updatedAt: 0,
};

const defaultRolePalette = {
  version: 1 as const,
  entries: [
    { role: 'Main Controller', shirt: '#3e4f7d', accent: '#c28a2c', skin: '#e0b083', hair: '#4b2414', body: 'jacket' as const, hairStyle: 'side' as const, accessory: 'badge' as const },
    { role: 'Business Analyst', shirt: '#8a9a62', accent: '#c28a2c', skin: '#d8a47d', hair: '#5a2b18', body: 'classic' as const, hairStyle: 'side' as const, accessory: 'none' as const },
    { role: 'Product Owner', shirt: '#a96835', accent: '#8a9a62', skin: '#f0bf8d', hair: '#6c351d', body: 'classic' as const, hairStyle: 'short' as const, accessory: 'badge' as const },
    { role: 'Solution Architect', shirt: '#3e4f7d', accent: '#2d6f62', skin: '#c98f68', hair: '#3c2116', body: 'jacket' as const, hairStyle: 'short' as const, accessory: 'none' as const },
    { role: 'Tech Lead', shirt: '#6c351d', accent: '#3e4f7d', skin: '#d09b73', hair: '#4b2414', body: 'jacket' as const, hairStyle: 'cap' as const, accessory: 'headset' as const },
    { role: 'Developer', shirt: '#2d6f62', accent: '#8a9a62', skin: '#d09b73', hair: '#5a2b18', body: 'classic' as const, hairStyle: 'short' as const, accessory: 'headset' as const },
    { role: 'QA', shirt: '#8a9a62', accent: '#3e4f7d', skin: '#e5b489', hair: '#4b2414', body: 'apron' as const, hairStyle: 'side' as const, accessory: 'badge' as const },
    { role: 'Security', shirt: '#b65b4c', accent: '#6c351d', skin: '#c88d68', hair: '#3c2116', body: 'jacket' as const, hairStyle: 'cap' as const, accessory: 'badge' as const },
    { role: 'Infra', shirt: '#3e4f7d', accent: '#b65b4c', skin: '#d5a27b', hair: '#4b2414', body: 'apron' as const, hairStyle: 'cap' as const, accessory: 'headset' as const },
  ],
  updatedAt: 0,
};

const initialState: WarnyinState = {
  installState: 'noWorkspace',
  installed: false,
  slugs: [],
  archivedSlugs: [],
  topics: [],
  stageFlow: defaultStageFlow,
  roleBench: [],
  transcript: {
    enabled: true,
    sessionCount: 0,
    tokenUsage: {
      input: 0,
      output: 0,
      cacheCreation: 0,
      cacheRead: 0,
    },
    lastUpdated: Date.now(),
    agents: [
      {
        id: 'main',
        name: 'You',
        role: 'Main Controller',
        kind: 'main',
        status: 'offline',
        activity: 'No Claude session',
        lastSeen: 0,
      },
    ],
  },
  terminal: {
    name: 'Warnyin Agents',
    isOpen: false,
  },
  officeLayout: defaultOfficeLayout,
  officePresets: [
    {
      id: 'paper-office',
      name: 'Paper Office',
      description: 'Balanced default layout for every stage.',
      layout: defaultOfficeLayout,
    },
  ],
  furnitureCatalog: [
    { kind: 'review-table', label: 'Review Table' },
    { kind: 'build-bench', label: 'Build Bench' },
    { kind: 'qa-station', label: 'QA Station' },
    { kind: 'release-board', label: 'Release Board' },
    { kind: 'docs-shelf', label: 'Docs Shelf' },
    { kind: 'plant', label: 'Plant' },
    { kind: 'logo-wall', label: 'Logo Wall' },
  ],
  rolePalette: defaultRolePalette,
  commandHistory: [],
  savedPrompts: [],
  soundCuesEnabled: false,
  logoUri,
  generatedAt: Date.now(),
};

export default function App() {
  const [state, setState] = useState<WarnyinState>(initialState);
  const [toast, setToast] = useState<{ message: string; level: string } | null>(null);
  const previousCueMarkers = useRef<CueMarkers | undefined>(undefined);

  useEffect(() => {
    const listener = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;
      if (message.type === 'state') {
        setState(message.state);
      }
      if (message.type === 'toast') {
        setToast({ message: message.message, level: message.level });
        window.setTimeout(() => setToast(null), 2800);
      }
    };

    window.addEventListener('message', listener);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', listener);
  }, []);

  useEffect(() => {
    const next = cueMarkersForState(state);
    const previous = previousCueMarkers.current;
    previousCueMarkers.current = next;
    if (!state.soundCuesEnabled || !previous) {
      return;
    }
    if (next.latestCommand && next.latestCommand !== previous.latestCommand) {
      playSoundCue('command');
    }
    if (next.attentionKey && next.attentionKey !== previous.attentionKey) {
      playSoundCue('attention');
    }
    if (
      (next.verifyPassedKey && next.verifyPassedKey !== previous.verifyPassedKey) ||
      (next.shipReadyKey && next.shipReadyKey !== previous.shipReadyKey)
    ) {
      playSoundCue('complete');
    }
  }, [state]);

  return (
    <main className="appShell">
      <Header state={state} />
      <section className="workSurface">
        <div className="officePane">
          <StageStrip state={state} />
          <PixelOffice state={state} />
        </div>
        <aside className="controlPane">
          <CommandCenter state={state} />
          {state.installState === 'installed' ? <WorkflowPanel state={state} /> : null}
          {state.installState === 'installed' ? <PalettePanel state={state} /> : null}
          {state.installState === 'installed' ? <HistoryPanel state={state} /> : null}
          <AgentRoster state={state} />
        </aside>
      </section>
      {toast ? <div className={`toast ${toast.level}`}>{toast.message}</div> : null}
    </main>
  );
}

function WorkflowPanel({ state }: { state: WarnyinState }) {
  const topic = state.activeTopic;
  if (!topic) {
    return (
      <section className="panelSection workflowSection">
        <div className="sectionTitle">
          <ListChecks size={16} />
          <h2>Workflow</h2>
        </div>
        <p className="mutedText">No active `warnyin/stages/*` topic yet.</p>
      </section>
    );
  }

  const gateLabel = topic.workflow.gatesTotal > 0
    ? `${topic.workflow.gatesDone}/${topic.workflow.gatesTotal}`
    : '0/0';
  const verifyLabel = topic.workflow.verifyGateTotal > 0
    ? `${topic.workflow.verifyGateDone}/${topic.workflow.verifyGateTotal}`
    : topic.workflow.verifyPassed
      ? 'pass'
      : '-';

  return (
    <section className="panelSection workflowSection">
      <div className="sectionTitle">
        <ListChecks size={16} />
        <h2>Workflow</h2>
      </div>
      <div className="metricGrid">
        <Metric label="Topic" value={topic.slug} />
        <Metric label="Gate" value={gateLabel} />
        <Metric label="Tasks" value={`${topic.workflow.tasksPassed}/${topic.workflow.tasksTotal}`} />
        <Metric label="Pending" value={`${topic.workflow.tasksPending}`} />
        <Metric label="Issues" value={`${topic.workflow.issuesOpen}`} danger={topic.workflow.issuesOpen > 0} />
        <Metric label="Waves" value={`${topic.workflow.waveCount}`} />
        <Metric label="Deps" value={`${topic.workflow.dependencyCount}`} />
        <Metric label="Verify" value={verifyLabel} danger={!topic.workflow.verifyPassed && topic.workflow.verifyGateTotal > 0} />
        <Metric label="Fixes" value={`${topic.workflow.verifyFixCount ?? 0}`} />
      </div>
      {topic.workflow.shipArchiveTarget ? (
        <div className="archiveLine" title={topic.workflow.shipArchiveTarget}>
          Ship archive target: {topic.workflow.shipArchiveTarget}
        </div>
      ) : null}
      {topic.workflow.dependencyEdges.length > 0 ? (
        <div
          className="dependencyLine"
          title={topic.workflow.dependencyEdges.map((edge) => `${edge.task} -> ${edge.dependsOn}`).join(', ')}
        >
          Dependencies: {topic.workflow.dependencyEdges.slice(0, 3).map((edge) => `${edge.task}->${edge.dependsOn}`).join(', ')}
        </div>
      ) : null}
      {state.archivedSlugs.length > 0 ? (
        <div className="archiveLine" title={state.archivedSlugs.join(', ')}>
          Archived: {state.archivedSlugs.slice(0, 3).join(', ')}
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`metricItem ${danger ? 'danger' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Header({ state }: { state: WarnyinState }) {
  const status = state.installState === 'installed'
    ? 'Installed'
    : state.installState === 'notInstalled'
      ? 'Not installed'
      : 'No workspace';

  return (
    <header className="topBar">
      <div className="brandLockup">
        {state.logoUri ? <img src={state.logoUri} alt="" className="logoMark" /> : null}
        <div>
          <h1>Warnyin Agents</h1>
          <p>{state.workspaceName ?? 'Workspace required'}</p>
        </div>
      </div>
      <div className="topActions">
        <span className={`statusPill ${state.installState}`}>{status}</span>
        <button className="iconButton" title="Refresh" onClick={() => vscode.postMessage({ type: 'refresh' })}>
          <RefreshCcw size={17} />
        </button>
        <button
          className={`iconButton ${state.terminal.isOpen ? 'active' : ''}`}
          title="Start or focus Warnyin terminal"
          onClick={() => vscode.postMessage({ type: 'focusTerminal' })}
        >
          <Terminal size={17} />
        </button>
      </div>
    </header>
  );
}

function StageStrip({ state }: { state: WarnyinState }) {
  return (
    <div className="stageStrip">
      {state.stageFlow.map((stage) => (
        <div key={stage.id} className={`stageNode ${stage.status}`}>
          <span>{stage.label}</span>
          <small>{stage.fileCount}</small>
        </div>
      ))}
    </div>
  );
}

function CommandCenter({ state }: { state: WarnyinState }) {
  if (state.installState !== 'installed') {
    return <InstallPanel state={state} />;
  }
  return <InstalledCommands state={state} />;
}

function InstallPanel({ state }: { state: WarnyinState }) {
  const noWorkspace = state.installState === 'noWorkspace';
  return (
    <section className="panelSection lockedSection">
      <div className="sectionTitle">
        <Lock size={16} />
        <h2>{noWorkspace ? 'No Workspace' : 'Not Installed'}</h2>
      </div>
      <p className="mutedText">
        {noWorkspace
          ? 'Open a project folder to activate Warnyin.'
          : 'Warnyin command UI is locked until the workflow exists in this workspace.'}
      </p>
      <div className="buttonRow">
        <button
          className="primaryButton"
          disabled={noWorkspace}
          onClick={() => vscode.postMessage({ type: 'runInstaller', mode: 'install' })}
        >
          <PackageCheck size={16} />
          Install
        </button>
        <button
          className="secondaryButton"
          disabled={noWorkspace}
          onClick={() => vscode.postMessage({ type: 'runInstaller', mode: 'dryRun' })}
        >
          <Search size={16} />
          Dry Run
        </button>
      </div>
    </section>
  );
}

function InstalledCommands({ state }: { state: WarnyinState }) {
  const preferredSlug = state.activeTopic?.slug ?? state.slugs[0] ?? '';
  const roleOptions = ['ba', 'po', 'sa', 'tech-lead', 'developer', 'qa', 'security', 'infra'];
  const nextSlugOptions = Array.from(new Set([...state.slugs, ...state.archivedSlugs]));
  const [topic, setTopic] = useState('');
  const [skillRole, setSkillRole] = useState('');
  const [question, setQuestion] = useState('');
  const [designSlug, setDesignSlug] = useState(preferredSlug);
  const [change, setChange] = useState('');
  const [stageSlug, setStageSlug] = useState(preferredSlug);
  const [nextSlug, setNextSlug] = useState('');

  useEffect(() => {
    if (!designSlug && preferredSlug) {
      setDesignSlug(preferredSlug);
    }
    if (!stageSlug && preferredSlug) {
      setStageSlug(preferredSlug);
    }
  }, [designSlug, preferredSlug, stageSlug]);

  const slugOptions = state.slugs.length > 0 ? state.slugs : [''];
  const topicReady = normalizeText(topic).length > 0;
  const designSlugValid = !designSlug || isValidSlug(designSlug);
  const designReady = designSlugValid && designSlug.trim().length > 0 && normalizeText(change).length > 0;
  const skillPreview = skillRole ? `/warnyin:install-skill ${skillRole}` : '/warnyin:install-skill';
  const explorePreview = question.trim()
    ? `/warnyin:explore ${normalizeText(question)}`
    : '/warnyin:explore';
  const discoveryPreview = topic.trim()
    ? `/warnyin:discovery ${normalizeText(topic)}`
    : '/warnyin:discovery <topic>';
  const designPreview = designSlug.trim() && change.trim()
    ? `/warnyin:design ${designSlug.trim()} ${normalizeText(change)}`
    : '/warnyin:design <slug> <change>';
  const nextPreview = nextSlug ? `/warnyin:next ${nextSlug}` : '/warnyin:next';
  const stagePreview = stageSlug ? `/warnyin:<stage> ${stageSlug}` : '/warnyin:<stage> <slug>';

  return (
    <section className="panelSection commandSection">
      <div className="sectionTitle">
        <Radio size={16} />
        <h2>Commands</h2>
      </div>

      <div className="quickGrid">
        <button className="commandTile" onClick={() => runCommand('init')}>
          <Play size={16} />
          Init
        </button>
        <button className="commandTile" onClick={() => runCommand('installSkill', { role: skillRole })}>
          <Download size={16} />
          Skill
        </button>
        <button className="commandTile" onClick={() => runCommand('updateCodemaps')}>
          <RefreshCcw size={16} />
          Codemap
        </button>
        <button className="commandTile" onClick={() => vscode.postMessage({ type: 'runInstaller', mode: 'update' })}>
          <Wrench size={16} />
          Update
        </button>
      </div>

      <div className="formStack">
        <div className="commandRow">
          <div className="commandMeta">
            <Download size={16} />
            <span>Skill</span>
          </div>
          <select value={skillRole} onChange={(event) => setSkillRole(event.target.value)}>
            <option value="">All roles</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <button className="iconButton run" title="Install role skill" onClick={() => runCommand('installSkill', { role: skillRole })}>
            <Send size={16} />
          </button>
        </div>
        <code className="commandPreview">{skillPreview}</code>

        <div className="commandRow">
          <div className="commandMeta">
            <Compass size={16} />
            <span>Explore</span>
          </div>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="question" />
          <button className="iconButton run" title="Run explore" onClick={() => runCommand('explore', { question })}>
            <Send size={16} />
          </button>
        </div>
        <code className="commandPreview">{explorePreview}</code>

        <div className="commandRow">
          <div className="commandMeta">
            <Search size={16} />
            <span>Discovery</span>
          </div>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="topic" />
          <button className="iconButton run" title="Run discovery" disabled={!topicReady} onClick={() => runCommand('discovery', { topic })}>
            <Send size={16} />
          </button>
        </div>
        <code className="commandPreview">{discoveryPreview}</code>
        {!topicReady ? <span className="commandHint warning">Topic required.</span> : null}

        <div className="commandRow tall">
          <div className="commandMeta">
            <PenTool size={16} />
            <span>Design</span>
          </div>
          <input value={designSlug} onChange={(event) => setDesignSlug(event.target.value)} placeholder="slug" />
          <textarea value={change} onChange={(event) => setChange(event.target.value)} placeholder="change" rows={2} />
          <button
            className="iconButton run"
            title="Run design"
            disabled={!designReady}
            onClick={() => runCommand('design', { slug: designSlug, change })}
          >
            <Send size={16} />
          </button>
        </div>
        <code className="commandPreview">{designPreview}</code>
        {!designSlugValid ? <span className="commandHint error">Slug must use letters, numbers, and hyphens.</span> : null}
        {designSlugValid && !designReady ? <span className="commandHint warning">Slug and change required.</span> : null}

        <div className="commandRow">
          <div className="commandMeta">
            <Route size={16} />
            <span>Next</span>
          </div>
          <select value={nextSlug} onChange={(event) => setNextSlug(event.target.value)}>
            <option value="">All topics</option>
            {nextSlugOptions.map((slug) => (
              <option key={slug} value={slug}>{slug}</option>
            ))}
          </select>
          <button className="iconButton run" title="Run next" onClick={() => runCommand('next', { slug: nextSlug })}>
            <Send size={16} />
          </button>
        </div>
        <code className="commandPreview">{nextPreview}</code>

        <StageCommand id="build" label="Build" icon={<Hammer size={16} />} slug={stageSlug} setSlug={setStageSlug} slugs={slugOptions} />
        <StageCommand id="verify" label="Verify" icon={<ShieldCheck size={16} />} slug={stageSlug} setSlug={setStageSlug} slugs={slugOptions} />
        <StageCommand id="ship" label="Ship" icon={<CheckCircle2 size={16} />} slug={stageSlug} setSlug={setStageSlug} slugs={slugOptions} />
        <code className="commandPreview">{stagePreview}</code>
      </div>
    </section>
  );
}

function PalettePanel({ state }: { state: WarnyinState }) {
  const [entries, setEntries] = useState(state.rolePalette.entries);

  useEffect(() => {
    setEntries(state.rolePalette.entries);
  }, [state.rolePalette.entries]);

  const updateEntry = (
    role: string,
    key: 'shirt' | 'accent' | 'skin' | 'hair' | 'body' | 'hairStyle' | 'accessory',
    value: string,
  ) => {
    setEntries((current) => current.map((entry) => entry.role === role ? { ...entry, [key]: value } : entry));
  };

  return (
    <section className="panelSection paletteSection">
      <div className="sectionTitle">
        <Palette size={16} />
        <h2>Role Palette</h2>
      </div>
      <div className="paletteGrid">
        {entries.map((entry) => (
          <div key={entry.role} className="paletteRow">
            <span>{entry.role}</span>
            <label title={`${entry.role} shirt`}>
              <input type="color" value={entry.shirt} onChange={(event) => updateEntry(entry.role, 'shirt', event.target.value)} />
            </label>
            <label title={`${entry.role} accent`}>
              <input type="color" value={entry.accent} onChange={(event) => updateEntry(entry.role, 'accent', event.target.value)} />
            </label>
            <label title={`${entry.role} skin`}>
              <input type="color" value={entry.skin} onChange={(event) => updateEntry(entry.role, 'skin', event.target.value)} />
            </label>
            <label title={`${entry.role} hair`}>
              <input type="color" value={entry.hair} onChange={(event) => updateEntry(entry.role, 'hair', event.target.value)} />
            </label>
            <select title={`${entry.role} body`} value={entry.body} onChange={(event) => updateEntry(entry.role, 'body', event.target.value as CharacterBody)}>
              <option value="classic">Classic</option>
              <option value="jacket">Jacket</option>
              <option value="apron">Apron</option>
            </select>
            <select title={`${entry.role} hair style`} value={entry.hairStyle} onChange={(event) => updateEntry(entry.role, 'hairStyle', event.target.value as CharacterHairStyle)}>
              <option value="short">Short</option>
              <option value="side">Side</option>
              <option value="cap">Cap</option>
            </select>
            <select title={`${entry.role} accessory`} value={entry.accessory} onChange={(event) => updateEntry(entry.role, 'accessory', event.target.value as CharacterAccessory)}>
              <option value="none">None</option>
              <option value="badge">Badge</option>
              <option value="headset">Headset</option>
            </select>
          </div>
        ))}
      </div>
      <div className="buttonRow compact">
        <button
          className="secondaryButton"
          onClick={() => vscode.postMessage({ type: 'saveRolePalette', palette: { version: 1, entries, updatedAt: Date.now() } })}
        >
          <SaveIcon />
          Save
        </button>
        <button className="secondaryButton" onClick={() => vscode.postMessage({ type: 'resetRolePalette' })}>
          <RotateIcon />
          Reset
        </button>
      </div>
    </section>
  );
}

function HistoryPanel({ state }: { state: WarnyinState }) {
  const [rawCommand, setRawCommand] = useState('');
  const [promptLabel, setPromptLabel] = useState('');
  const canSavePrompt = rawCommand.trim().startsWith('/warnyin:');

  return (
    <section className="panelSection historySection">
      <div className="sectionTitle">
        <History size={16} />
        <h2>History</h2>
      </div>
      <div className="rawCommandRow">
        <Code2 size={16} />
        <input
          value={rawCommand}
          onChange={(event) => setRawCommand(event.target.value)}
          placeholder="/warnyin:design slug change"
        />
        <button
          className="iconButton run"
          title="Run raw Warnyin command"
          onClick={() => {
            runRawCommand(rawCommand);
            setRawCommand('');
          }}
        >
          <Send size={16} />
        </button>
      </div>
      <div className="savedPromptEditor">
        <input
          value={promptLabel}
          onChange={(event) => setPromptLabel(event.target.value)}
          placeholder="prompt label"
        />
        <button
          className="iconButton"
          title="Save prompt"
          disabled={!canSavePrompt}
          onClick={() => {
            vscode.postMessage({ type: 'savePrompt', label: promptLabel, command: rawCommand });
            setPromptLabel('');
          }}
        >
          <SaveIcon />
        </button>
        <button className="iconButton" title="Import prompts" onClick={() => vscode.postMessage({ type: 'importPrompts' })}>
          <Upload size={15} />
        </button>
        <button className="iconButton" title="Export prompts" onClick={() => vscode.postMessage({ type: 'exportPrompts' })}>
          <Download size={15} />
        </button>
      </div>
      <div className="savedPromptList">
        {state.savedPrompts.slice(0, 6).map((prompt) => (
          <div key={prompt.id} className="savedPromptItem">
            <button title={prompt.command} onClick={() => runRawCommand(prompt.command)}>
              <strong>{prompt.label}</strong>
              <span>{prompt.command}</span>
            </button>
            <button className="iconButton" title="Delete prompt" onClick={() => vscode.postMessage({ type: 'deletePrompt', promptId: prompt.id })}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="historyList">
        {state.commandHistory.length === 0 ? (
          <p className="mutedText">No commands yet.</p>
        ) : state.commandHistory.slice(0, 6).map((entry) => (
          <button
            key={entry.id}
            className="historyItem"
            title={entry.command}
            onClick={() => runRawCommand(entry.command)}
          >
            {entry.command}
          </button>
        ))}
      </div>
      <button className="secondaryButton clearButton" onClick={() => vscode.postMessage({ type: 'clearCommandHistory' })}>
        <Trash2 size={15} />
        Clear
      </button>
    </section>
  );
}

function StageCommand({
  id,
  label,
  icon,
  slug,
  setSlug,
  slugs,
}: {
  id: StageId;
  label: string;
  icon: ReactNode;
  slug: string;
  setSlug: (slug: string) => void;
  slugs: string[];
}) {
  return (
    <div className="commandRow">
      <div className="commandMeta">
        {icon}
        <span>{label}</span>
      </div>
      <select value={slug} onChange={(event) => setSlug(event.target.value)} disabled={!slugs[0]}>
        {slugs[0] ? slugs.map((item) => <option key={item} value={item}>{item}</option>) : <option value="">No stages</option>}
      </select>
      <button className="iconButton run" title={`Run ${label}`} disabled={!slug} onClick={() => runCommand(id, { slug })}>
        <Send size={16} />
      </button>
    </div>
  );
}

function AgentRoster({ state }: { state: WarnyinState }) {
  const agents = useMemo(() => {
    const active = state.transcript.agents;
    const activeIds = new Set(active.map((agent) => agent.id));
    const bench = state.roleBench.filter((agent) => !activeIds.has(agent.id));
    return [...active, ...bench].slice(0, 14);
  }, [state.roleBench, state.transcript.agents]);

  return (
    <section className="panelSection rosterSection">
      <div className="sectionTitle">
        <Terminal size={16} />
        <h2>Agents</h2>
      </div>
      <div className="tokenLine" title="Claude Code transcript token usage">
        Tokens: in {formatCount(state.transcript.tokenUsage.input)}
        {' '}
        out {formatCount(state.transcript.tokenUsage.output)}
        {' '}
        cache {formatCount(state.transcript.tokenUsage.cacheCreation + state.transcript.tokenUsage.cacheRead)}
      </div>
      <div className="agentList">
        {agents.map((agent) => (
          <div key={agent.id} className={`agentRow ${agent.status} ${agent.kind}`}>
            <span className="agentDot" />
            <div className="agentText">
              <strong>{agent.name}</strong>
              <small>
                {agent.role}
                {agent.tokenUsage ? ` · ${formatCount(agent.tokenUsage.input + agent.tokenUsage.output)} tok` : ''}
              </small>
            </div>
            <span className="agentActivity">{agent.activity}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

interface CueMarkers {
  latestCommand?: string;
  attentionKey?: string;
  verifyPassedKey?: string;
  shipReadyKey?: string;
}

type SoundCue = 'command' | 'attention' | 'complete';

let audioContext: AudioContext | undefined;

function cueMarkersForState(state: WarnyinState): CueMarkers {
  const attentionAgent = state.transcript.agents.find((agent) => agent.status === 'blocked' || agent.status === 'failed');
  const topic = state.activeTopic;
  return {
    latestCommand: state.transcript.latestCommand,
    attentionKey: attentionAgent
      ? `${attentionAgent.id}:${attentionAgent.status}:${attentionAgent.activity}:${attentionAgent.lastSeen}`
      : undefined,
    verifyPassedKey: topic?.workflow.verifyPassed
      ? `${topic.slug}:verify:${topic.workflow.verifyGateDone}:${topic.workflow.verifyFixCount ?? 0}`
      : undefined,
    shipReadyKey: topic?.workflow.shipReady ? `${topic.slug}:ship:${topic.workflow.shipArchiveTarget ?? 'ready'}` : undefined,
  };
}

function playSoundCue(cue: SoundCue) {
  try {
    const AudioContextCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }
    audioContext ??= new AudioContextCtor();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const frequency = cue === 'attention' ? 220 : cue === 'complete' ? 660 : 440;
    oscillator.type = cue === 'attention' ? 'square' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(cue === 'attention' ? 0.08 : 0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (cue === 'attention' ? 0.22 : 0.16));
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + (cue === 'attention' ? 0.24 : 0.18));
  } catch {
    // Audio is optional and may be blocked until the webview receives a user gesture.
  }
}

function runCommand(commandId: string, args?: Record<string, string>) {
  vscode.postMessage({ type: 'runCommand', commandId, args });
}

function runRawCommand(command: string) {
  vscode.postMessage({ type: 'runRawCommand', command });
}

function normalizeText(value: string) {
  return value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function isValidSlug(value: string) {
  const slug = value.trim();
  return /^[a-z0-9][a-z0-9-]*$/i.test(slug);
}

function formatCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return `${value}`;
}

function SaveIcon() {
  return <CheckCircle2 size={15} />;
}

function RotateIcon() {
  return <RefreshCcw size={15} />;
}
