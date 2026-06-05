export type StageId = 'discovery' | 'design' | 'build' | 'verify' | 'ship';
export type CommandStageId = StageId | 'init' | 'codemap' | 'skill' | 'explore' | 'next';
export type InstallState = 'noWorkspace' | 'notInstalled' | 'installed';
export type StageStatusValue = 'done' | 'active' | 'pending';
export type AgentStatus = 'offline' | 'waiting' | 'thinking' | 'running' | 'blocked' | 'complete' | 'failed';

export interface StageStatus {
  id: StageId;
  label: string;
  status: StageStatusValue;
  fileCount: number;
}

export interface TopicState {
  slug: string;
  activeStage: StageId;
  latestStage?: StageId;
  latestMtime: number;
  taskCount: number;
  issueCount: number;
  workflow: WorkflowSummary;
  stages: StageStatus[];
}

export interface WorkflowSummary {
  gatesDone: number;
  gatesTotal: number;
  tasksTotal: number;
  tasksPassed: number;
  tasksFailed: number;
  tasksPending: number;
  issuesOpen: number;
  dependencyCount: number;
  dependencyEdges: TaskDependencyEdge[];
  waveCount: number;
  verifyGateDone: number;
  verifyGateTotal: number;
  verifyPassed: boolean;
  verifyFixCount?: number;
  shipReady: boolean;
  shipArchiveTarget?: string;
  archived: boolean;
}

export interface TaskDependencyEdge {
  task: string;
  dependsOn: string;
}

export interface AgentSnapshot {
  id: string;
  name: string;
  role: string;
  kind: 'main' | 'subagent' | 'role';
  status: AgentStatus;
  activity: string;
  stage?: CommandStageId;
  toolName?: string;
  source?: string;
  parentToolId?: string;
  elapsedMs?: number;
  tokenUsage?: TokenUsage;
  lastSeen: number;
}

export interface TranscriptSnapshot {
  enabled: boolean;
  projectDir?: string;
  sessionCount: number;
  latestSession?: string;
  latestCommand?: string;
  currentStage?: CommandStageId;
  tokenUsage: TokenUsage;
  lastUpdated: number;
  agents: AgentSnapshot[];
}

export interface TokenUsage {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
}

export interface OfficeSeat {
  id: string;
  x: number;
  y: number;
  role?: string;
}

export type FurnitureKind =
  | 'review-table'
  | 'build-bench'
  | 'qa-station'
  | 'release-board'
  | 'docs-shelf'
  | 'plant'
  | 'logo-wall';

export interface FurnitureItem {
  id: string;
  kind: FurnitureKind;
  x: number;
  y: number;
}

export interface FurnitureCatalogItem {
  kind: FurnitureKind;
  label: string;
}

export interface OfficeLayout {
  version: 1;
  name: string;
  seats: OfficeSeat[];
  furniture: FurnitureItem[];
  updatedAt: number;
}

export interface OfficeLayoutPreset {
  id: string;
  name: string;
  description: string;
  layout: OfficeLayout;
  custom?: boolean;
}

export interface RolePaletteEntry {
  role: string;
  shirt: string;
  accent: string;
  skin: string;
  hair: string;
  body: CharacterBody;
  hairStyle: CharacterHairStyle;
  accessory: CharacterAccessory;
}

export interface RolePalette {
  version: 1;
  entries: RolePaletteEntry[];
  updatedAt: number;
}

export type CharacterBody = 'classic' | 'jacket' | 'apron';
export type CharacterHairStyle = 'short' | 'side' | 'cap';
export type CharacterAccessory = 'none' | 'badge' | 'headset';

export interface CommandHistoryEntry {
  id: string;
  command: string;
  commandId: string;
  createdAt: number;
}

export interface SavedPromptEntry {
  id: string;
  label: string;
  command: string;
  updatedAt: number;
}

export interface WarnyinState {
  workspacePath?: string;
  workspaceName?: string;
  installState: InstallState;
  installed: boolean;
  slugs: string[];
  archivedSlugs: string[];
  topics: TopicState[];
  activeTopic?: TopicState;
  stageFlow: StageStatus[];
  roleBench: AgentSnapshot[];
  transcript: TranscriptSnapshot;
  terminal: {
    name: string;
    isOpen: boolean;
    launchCommand: string;
  };
  officeLayout: OfficeLayout;
  officePresets: OfficeLayoutPreset[];
  furnitureCatalog: FurnitureCatalogItem[];
  rolePalette: RolePalette;
  commandHistory: CommandHistoryEntry[];
  savedPrompts: SavedPromptEntry[];
  soundCuesEnabled: boolean;
  logoUri?: string;
  generatedAt: number;
}

export type ExtensionMessage =
  | { type: 'state'; state: WarnyinState }
  | { type: 'toast'; message: string; level: 'info' | 'warning' | 'error' };

export interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}
