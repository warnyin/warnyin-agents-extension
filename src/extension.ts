import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import * as https from 'https';

import {
  buildSlashCommand as buildSlashCommandCore,
  buildWarnyinCommand as buildWarnyinCommandCore,
  cleanFreeText as cleanFreeTextCore,
  defaultOfficeLayout as defaultOfficeLayoutCore,
  defaultRolePalette as defaultRolePaletteCore,
  furnitureCatalog as furnitureCatalogCore,
  isUpdateAvailable as isUpdateAvailableCore,
  normalizeOfficeLayout as normalizeOfficeLayoutCore,
  normalizeRolePalette as normalizeRolePaletteCore,
  officeLayoutPresets as officeLayoutPresetsCore,
  sortWarnyinCommands as sortWarnyinCommandsCore,
  summarizeChecklist as summarizeChecklistCore,
} from './domain';
import type { WarnyinCommand } from './domain';

const VIEW_ID = 'warnyinAgents.view';
const COMMAND_SHOW_PANEL = 'warnyinAgents.showPanel';
const COMMAND_INSTALL = 'warnyinAgents.install';
const COMMAND_DRY_RUN = 'warnyinAgents.dryRun';
const COMMAND_UPDATE = 'warnyinAgents.update';
const COMMAND_FOCUS_TERMINAL = 'warnyinAgents.focusTerminal';
const COMMAND_EXPORT_LAYOUT = 'warnyinAgents.exportLayout';
const COMMAND_IMPORT_LAYOUT = 'warnyinAgents.importLayout';
const WARNYIN_TERMINAL_NAME = 'Warnyin Agents';
const INSTALLER_TERMINAL_NAME = 'Warnyin Installer';
const TRANSCRIPT_SCAN_INTERVAL_MS = 4_000;
const TRANSCRIPT_LINE_LIMIT = 1_200;
const OFFICE_LAYOUT_STATE_PREFIX = 'warnyinAgents.officeLayout.';
const CUSTOM_OFFICE_PRESETS_STATE_PREFIX = 'warnyinAgents.customOfficePresets.';
const ROLE_PALETTE_STATE_PREFIX = 'warnyinAgents.rolePalette.';
const COMMAND_HISTORY_STATE_PREFIX = 'warnyinAgents.commandHistory.';
const SAVED_PROMPTS_STATE_PREFIX = 'warnyinAgents.savedPrompts.';
const TRANSCRIPT_RUNTIME_STATE_PREFIX = 'warnyinAgents.transcriptRuntime.';
const COMMAND_HISTORY_LIMIT = 20;
const SAVED_PROMPTS_LIMIT = 40;
const CUSTOM_OFFICE_PRESETS_LIMIT = 12;
const WARNYIN_PACKAGE_NAME = '@warnyin/agents';
const INSTALLED_VERSION_STATE_PREFIX = 'warnyinAgents.installedVersion.';
const LATEST_VERSION_CACHE_STATE_KEY = 'warnyinAgents.latestVersionCache';
const LATEST_VERSION_TTL_MS = 6 * 60 * 60 * 1_000;
const LATEST_VERSION_FETCH_TIMEOUT_MS = 5_000;

type StageId = 'discovery' | 'design' | 'build' | 'verify' | 'ship';
type CommandStageId = StageId | 'init' | 'codemap' | 'skill' | 'explore' | 'next';
type InstallState = 'noWorkspace' | 'notInstalled' | 'installed';
type StageStatusValue = 'done' | 'active' | 'pending';
type AgentStatus = 'offline' | 'waiting' | 'thinking' | 'running' | 'blocked' | 'complete' | 'failed';

interface StageDefinition {
  id: StageId;
  label: string;
  primaryFile: string;
  files: string[];
}

interface StageStatus {
  id: StageId;
  label: string;
  status: StageStatusValue;
  fileCount: number;
}

interface TopicState {
  slug: string;
  activeStage: StageId;
  latestStage?: StageId;
  latestMtime: number;
  taskCount: number;
  issueCount: number;
  workflow: WorkflowSummary;
  stages: StageStatus[];
}

interface WorkflowSummary {
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

interface TaskDependencyEdge {
  task: string;
  dependsOn: string;
}

interface AgentSnapshot {
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

interface TranscriptSnapshot {
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

interface TokenUsage {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
}

interface TranscriptCursor {
  size: number;
  mtimeMs: number;
}

interface TranscriptRuntimeState {
  cursors: Record<string, TranscriptCursor>;
  snapshot?: TranscriptSnapshot;
  updatedAt: number;
}

interface OfficeSeat {
  id: string;
  x: number;
  y: number;
  role?: string;
}

type FurnitureKind =
  | 'review-table'
  | 'build-bench'
  | 'qa-station'
  | 'release-board'
  | 'docs-shelf'
  | 'plant'
  | 'logo-wall';

interface FurnitureItem {
  id: string;
  kind: FurnitureKind;
  x: number;
  y: number;
}

interface FurnitureCatalogItem {
  kind: FurnitureKind;
  label: string;
}

interface OfficeLayout {
  version: 1;
  name: string;
  seats: OfficeSeat[];
  furniture: FurnitureItem[];
  updatedAt: number;
}

interface OfficeLayoutPreset {
  id: string;
  name: string;
  description: string;
  layout: OfficeLayout;
  custom?: boolean;
}

interface RolePaletteEntry {
  role: string;
  shirt: string;
  accent: string;
  skin: string;
  hair: string;
  body: CharacterBody;
  hairStyle: CharacterHairStyle;
  accessory: CharacterAccessory;
}

interface RolePalette {
  version: 1;
  entries: RolePaletteEntry[];
  updatedAt: number;
}

type CharacterBody = 'classic' | 'jacket' | 'apron';
type CharacterHairStyle = 'short' | 'side' | 'cap';
type CharacterAccessory = 'none' | 'badge' | 'headset';

interface CommandHistoryEntry {
  id: string;
  command: string;
  commandId: string;
  createdAt: number;
}

interface SavedPromptEntry {
  id: string;
  label: string;
  command: string;
  updatedAt: number;
}

interface WarnyinVersionInfo {
  packageName: string;
  installed?: string;
  latest?: string;
  updateAvailable: boolean;
  checkedAt: number;
  offline: boolean;
}

interface LatestVersionCache {
  value?: string;
  checkedAt: number;
}

interface WarnyinState {
  workspacePath?: string;
  workspaceName?: string;
  installState: InstallState;
  installed: boolean;
  warnyinVersion: WarnyinVersionInfo;
  availableCommands: WarnyinCommand[];
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

type WebviewMessage =
  | { type: 'ready' }
  | { type: 'refresh' }
  | { type: 'checkVersion' }
  | { type: 'runInstaller'; mode: 'install' | 'dryRun' | 'update' }
  | { type: 'focusTerminal' }
  | { type: 'saveOfficeLayout'; layout: OfficeLayout }
  | { type: 'resetOfficeLayout' }
  | { type: 'exportOfficeLayout' }
  | { type: 'importOfficeLayout' }
  | { type: 'applyOfficePreset'; presetId: string }
  | { type: 'saveOfficePreset'; name: string; layout: OfficeLayout }
  | { type: 'deleteOfficePreset'; presetId: string }
  | { type: 'saveRolePalette'; palette: RolePalette }
  | { type: 'resetRolePalette' }
  | { type: 'clearCommandHistory' }
  | { type: 'savePrompt'; label: string; command: string }
  | { type: 'deletePrompt'; promptId: string }
  | { type: 'exportPrompts' }
  | { type: 'importPrompts' }
  | { type: 'runRawCommand'; command: string }
  | { type: 'runCommand'; commandId: string; args?: Record<string, string> };

const STAGES: StageDefinition[] = [
  {
    id: 'discovery',
    label: 'Discovery',
    primaryFile: 'discovery.md',
    files: ['discovery.md', 'research.md'],
  },
  {
    id: 'design',
    label: 'Design',
    primaryFile: 'design.md',
    files: ['business.md', 'proposal.md', 'design.md'],
  },
  {
    id: 'build',
    label: 'Build',
    primaryFile: 'build.md',
    files: ['build.md', 'troubleshooting.md'],
  },
  {
    id: 'verify',
    label: 'Verify',
    primaryFile: 'verify.md',
    files: ['test.md', 'verify.md'],
  },
  {
    id: 'ship',
    label: 'Ship',
    primaryFile: 'ship.md',
    files: ['ship.md'],
  },
];

const EMPTY_STAGE_FLOW: StageStatus[] = STAGES.map((stage) => ({
  id: stage.id,
  label: stage.label,
  status: stage.id === 'discovery' ? 'active' : 'pending',
  fileCount: 0,
}));

export function activate(context: vscode.ExtensionContext): void {
  const provider = new WarnyinAgentsViewProvider(context);

  context.subscriptions.push(vscode.window.registerWebviewViewProvider(VIEW_ID, provider));
  context.subscriptions.push(vscode.commands.registerCommand(COMMAND_SHOW_PANEL, () => {
    void vscode.commands.executeCommand(`${VIEW_ID}.focus`);
  }));
  context.subscriptions.push(vscode.commands.registerCommand(COMMAND_INSTALL, () => {
    void provider.runInstaller('install');
  }));
  context.subscriptions.push(vscode.commands.registerCommand(COMMAND_DRY_RUN, () => {
    void provider.runInstaller('dryRun');
  }));
  context.subscriptions.push(vscode.commands.registerCommand(COMMAND_UPDATE, () => {
    void provider.runInstaller('update');
  }));
  context.subscriptions.push(vscode.commands.registerCommand(COMMAND_FOCUS_TERMINAL, () => {
    provider.focusTerminal();
  }));
  context.subscriptions.push(vscode.commands.registerCommand(COMMAND_EXPORT_LAYOUT, () => {
    void provider.exportOfficeLayout();
  }));
  context.subscriptions.push(vscode.commands.registerCommand(COMMAND_IMPORT_LAYOUT, () => {
    void provider.importOfficeLayout();
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
    provider.resetWatchers();
    provider.scheduleRefresh();
  }));
  context.subscriptions.push(provider);
}

export function deactivate(): void {
  // VS Code disposes subscriptions registered in activate.
}

class WarnyinAgentsViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private webviewView?: vscode.WebviewView;
  private workspaceWatchers: vscode.FileSystemWatcher[] = [];
  private transcriptWatcher?: fs.FSWatcher;
  private transcriptInterval?: ReturnType<typeof setInterval>;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private lastTranscriptDir?: string;
  private lastBlockedNotificationKey?: string;
  private latestVersionCache?: LatestVersionCache;
  private latestVersionInFlight?: Promise<LatestVersionCache>;
  private disposed = false;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.resetWatchers();
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'dist'),
        this.context.extensionUri,
      ],
    };
    webview.html = this.getHtml(webview);
    webview.onDidReceiveMessage((message: WebviewMessage) => {
      void this.handleMessage(message);
    });
    this.scheduleRefresh(0);
  }

  dispose(): void {
    this.disposed = true;
    for (const watcher of this.workspaceWatchers) {
      watcher.dispose();
    }
    this.workspaceWatchers = [];
    this.transcriptWatcher?.close();
    this.transcriptWatcher = undefined;
    if (this.transcriptInterval) {
      clearInterval(this.transcriptInterval);
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  }

  resetWatchers(): void {
    for (const watcher of this.workspaceWatchers) {
      watcher.dispose();
    }
    this.workspaceWatchers = [];

    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.resetTranscriptWatcher(undefined);
      return;
    }

    const warnyinWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder, 'warnyin/**'),
    );
    const claudeCommandWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(folder, '.claude/commands/warnyin/**'),
    );
    for (const watcher of [warnyinWatcher, claudeCommandWatcher]) {
      watcher.onDidCreate(() => this.scheduleRefresh());
      watcher.onDidChange(() => this.scheduleRefresh());
      watcher.onDidDelete(() => this.scheduleRefresh());
      this.workspaceWatchers.push(watcher);
    }
    this.resetTranscriptWatcher(folder.uri.fsPath);
  }

  scheduleRefresh(delayMs = 150): void {
    if (this.disposed) {
      return;
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refreshState();
    }, delayMs);
  }

  async runInstaller(mode: 'install' | 'dryRun' | 'update'): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      vscode.window.showWarningMessage('Open a workspace folder before installing Warnyin.');
      return;
    }

    if (mode === 'update') {
      const installed = await isWarnyinInstalled(folder.uri.fsPath);
      if (!installed) {
        vscode.window.showWarningMessage('Warnyin is not installed in this workspace yet.');
        this.postToast('Install Warnyin before running Update Workflow.', 'warning');
        return;
      }
    }

    const args = mode === 'dryRun' ? ' --dry-run' : mode === 'update' ? ' --update' : '';
    const terminal = vscode.window.createTerminal({
      name: INSTALLER_TERMINAL_NAME,
      cwd: folder.uri.fsPath,
    });
    terminal.show();
    terminal.sendText(`npx ${WARNYIN_PACKAGE_NAME}${args}`);
    this.postToast(`Started ${mode === 'dryRun' ? 'installer dry run' : mode === 'update' ? 'workflow update' : 'Warnyin install'} in terminal.`, 'info');

    // A dry run does not change the workspace, so the recorded installed version stays untouched.
    // For install/update the CLI always pulls the npm `latest` dist-tag, so we stamp that version
    // (best effort) as the now-installed version once the latest lookup resolves.
    if (mode === 'install' || mode === 'update') {
      void this.recordInstalledVersionFromLatest(folder.uri.fsPath);
    }

    this.scheduleRefresh(3_000);
  }

  private async recordInstalledVersionFromLatest(workspacePath: string): Promise<void> {
    try {
      const cache = await this.getLatestVersion(true);
      if (cache.value) {
        await this.context.globalState.update(installedVersionStateKey(workspacePath), cache.value);
        this.scheduleRefresh(3_500);
      }
    } catch {
      // Offline or registry failure — leave the previously recorded version in place.
    }
  }

  /** Explicit user-triggered "check for updates" — forces a registry lookup and reports the result. */
  async checkLatestVersion(): Promise<void> {
    const cache = await this.getLatestVersion(true);
    if (!cache.value) {
      this.postToast('Could not reach npm to check the latest Warnyin version.', 'warning');
    } else {
      const folder = getPrimaryWorkspaceFolder();
      const installed = folder ? this.getInstalledVersion(folder.uri.fsPath) : undefined;
      if (installed && isUpdateAvailableCore(installed, cache.value)) {
        this.postToast(`Warnyin update available: ${installed} → ${cache.value}.`, 'info');
      } else {
        this.postToast(`Latest Warnyin workflow: ${cache.value}.`, 'info');
      }
    }
    this.scheduleRefresh(0);
  }

  private getInstalledVersion(workspacePath: string): string | undefined {
    const stored = this.context.globalState.get<string>(installedVersionStateKey(workspacePath));
    return typeof stored === 'string' && stored.trim() ? stored.trim() : undefined;
  }

  /**
   * Resolve the latest published `@warnyin/agents` version. Cached in memory and in
   * globalState with a TTL so frequent state rebuilds never hit the network. On a
   * registry failure the last known value is reused and the lookup is marked offline.
   */
  private async getLatestVersion(force = false): Promise<LatestVersionCache> {
    const now = Date.now();
    const cached = this.latestVersionCache
      ?? this.context.globalState.get<LatestVersionCache>(LATEST_VERSION_CACHE_STATE_KEY);
    if (cached) {
      this.latestVersionCache = cached;
      const fresh = cached.value && now - cached.checkedAt < LATEST_VERSION_TTL_MS;
      if (!force && fresh) {
        return cached;
      }
    }

    if (this.latestVersionInFlight) {
      return this.latestVersionInFlight;
    }

    const lookup = (async (): Promise<LatestVersionCache> => {
      try {
        const value = await fetchLatestNpmVersion(WARNYIN_PACKAGE_NAME);
        const next: LatestVersionCache = { value, checkedAt: Date.now() };
        this.latestVersionCache = next;
        await this.context.globalState.update(LATEST_VERSION_CACHE_STATE_KEY, next);
        return next;
      } catch {
        // Preserve the last known good value but keep the stale timestamp so a later
        // attempt re-tries. buildVersionInfo() reports this state as offline.
        return cached ?? { value: undefined, checkedAt: 0 };
      } finally {
        this.latestVersionInFlight = undefined;
      }
    })();

    this.latestVersionInFlight = lookup;
    return lookup;
  }

  private async buildVersionInfo(workspacePath: string | undefined, installed: boolean): Promise<WarnyinVersionInfo> {
    const cache = await this.getLatestVersion(false);
    const recorded = installed && workspacePath ? this.getInstalledVersion(workspacePath) : undefined;
    const stale = !cache.value || Date.now() - cache.checkedAt >= LATEST_VERSION_TTL_MS;
    return {
      packageName: WARNYIN_PACKAGE_NAME,
      installed: recorded,
      latest: cache.value,
      updateAvailable: installed ? isUpdateAvailableCore(recorded, cache.value) : false,
      checkedAt: cache.checkedAt,
      offline: stale,
    };
  }

  focusTerminal(): void {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.postToast('Open a workspace folder before starting Warnyin terminal.', 'warning');
      return;
    }

    const terminal = vscode.window.terminals.find((item) => item.name === WARNYIN_TERMINAL_NAME);
    if (terminal) {
      terminal.show();
      return;
    }

    this.openWarnyinTerminal(folder.uri.fsPath, true);
    this.postToast(`Started ${WARNYIN_TERMINAL_NAME} terminal.`, 'info');
    this.scheduleRefresh(1_000);
  }

  async exportOfficeLayout(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.postToast('Open a workspace folder before exporting layout.', 'warning');
      return;
    }

    const layout = this.loadOfficeLayout(folder.uri.fsPath);
    const defaultUri = vscode.Uri.file(path.join(folder.uri.fsPath, 'warnyin-office-layout.json'));
    const target = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {
        JSON: ['json'],
      },
      saveLabel: 'Export Layout',
      title: 'Export Warnyin Office Layout',
    });
    if (!target) {
      return;
    }

    await vscode.workspace.fs.writeFile(
      target,
      Buffer.from(`${JSON.stringify(layout, null, 2)}\n`, 'utf8'),
    );
    this.postToast(`Exported layout to ${path.basename(target.fsPath)}.`, 'info');
  }

  async importOfficeLayout(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.postToast('Open a workspace folder before importing layout.', 'warning');
      return;
    }

    const selections = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        JSON: ['json'],
      },
      openLabel: 'Import Layout',
      title: 'Import Warnyin Office Layout',
    });
    const source = selections?.[0];
    if (!source) {
      return;
    }

    try {
      const raw = Buffer.from(await vscode.workspace.fs.readFile(source)).toString('utf8');
      const parsed = JSON.parse(raw) as unknown;
      const layout = normalizeOfficeLayoutCore(parsed as OfficeLayout);
      const preview = describeLayoutImport(parsed, layout);
      const action = preview.hasWarnings
        ? await vscode.window.showWarningMessage(
          preview.message,
          { modal: true, detail: preview.detail },
          'Import Layout',
        )
        : await vscode.window.showInformationMessage(
          preview.message,
          { modal: true, detail: preview.detail },
          'Import Layout',
        );
      if (action !== 'Import Layout') {
        return;
      }
      await this.context.globalState.update(officeLayoutStateKey(folder.uri.fsPath), {
        ...layout,
        updatedAt: Date.now(),
      });
      this.postToast(`Imported layout from ${path.basename(source.fsPath)}.`, 'info');
      this.scheduleRefresh(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid layout file.';
      this.postToast(`Import failed: ${message}`, 'error');
    }
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
      case 'refresh':
        this.scheduleRefresh(0);
        break;
      case 'checkVersion':
        await this.checkLatestVersion();
        break;
      case 'runInstaller':
        await this.runInstaller(message.mode);
        break;
      case 'focusTerminal':
        this.focusTerminal();
        break;
      case 'saveOfficeLayout':
        await this.saveOfficeLayout(message.layout);
        break;
      case 'resetOfficeLayout':
        await this.resetOfficeLayout();
        break;
      case 'exportOfficeLayout':
        await this.exportOfficeLayout();
        break;
      case 'importOfficeLayout':
        await this.importOfficeLayout();
        break;
      case 'applyOfficePreset':
        await this.applyOfficePreset(message.presetId);
        break;
      case 'saveOfficePreset':
        await this.saveOfficePreset(message.name, message.layout);
        break;
      case 'deleteOfficePreset':
        await this.deleteOfficePreset(message.presetId);
        break;
      case 'saveRolePalette':
        await this.saveRolePalette(message.palette);
        break;
      case 'resetRolePalette':
        await this.resetRolePalette();
        break;
      case 'clearCommandHistory':
        await this.clearCommandHistory();
        break;
      case 'savePrompt':
        await this.savePrompt(message.label, message.command);
        break;
      case 'deletePrompt':
        await this.deletePrompt(message.promptId);
        break;
      case 'exportPrompts':
        await this.exportPrompts();
        break;
      case 'importPrompts':
        await this.importPrompts();
        break;
      case 'runRawCommand':
        await this.runRawCommand(message.command);
        break;
      case 'runCommand':
        await this.runWarnyinCommand(message.commandId, message.args ?? {});
        break;
      default:
        break;
    }
  }

  private async saveOfficeLayout(layout: OfficeLayout): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.postToast('Open a workspace folder before saving layout.', 'warning');
      return;
    }

    const normalized = normalizeOfficeLayoutCore(layout);
    await this.context.globalState.update(officeLayoutStateKey(folder.uri.fsPath), normalized);
    this.postToast('Office layout saved.', 'info');
    this.scheduleRefresh(0);
  }

  private async resetOfficeLayout(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.postToast('Open a workspace folder before resetting layout.', 'warning');
      return;
    }

    await this.context.globalState.update(officeLayoutStateKey(folder.uri.fsPath), undefined);
    this.postToast('Office layout reset.', 'info');
    this.scheduleRefresh(0);
  }

  private async applyOfficePreset(presetId: string): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.postToast('Open a workspace folder before applying layout preset.', 'warning');
      return;
    }

    const preset = this.loadOfficePresets(folder.uri.fsPath).find((item) => item.id === presetId);
    if (!preset) {
      this.postToast(`Unknown layout preset: ${presetId}`, 'error');
      return;
    }

    await this.context.globalState.update(officeLayoutStateKey(folder.uri.fsPath), {
      ...preset.layout,
      updatedAt: Date.now(),
    });
    this.postToast(`Applied ${preset.name}.`, 'info');
    this.scheduleRefresh(0);
  }

  private async saveOfficePreset(name: string, layout: OfficeLayout): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.postToast('Open a workspace folder before saving layout preset.', 'warning');
      return;
    }

    const normalizedName = cleanFreeTextCore(name).slice(0, 64);
    if (!normalizedName) {
      this.postToast('Preset name is required.', 'warning');
      return;
    }

    const preset: OfficeLayoutPreset = {
      id: customPresetId(normalizedName),
      name: normalizedName,
      description: 'Custom workspace layout preset.',
      layout: normalizeOfficeLayoutCore({
        ...layout,
        name: normalizedName,
        updatedAt: Date.now(),
      }),
      custom: true,
    };
    const existing = this.loadCustomOfficePresets(folder.uri.fsPath)
      .filter((item) => item.id !== preset.id && item.name.toLowerCase() !== normalizedName.toLowerCase())
      .slice(0, CUSTOM_OFFICE_PRESETS_LIMIT - 1);

    await this.context.globalState.update(
      customOfficePresetsStateKey(folder.uri.fsPath),
      [preset, ...existing],
    );
    this.postToast(`Saved layout preset: ${preset.name}.`, 'info');
    this.scheduleRefresh(0);
  }

  private async deleteOfficePreset(presetId: string): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.postToast('Open a workspace folder before deleting layout preset.', 'warning');
      return;
    }

    if (!presetId.startsWith('custom-')) {
      this.postToast('Only custom layout presets can be deleted.', 'warning');
      return;
    }

    const remaining = this.loadCustomOfficePresets(folder.uri.fsPath)
      .filter((item) => item.id !== presetId);
    await this.context.globalState.update(customOfficePresetsStateKey(folder.uri.fsPath), remaining);
    this.postToast('Custom layout preset deleted.', 'info');
    this.scheduleRefresh(0);
  }

  private async saveRolePalette(palette: RolePalette): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.postToast('Open a workspace folder before saving palette.', 'warning');
      return;
    }

    await this.context.globalState.update(
      rolePaletteStateKey(folder.uri.fsPath),
      normalizeRolePaletteCore(palette),
    );
    this.postToast('Role palette saved.', 'info');
    this.scheduleRefresh(0);
  }

  private async resetRolePalette(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.postToast('Open a workspace folder before resetting palette.', 'warning');
      return;
    }

    await this.context.globalState.update(rolePaletteStateKey(folder.uri.fsPath), undefined);
    this.postToast('Role palette reset.', 'info');
    this.scheduleRefresh(0);
  }

  private async clearCommandHistory(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      return;
    }
    await this.context.globalState.update(commandHistoryStateKey(folder.uri.fsPath), []);
    this.postToast('Command history cleared.', 'info');
    this.scheduleRefresh(0);
  }

  private async savePrompt(label: string, command: string): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      return;
    }
    const normalizedCommand = cleanFreeTextCore(command);
    const normalizedLabel = cleanFreeTextCore(label) || normalizedCommand.split(' ')[0];
    if (!normalizedCommand.startsWith('/warnyin:')) {
      this.postToast('Saved prompt must start with /warnyin:.', 'error');
      return;
    }
    const entry: SavedPromptEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: normalizedLabel.slice(0, 80),
      command: normalizedCommand,
      updatedAt: Date.now(),
    };
    const existing = this.loadSavedPrompts(folder.uri.fsPath)
      .filter((item) => item.command !== normalizedCommand && item.label !== normalizedLabel)
      .slice(0, SAVED_PROMPTS_LIMIT - 1);
    await this.context.globalState.update(savedPromptsStateKey(folder.uri.fsPath), [entry, ...existing]);
    this.postToast(`Saved prompt: ${entry.label}`, 'info');
    this.scheduleRefresh(0);
  }

  private async deletePrompt(promptId: string): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      return;
    }
    const prompts = this.loadSavedPrompts(folder.uri.fsPath)
      .filter((item) => item.id !== promptId);
    await this.context.globalState.update(savedPromptsStateKey(folder.uri.fsPath), prompts);
    this.postToast('Saved prompt deleted.', 'info');
    this.scheduleRefresh(0);
  }

  private async exportPrompts(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.postToast('Open a workspace folder before exporting prompts.', 'warning');
      return;
    }
    const target = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(folder.uri.fsPath, 'warnyin-saved-prompts.json')),
      filters: { JSON: ['json'] },
      saveLabel: 'Export Prompts',
      title: 'Export Warnyin Saved Prompts',
    });
    if (!target) {
      return;
    }
    await vscode.workspace.fs.writeFile(
      target,
      Buffer.from(`${JSON.stringify(this.loadSavedPrompts(folder.uri.fsPath), null, 2)}\n`, 'utf8'),
    );
    this.postToast(`Exported prompts to ${path.basename(target.fsPath)}.`, 'info');
  }

  private async importPrompts(): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.postToast('Open a workspace folder before importing prompts.', 'warning');
      return;
    }
    const selections = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { JSON: ['json'] },
      openLabel: 'Import Prompts',
      title: 'Import Warnyin Saved Prompts',
    });
    const source = selections?.[0];
    if (!source) {
      return;
    }
    try {
      const raw = Buffer.from(await vscode.workspace.fs.readFile(source)).toString('utf8');
      const imported = normalizeSavedPrompts(JSON.parse(raw));
      const existing = this.loadSavedPrompts(folder.uri.fsPath);
      const merged = [...imported, ...existing]
        .filter((item, index, all) => all.findIndex((candidate) => candidate.command === item.command) === index)
        .slice(0, SAVED_PROMPTS_LIMIT);
      await this.context.globalState.update(savedPromptsStateKey(folder.uri.fsPath), merged);
      this.postToast(`Imported ${imported.length} prompt(s).`, 'info');
      this.scheduleRefresh(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid prompts file.';
      this.postToast(`Prompt import failed: ${message}`, 'error');
    }
  }

  private async runRawCommand(command: string): Promise<void> {
    const normalized = cleanFreeTextCore(command);
    if (!normalized.startsWith('/warnyin:')) {
      this.postToast('Raw command must start with /warnyin:.', 'error');
      return;
    }
    await this.sendSlashCommand('raw', normalized);
  }

  private async runWarnyinCommand(commandId: string, args: Record<string, string>): Promise<void> {
    let slashCommand: string;
    try {
      slashCommand = buildSlashCommandCore(commandId, args);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid command input.';
      this.postToast(message, 'error');
      return;
    }
    await this.sendSlashCommand(commandId, slashCommand);
  }

  private async sendSlashCommand(commandId: string, slashCommand: string): Promise<void> {
    const folder = getPrimaryWorkspaceFolder();
    if (!folder) {
      this.postToast('Open a workspace folder before running Warnyin commands.', 'warning');
      return;
    }

    const installed = await isWarnyinInstalled(folder.uri.fsPath);
    if (!installed) {
      this.postToast('Warnyin is not installed. Command UI is locked.', 'warning');
      return;
    }

    const { terminal, created } = this.openWarnyinTerminal(folder.uri.fsPath, true);
    if (created) {
      setTimeout(() => terminal.sendText(slashCommand), 1_500);
    } else {
      terminal.sendText(slashCommand);
    }

    await this.recordCommandHistory(folder.uri.fsPath, commandId, slashCommand);
    this.postToast(`Sent ${slashCommand.split(' ')[0]} to ${WARNYIN_TERMINAL_NAME}.`, 'info');
    this.scheduleRefresh(2_000);
  }

  private openWarnyinTerminal(workspacePath: string, launchClaude: boolean): {
    terminal: vscode.Terminal;
    created: boolean;
  } {
    const existingTerminal = vscode.window.terminals.find((item) => item.name === WARNYIN_TERMINAL_NAME);
    if (existingTerminal) {
      existingTerminal.show();
      return { terminal: existingTerminal, created: false };
    }

    const terminal = vscode.window.createTerminal({
      name: WARNYIN_TERMINAL_NAME,
      cwd: workspacePath,
    });
    terminal.show();
    if (launchClaude) {
      terminal.sendText(this.getLaunchCommand());
    }
    return { terminal, created: true };
  }

  private getLaunchCommand(): string {
    return vscode.workspace
      .getConfiguration('warnyinAgents')
      .get<string>('launchCommand', 'claude')
      .trim() || 'claude';
  }

  private async recordCommandHistory(
    workspacePath: string,
    commandId: string,
    command: string,
  ): Promise<void> {
    const entry: CommandHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      command,
      commandId,
      createdAt: Date.now(),
    };
    const existing = this.loadCommandHistory(workspacePath)
      .filter((item) => item.command !== command)
      .slice(0, COMMAND_HISTORY_LIMIT - 1);
    await this.context.globalState.update(commandHistoryStateKey(workspacePath), [entry, ...existing]);
  }

  private async refreshState(): Promise<void> {
    const state = await this.buildState();
    this.postMessage({ type: 'state', state });
  }

  private async buildState(): Promise<WarnyinState> {
    const folder = getPrimaryWorkspaceFolder();
    const logoUri = this.webviewView
      ? this.webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'logo.png')).toString()
      : undefined;
    const soundCuesEnabled = vscode.workspace
      .getConfiguration('warnyinAgents')
      .get<boolean>('soundCues', false);

    if (!folder) {
      return {
        installState: 'noWorkspace',
        installed: false,
        warnyinVersion: await this.buildVersionInfo(undefined, false),
        availableCommands: [],
        slugs: [],
        archivedSlugs: [],
        topics: [],
        stageFlow: EMPTY_STAGE_FLOW,
        roleBench: buildRoleBench(undefined),
        transcript: emptyTranscript(false),
        terminal: {
          name: WARNYIN_TERMINAL_NAME,
          isOpen: vscode.window.terminals.some((item) => item.name === WARNYIN_TERMINAL_NAME),
          launchCommand: this.getLaunchCommand(),
        },
        officeLayout: defaultOfficeLayoutCore(),
        officePresets: officeLayoutPresetsCore(),
        furnitureCatalog: furnitureCatalogCore(),
        rolePalette: defaultRolePaletteCore(),
        commandHistory: [],
        savedPrompts: [],
        soundCuesEnabled,
        logoUri,
        generatedAt: Date.now(),
      };
    }

    const workspacePath = folder.uri.fsPath;
    const installed = await isWarnyinInstalled(workspacePath);
    const topics = installed ? await readTopics(workspacePath) : [];
    const archivedSlugs = installed ? await readArchivedSlugs(workspacePath) : [];
    const availableCommands = installed ? await readWarnyinCommands(workspacePath) : [];
    const activeTopic = topics[0];
    const stageFlow = activeTopic?.stages ?? EMPTY_STAGE_FLOW;
    const transcriptEnabled = vscode.workspace
      .getConfiguration('warnyinAgents')
      .get<boolean>('watchClaudeTranscripts', true);
    const transcriptRuntime = installed ? this.loadTranscriptRuntime(workspacePath) : undefined;
    const transcriptResult = installed
      ? await scanClaudeTranscripts(workspacePath, transcriptEnabled, transcriptRuntime)
      : { snapshot: emptyTranscript(transcriptEnabled), runtime: undefined };
    const transcript = transcriptResult.snapshot;
    if (installed && transcriptResult.runtime) {
      await this.saveTranscriptRuntime(workspacePath, transcriptResult.runtime);
    }
    this.notifyBlockedIfNeeded(transcript);
    const activeStage = transcript.currentStage && isStageId(transcript.currentStage)
      ? transcript.currentStage
      : activeTopic?.activeStage;

    return {
      workspacePath,
      workspaceName: folder.name,
      installState: installed ? 'installed' : 'notInstalled',
      installed,
      warnyinVersion: await this.buildVersionInfo(workspacePath, installed),
      availableCommands,
      slugs: topics.map((topic) => topic.slug),
      archivedSlugs,
      topics,
      activeTopic,
      stageFlow,
      roleBench: buildRoleBench(activeStage, activeTopic),
      transcript,
      terminal: {
        name: WARNYIN_TERMINAL_NAME,
        isOpen: vscode.window.terminals.some((item) => item.name === WARNYIN_TERMINAL_NAME),
        launchCommand: this.getLaunchCommand(),
      },
      officeLayout: this.loadOfficeLayout(workspacePath),
      officePresets: this.loadOfficePresets(workspacePath),
      furnitureCatalog: furnitureCatalogCore(),
      rolePalette: this.loadRolePalette(workspacePath),
      commandHistory: this.loadCommandHistory(workspacePath),
      savedPrompts: this.loadSavedPrompts(workspacePath),
      soundCuesEnabled,
      logoUri,
      generatedAt: Date.now(),
    };
  }

  private notifyBlockedIfNeeded(transcript: TranscriptSnapshot): void {
    const enabled = vscode.workspace
      .getConfiguration('warnyinAgents')
      .get<boolean>('notifyOnBlocked', true);
    if (!enabled) {
      return;
    }

    const attentionAgent = transcript.agents.find((agent) => agent.status === 'blocked' || agent.status === 'failed');
    if (!attentionAgent) {
      return;
    }
    const key = `${attentionAgent.id}:${attentionAgent.status}:${attentionAgent.activity}:${attentionAgent.lastSeen}`;
    if (this.lastBlockedNotificationKey === key) {
      return;
    }
    this.lastBlockedNotificationKey = key;
    vscode.window.showWarningMessage(
      `Warnyin agent needs attention: ${attentionAgent.name} - ${attentionAgent.activity}`,
      'Focus Terminal',
    ).then((action) => {
      if (action === 'Focus Terminal') {
        this.focusTerminal();
      }
    });
  }

  private loadOfficeLayout(workspacePath: string): OfficeLayout {
    const stored = this.context.globalState.get<OfficeLayout>(officeLayoutStateKey(workspacePath));
    return normalizeOfficeLayoutCore(stored);
  }

  private loadOfficePresets(workspacePath: string): OfficeLayoutPreset[] {
    return [
      ...officeLayoutPresetsCore(),
      ...this.loadCustomOfficePresets(workspacePath),
    ];
  }

  private loadCustomOfficePresets(workspacePath: string): OfficeLayoutPreset[] {
    const stored = this.context.globalState.get<OfficeLayoutPreset[]>(
      customOfficePresetsStateKey(workspacePath),
      [],
    );
    if (!Array.isArray(stored)) {
      return [];
    }
    return stored
      .filter((item) => {
        return (
          typeof item.id === 'string' &&
          item.id.startsWith('custom-') &&
          typeof item.name === 'string' &&
          typeof item.description === 'string' &&
          item.layout?.version === 1
        );
      })
      .map((item) => ({
        id: item.id,
        name: cleanFreeTextCore(item.name).slice(0, 64) || 'Custom Layout',
        description: cleanFreeTextCore(item.description).slice(0, 120) || 'Custom workspace layout preset.',
        layout: normalizeOfficeLayoutCore(item.layout),
        custom: true,
      }))
      .slice(0, CUSTOM_OFFICE_PRESETS_LIMIT);
  }

  private loadRolePalette(workspacePath: string): RolePalette {
    const stored = this.context.globalState.get<RolePalette>(rolePaletteStateKey(workspacePath));
    return normalizeRolePaletteCore(stored);
  }

  private loadCommandHistory(workspacePath: string): CommandHistoryEntry[] {
    const stored = this.context.globalState.get<CommandHistoryEntry[]>(
      commandHistoryStateKey(workspacePath),
      [],
    );
    return Array.isArray(stored)
      ? stored
        .filter((item) => typeof item.command === 'string' && item.command.startsWith('/warnyin:'))
        .slice(0, COMMAND_HISTORY_LIMIT)
      : [];
  }

  private loadSavedPrompts(workspacePath: string): SavedPromptEntry[] {
    return normalizeSavedPrompts(
      this.context.globalState.get<SavedPromptEntry[]>(savedPromptsStateKey(workspacePath), []),
    );
  }

  private loadTranscriptRuntime(workspacePath: string): TranscriptRuntimeState | undefined {
    const stored = this.context.globalState.get<TranscriptRuntimeState>(
      transcriptRuntimeStateKey(workspacePath),
    );
    if (!stored || typeof stored !== 'object' || !stored.cursors) {
      return undefined;
    }
    return stored;
  }

  private async saveTranscriptRuntime(
    workspacePath: string,
    runtime: TranscriptRuntimeState,
  ): Promise<void> {
    await this.context.globalState.update(transcriptRuntimeStateKey(workspacePath), runtime);
  }

  private resetTranscriptWatcher(workspacePath: string | undefined): void {
    this.transcriptWatcher?.close();
    this.transcriptWatcher = undefined;
    this.lastTranscriptDir = undefined;
    if (this.transcriptInterval) {
      clearInterval(this.transcriptInterval);
      this.transcriptInterval = undefined;
    }

    if (!workspacePath) {
      return;
    }

    const enabled = vscode.workspace
      .getConfiguration('warnyinAgents')
      .get<boolean>('watchClaudeTranscripts', true);
    if (!enabled) {
      return;
    }

    const projectDir = resolveClaudeProjectDir(workspacePath);
    this.lastTranscriptDir = projectDir;
    if (projectDir && fs.existsSync(projectDir)) {
      try {
        this.transcriptWatcher = fs.watch(projectDir, (eventType, filename) => {
          if (filename?.toString().endsWith('.jsonl') || eventType === 'rename') {
            this.scheduleRefresh(250);
          }
        });
      } catch {
        this.transcriptWatcher = undefined;
      }
    }

    this.transcriptInterval = setInterval(() => {
      const nextDir = resolveClaudeProjectDir(workspacePath);
      if (nextDir !== this.lastTranscriptDir) {
        this.resetTranscriptWatcher(workspacePath);
      }
      this.scheduleRefresh(0);
    }, TRANSCRIPT_SCAN_INTERVAL_MS);
  }

  private postToast(message: string, level: 'info' | 'warning' | 'error'): void {
    this.postMessage({ type: 'toast', message, level });
  }

  private postMessage(message: unknown): void {
    void this.webviewView?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'dist', 'assets', 'index.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'dist', 'assets', 'index.css'),
    );
    const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'logo.png'));
    const assetBaseUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'dist', 'assets'),
    );

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <link rel="stylesheet" href="${styleUri}">
    <title>Warnyin Agents</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}">
      window.__WARNYIN_LOGO_URI__ = ${JSON.stringify(logoUri.toString())};
      window.__WARNYIN_ASSET_BASE_URI__ = ${JSON.stringify(assetBaseUri.toString())};
    </script>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

function getPrimaryWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}

async function isWarnyinInstalled(workspacePath: string): Promise<boolean> {
  const workflowDir = path.join(workspacePath, 'warnyin', 'workflow');
  const commandsDir = path.join(workspacePath, '.claude', 'commands', 'warnyin');
  return (await pathExists(workflowDir)) && (await pathExists(commandsDir));
}

async function readTopics(workspacePath: string): Promise<TopicState[]> {
  const stagesRoot = path.join(workspacePath, 'warnyin', 'stages');
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(stagesRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const topics = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => entry.name !== 'achieved' && !entry.name.startsWith('['))
      .map((entry) => readTopic(path.join(stagesRoot, entry.name), entry.name)),
  );

  topics.sort((a, b) => b.latestMtime - a.latestMtime || a.slug.localeCompare(b.slug));
  return topics;
}

async function readWarnyinCommands(workspacePath: string): Promise<WarnyinCommand[]> {
  const commandsDir = path.join(workspacePath, '.claude', 'commands', 'warnyin');
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(commandsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .slice(0, 60);

  const commands = await Promise.all(
    files.map(async (entry) => {
      try {
        const raw = await fs.promises.readFile(path.join(commandsDir, entry.name), 'utf8');
        return buildWarnyinCommandCore(entry.name, raw);
      } catch {
        return undefined;
      }
    }),
  );

  return sortWarnyinCommandsCore(commands.filter((command): command is WarnyinCommand => command !== undefined));
}

async function readArchivedSlugs(workspacePath: string): Promise<string[]> {
  const achievedRoot = path.join(workspacePath, 'warnyin', 'stages', 'achieved');
  try {
    const entries = await fs.promises.readdir(achievedRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 30);
  } catch {
    return [];
  }
}

async function readTopic(topicPath: string, slug: string): Promise<TopicState> {
  const stages: StageStatus[] = [];
  let latestStage: StageId | undefined;
  let latestMtime = 0;
  let lastDoneIndex = -1;

  for (let index = 0; index < STAGES.length; index++) {
    const stage = STAGES[index];
    let fileCount = 0;
    let stageLatest = 0;
    for (const file of stage.files) {
      const stat = await statIfExists(path.join(topicPath, file));
      if (stat) {
        fileCount++;
        stageLatest = Math.max(stageLatest, stat.mtimeMs);
      }
    }
    const primaryExists = await pathExists(path.join(topicPath, stage.primaryFile));
    if (primaryExists) {
      lastDoneIndex = index;
    }
    if (stageLatest > latestMtime) {
      latestMtime = stageLatest;
      latestStage = stage.id;
    }
    stages.push({
      id: stage.id,
      label: stage.label,
      status: primaryExists ? 'done' : 'pending',
      fileCount,
    });
  }

  const activeIndex = Math.min(Math.max(lastDoneIndex + 1, 0), STAGES.length - 1);
  stages[activeIndex] = {
    ...stages[activeIndex],
    status: stages[activeIndex].status === 'done' ? 'done' : 'active',
  };

  const tasksPath = path.join(topicPath, 'tasks');
  const taskCount = await countDirectories(tasksPath);
  const issueCount = await countFilesByName(tasksPath, 'issue.md');
  const workflow = await analyzeWorkflow(topicPath, tasksPath, taskCount, issueCount);

  return {
    slug,
    activeStage: STAGES[activeIndex].id,
    latestStage,
    latestMtime,
    taskCount,
    issueCount,
    workflow,
    stages,
  };
}

async function analyzeWorkflow(
  topicPath: string,
  tasksPath: string,
  taskCount: number,
  issueCount: number,
): Promise<WorkflowSummary> {
  let gatesDone = 0;
  let gatesTotal = 0;
  for (const stage of STAGES) {
    const content = await readTextIfExists(path.join(topicPath, stage.primaryFile));
    const checklist = summarizeChecklistCore(content);
    gatesDone += checklist.done;
    gatesTotal += checklist.total;
  }

  const taskFiles = await findFilesByName(tasksPath, 'task.md');
  let tasksPassed = 0;
  let tasksFailed = 0;
  const dependencyEdges: TaskDependencyEdge[] = [];
  for (const taskFile of taskFiles) {
    const content = (await readTextIfExists(taskFile)).toLowerCase();
    const taskName = path.basename(path.dirname(taskFile));
    dependencyEdges.push(...readTaskDependencies(content).map((dependsOn) => ({
      task: taskName,
      dependsOn,
    })));
    if (/\b(failed|blocked|แดง|ล้มเหลว)\b/.test(content)) {
      tasksFailed++;
    } else if (/\b(passed|done|complete|เสร็จ|ผ่าน)\b/.test(content)) {
      tasksPassed++;
    }
  }

  const designText = await readTextIfExists(path.join(topicPath, 'design.md'));
  const buildText = await readTextIfExists(path.join(topicPath, 'build.md'));
  const waveMatches = `${designText}\n${buildText}`.match(/\bwave\s+\d+/gi) ?? [];
  const waveCount = new Set(waveMatches.map((item) => item.toLowerCase())).size;
  const verifyText = await readTextIfExists(path.join(topicPath, 'verify.md'));
  const testText = await readTextIfExists(path.join(topicPath, 'test.md'));
  const verifyChecklist = summarizeChecklistCore(`${testText}\n${verifyText}`);
  const verifyPassed = verifyChecklist.total > 0
    ? verifyChecklist.done === verifyChecklist.total
    : /\b(passed|success|complete|ผ่าน|เขียว|สำเร็จ)\b/i.test(verifyText);
  const verifyFixCount = readFixCount(verifyText);
  const shipText = await readTextIfExists(path.join(topicPath, 'ship.md'));
  const shipArchiveTarget = readArchiveTarget(shipText);

  return {
    gatesDone,
    gatesTotal,
    tasksTotal: taskCount,
    tasksPassed,
    tasksFailed,
    tasksPending: Math.max(0, taskCount - tasksPassed - tasksFailed),
    issuesOpen: issueCount,
    dependencyCount: dependencyEdges.length,
    dependencyEdges,
    waveCount,
    verifyGateDone: verifyChecklist.done,
    verifyGateTotal: verifyChecklist.total,
    verifyPassed,
    verifyFixCount,
    shipReady: Boolean(shipText.trim()) || path.basename(path.dirname(topicPath)) === 'achieved',
    shipArchiveTarget,
    archived: path.basename(path.dirname(topicPath)) === 'achieved',
  };
}

function readTaskDependencies(markdown: string): string[] {
  const dependencies = new Set<string>();
  for (const line of markdown.split(/\r?\n/)) {
    if (!/\b(dependency|dependencies|depends?)\b|ขึ้นกับ|พึ่งพา/i.test(line)) {
      continue;
    }
    if (/\b(none|n\/a|no dependency|ไม่มี)\b/i.test(line)) {
      continue;
    }
    const candidateText = line.split('|').slice(1).join(' ') || line;
    const matches = candidateText.match(/\b[a-z0-9][a-z0-9-]{2,}\b/gi) ?? [];
    for (const item of matches) {
      if (!/^depend/i.test(item)) {
        dependencies.add(item);
      }
    }
  }
  return [...dependencies];
}

function readFixCount(markdown: string): number | undefined {
  const patterns = [
    /(?:fix(?:es)?|แก้ไข|รอบแก้|จำนวนการแก้ไข)[^\d]{0,24}(\d+)/i,
    /(\d+)[^\n]{0,24}(?:fix(?:es)?|แก้ไข|รอบแก้)/i,
  ];
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value)) {
        return value;
      }
    }
  }
  return undefined;
}

function readArchiveTarget(markdown: string): string | undefined {
  const match = markdown.match(/warnyin[\\/]+stages[\\/]+achieved[\\/]+([0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+)/i)
    ?? markdown.match(/achieved[\\/]+([0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+)/i);
  return match?.[1];
}

async function scanClaudeTranscripts(
  workspacePath: string,
  enabled: boolean,
  runtime?: TranscriptRuntimeState,
): Promise<{ snapshot: TranscriptSnapshot; runtime: TranscriptRuntimeState | undefined }> {
  const projectDir = resolveClaudeProjectDir(workspacePath);
  const snapshot = cloneTranscriptSnapshot(runtime?.snapshot ?? emptyTranscript(enabled));
  snapshot.enabled = enabled;
  snapshot.projectDir = projectDir;

  if (!enabled || !projectDir || !fs.existsSync(projectDir)) {
    return {
      snapshot: emptyTranscript(enabled),
      runtime: {
        cursors: runtime?.cursors ?? {},
        snapshot: emptyTranscript(enabled),
        updatedAt: Date.now(),
      },
    };
  }

  let files: Array<{ filePath: string; mtimeMs: number }> = [];
  try {
    files = (await fs.promises.readdir(projectDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
      .map((entry) => path.join(projectDir, entry.name))
      .map((filePath) => {
        const stat = fs.statSync(filePath);
        return { filePath, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return { snapshot, runtime };
  }

  snapshot.sessionCount = files.length;
  snapshot.latestSession = files[0] ? path.basename(files[0].filePath) : undefined;

  const existingMain = snapshot.agents.find((agent) => agent.kind === 'main');
  const mainAgent = existingMain ? cloneAgent(existingMain) : createMainAgent(files[0]?.mtimeMs ?? 0);
  const subagents = new Map(
    snapshot.agents
      .filter((agent) => agent.kind !== 'main')
      .map((agent) => [agent.id, cloneAgent(agent)]),
  );
  const selectedFiles = files.slice(0, 5).reverse();
  const nextCursors: Record<string, TranscriptCursor> = {};
  const previousCursors = runtime?.cursors ?? {};

  for (const file of selectedFiles) {
    const fileName = path.basename(file.filePath);
    let lines: string[];
    let nextSize = previousCursors[fileName]?.size ?? 0;
    try {
      const buffer = await fs.promises.readFile(file.filePath);
      const previous = previousCursors[fileName];
      const canReadIncrementally = runtime?.snapshot && previous && previous.size > 0 && previous.size <= buffer.length;
      if (canReadIncrementally) {
        const appended = buffer.subarray(previous.size).toString('utf8');
        lines = appended.split(/\r?\n/).filter((line) => line.trim());
      } else {
        lines = tailLines(buffer.toString('utf8'), TRANSCRIPT_LINE_LIMIT);
      }
      nextSize = buffer.length;
    } catch {
      continue;
    }
    nextCursors[fileName] = { size: nextSize, mtimeMs: file.mtimeMs };

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      try {
        const record = JSON.parse(line) as Record<string, unknown>;
        applyTranscriptRecord(
          record,
          file.mtimeMs,
          fileName,
          mainAgent,
          subagents,
          snapshot,
        );
      } catch {
        // Ignore malformed or partial JSONL lines while Claude is writing.
      }
    }
  }

  const recentSubagents = [...subagents.values()]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, 12);
  snapshot.agents = [mainAgent, ...recentSubagents].map((agent) => ({
    ...agent,
    elapsedMs: agent.lastSeen > 0 ? Date.now() - agent.lastSeen : undefined,
  }));
  snapshot.lastUpdated = Date.now();
  return {
    snapshot,
    runtime: {
      cursors: nextCursors,
      snapshot,
      updatedAt: Date.now(),
    },
  };
}

function normalizeSavedPrompts(value: unknown): SavedPromptEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isRecord)
    .map((item, index) => {
      const command = cleanFreeTextCore(stringField(item.command) ?? '');
      const label = cleanFreeTextCore(stringField(item.label) ?? command.split(' ')[0] ?? '');
      if (!command.startsWith('/warnyin:')) {
        return undefined;
      }
      return {
        id: stringField(item.id) ?? `prompt-${index}-${Date.now()}`,
        label: label.slice(0, 80) || command.split(' ')[0],
        command,
        updatedAt: typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt)
          ? item.updatedAt
          : Date.now(),
      };
    })
    .filter((item): item is SavedPromptEntry => Boolean(item))
    .slice(0, SAVED_PROMPTS_LIMIT);
}

function applyTranscriptRecord(
  record: Record<string, unknown>,
  fallbackTime: number,
  source: string,
  mainAgent: AgentSnapshot,
  subagents: Map<string, AgentSnapshot>,
  snapshot: TranscriptSnapshot,
): void {
  const recordTime = readRecordTime(record, fallbackTime);
  const type = stringField(record.type);
  mainAgent.source = source;

  if (type === 'user') {
    const text = extractText(record.message) || extractText(record.content);
    const command = text.match(/\/warnyin:([a-z-]+)/i);
    if (command) {
      snapshot.latestCommand = `/warnyin:${command[1]}`;
      snapshot.currentStage = commandToStage(command[1]);
      mainAgent.status = 'thinking';
      mainAgent.activity = snapshot.latestCommand;
      mainAgent.stage = snapshot.currentStage;
      mainAgent.source = source;
      mainAgent.lastSeen = recordTime;
    }

    const toolResults = [
      ...extractToolResults(record.message),
      ...extractToolResults(record.content),
    ];
    if (toolResults.length > 0) {
      for (const result of toolResults) {
        const agent = subagents.get(result.toolUseId);
        if (agent) {
          agent.status = result.isError ? 'failed' : 'complete';
          agent.activity = result.isError ? 'Failed' : 'Completed';
          agent.lastSeen = recordTime;
        }
      }
      if (toolResults.some((result) => result.isError)) {
        mainAgent.status = 'failed';
        mainAgent.activity = 'Tool failed';
        mainAgent.lastSeen = recordTime;
      }
    }
    return;
  }

  if (type === 'assistant') {
    const usage = readTokenUsage(record.message);
    addTokenUsage(snapshot.tokenUsage, usage);
    mainAgent.tokenUsage = addTokenUsageCopy(mainAgent.tokenUsage, usage);
    const blocks = extractContentBlocks(record.message) || extractContentBlocks(record.content);
    if (!blocks) {
      return;
    }

    let sawTool = false;
    for (const block of blocks) {
      if (block.type !== 'tool_use') {
        continue;
      }
      sawTool = true;
      const toolId = stringField(block.id) || `tool-${recordTime}-${subagents.size}`;
      const toolName = stringField(block.name) || 'Tool';
      const input = isRecord(block.input) ? block.input : {};
      const activity = formatToolStatus(toolName, input);
      mainAgent.status = toolName === 'AskUserQuestion' ? 'blocked' : 'running';
      mainAgent.activity = activity;
      mainAgent.toolName = toolName;
      mainAgent.lastSeen = recordTime;

      if (toolName === 'Task' || toolName === 'Agent') {
        const name = subagentName(input, subagents.size + 1);
        const role = inferRole(name, input);
        subagents.set(toolId, {
          id: toolId,
          name,
          role,
          kind: 'subagent',
          status: 'running',
          activity,
          stage: snapshot.currentStage,
          toolName,
          source,
          parentToolId: toolId,
          lastSeen: recordTime,
        });
      }
    }
    if (!sawTool && blocks.some((block) => block.type === 'text')) {
      mainAgent.status = 'thinking';
      mainAgent.activity = 'Responding';
      mainAgent.lastSeen = recordTime;
    }
    return;
  }

  if (type === 'progress') {
    const parentToolId = stringField(record.parentToolUseID);
    if (!parentToolId) {
      return;
    }
    const agent = subagents.get(parentToolId);
    if (!agent) {
      return;
    }
    const nestedActivity = extractNestedToolActivity(record.data);
    if (nestedActivity) {
      agent.status = 'running';
      agent.activity = nestedActivity;
      agent.lastSeen = recordTime;
    }
    return;
  }

  if (type === 'system' && stringField(record.subtype) === 'turn_duration') {
    mainAgent.status = 'waiting';
    mainAgent.activity = 'Waiting';
    mainAgent.lastSeen = recordTime;
  }
}

function emptyTranscript(enabled: boolean): TranscriptSnapshot {
  return {
    enabled,
    sessionCount: 0,
    tokenUsage: emptyTokenUsage(),
    lastUpdated: Date.now(),
    agents: [createMainAgent(0)],
  };
}

function cloneTranscriptSnapshot(snapshot: TranscriptSnapshot): TranscriptSnapshot {
  return {
    ...snapshot,
    tokenUsage: cloneTokenUsage(snapshot.tokenUsage),
    agents: snapshot.agents.map(cloneAgent),
  };
}

function cloneAgent(agent: AgentSnapshot): AgentSnapshot {
  return {
    ...agent,
    tokenUsage: agent.tokenUsage ? cloneTokenUsage(agent.tokenUsage) : undefined,
  };
}

function emptyTokenUsage(): TokenUsage {
  return {
    input: 0,
    output: 0,
    cacheCreation: 0,
    cacheRead: 0,
  };
}

function cloneTokenUsage(usage: TokenUsage): TokenUsage {
  return {
    input: usage.input,
    output: usage.output,
    cacheCreation: usage.cacheCreation,
    cacheRead: usage.cacheRead,
  };
}

function createMainAgent(lastSeen: number): AgentSnapshot {
  return {
    id: 'main',
    name: 'You',
    role: 'Main Controller',
    kind: 'main',
    status: lastSeen > 0 ? 'waiting' : 'offline',
    activity: lastSeen > 0 ? 'Waiting' : 'No Claude session',
    tokenUsage: emptyTokenUsage(),
    lastSeen,
  };
}

function buildRoleBench(stage: StageId | undefined, topic?: TopicState): AgentSnapshot[] {
  const now = Date.now();
  const rolesByStage: Record<StageId, Array<{ name: string; role: string }>> = {
    discovery: [
      { name: 'BA Lens', role: 'Business Analyst' },
      { name: 'PO Lens', role: 'Product Owner' },
    ],
    design: [
      { name: 'SA Review', role: 'Solution Architect' },
      { name: 'Tech Lead', role: 'Tech Lead' },
      { name: 'QA Review', role: 'QA' },
      { name: 'Security', role: 'Security' },
      { name: 'Infra', role: 'Infra' },
    ],
    build: Array.from({ length: Math.max(1, Math.min(topic?.taskCount ?? 3, 6)) }, (_, index) => ({
      name: `Dev ${index + 1}`,
      role: 'Developer',
    })),
    verify: [
      { name: 'Strategy QA', role: 'QA' },
      { name: 'Fix Agent', role: 'Developer' },
    ],
    ship: [
      { name: 'Promoter', role: 'Tech Lead' },
      { name: 'Release Infra', role: 'Infra' },
    ],
  };

  const selectedStage = stage ?? topic?.activeStage ?? 'discovery';
  return rolesByStage[selectedStage].map((agent, index) => ({
    id: `role-${selectedStage}-${index}`,
    name: agent.name,
    role: agent.role,
    kind: 'role',
    status: 'waiting',
    activity: 'Standby',
    stage: selectedStage,
    lastSeen: now,
  }));
}

function commandToStage(command: string): CommandStageId | undefined {
  const normalized = command.toLowerCase();
  if (isStageId(normalized)) {
    return normalized;
  }
  if (normalized === 'init') {
    return 'init';
  }
  if (normalized === 'update-codemaps') {
    return 'codemap';
  }
  if (normalized === 'install-skill') {
    return 'skill';
  }
  if (normalized === 'explore') {
    return 'explore';
  }
  if (normalized === 'next') {
    return 'next';
  }
  return undefined;
}

function isStageId(value: unknown): value is StageId {
  return typeof value === 'string' && STAGES.some((stage) => stage.id === value);
}

function describeLayoutImport(rawLayout: unknown, normalized: OfficeLayout): {
  message: string;
  detail: string;
  hasWarnings: boolean;
} {
  const raw = isRecord(rawLayout) ? rawLayout : {};
  const rawSeats = Array.isArray(raw.seats) ? raw.seats.length : 0;
  const rawFurniture = Array.isArray(raw.furniture) ? raw.furniture.length : 0;
  const droppedFurniture = Math.max(0, rawFurniture - normalized.furniture.length);
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : normalized.name;
  const warnings: string[] = [];
  if (!isRecord(rawLayout) || raw.version !== 1) {
    warnings.push('Layout version was missing or unsupported, so defaults will be used where needed.');
  }
  if (rawSeats !== normalized.seats.length) {
    warnings.push(`Expected ${normalized.seats.length} seats; imported coordinates were matched to known seat ids.`);
  }
  if (droppedFurniture > 0) {
    warnings.push(`${droppedFurniture} furniture item(s) had unknown kind or invalid shape and will be skipped.`);
  }

  return {
    message: `Import "${name}" layout?`,
    detail: [
      `Seats: ${normalized.seats.length} active (${rawSeats} in file)`,
      `Furniture: ${normalized.furniture.length} active (${rawFurniture} in file)`,
      warnings.length > 0 ? `Warnings: ${warnings.join(' ')}` : 'No normalization warnings.',
    ].join('\n'),
    hasWarnings: warnings.length > 0,
  };
}

function officeLayoutStateKey(workspacePath: string): string {
  return `${OFFICE_LAYOUT_STATE_PREFIX}${normalizeProjectPath(workspacePath)}`;
}

function customOfficePresetsStateKey(workspacePath: string): string {
  return `${CUSTOM_OFFICE_PRESETS_STATE_PREFIX}${normalizeProjectPath(workspacePath)}`;
}

function rolePaletteStateKey(workspacePath: string): string {
  return `${ROLE_PALETTE_STATE_PREFIX}${normalizeProjectPath(workspacePath)}`;
}

function commandHistoryStateKey(workspacePath: string): string {
  return `${COMMAND_HISTORY_STATE_PREFIX}${normalizeProjectPath(workspacePath)}`;
}

function savedPromptsStateKey(workspacePath: string): string {
  return `${SAVED_PROMPTS_STATE_PREFIX}${normalizeProjectPath(workspacePath)}`;
}

function transcriptRuntimeStateKey(workspacePath: string): string {
  return `${TRANSCRIPT_RUNTIME_STATE_PREFIX}${normalizeProjectPath(workspacePath)}`;
}

function installedVersionStateKey(workspacePath: string): string {
  return `${INSTALLED_VERSION_STATE_PREFIX}${normalizeProjectPath(workspacePath)}`;
}

/**
 * Fetch the `latest` dist-tag version of an npm package from the public registry.
 * Resolves to the version string, or undefined when the response is malformed.
 * Rejects on network/timeout/non-200 so callers can treat it as an offline state.
 */
function fetchLatestNpmVersion(packageName: string): Promise<string | undefined> {
  const url = `https://registry.npmjs.org/${packageName}/latest`;
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { accept: 'application/vnd.npm.install-v1+json', 'user-agent': 'warnyin-agents-extension' } },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`Registry responded with status ${status}`));
          return;
        }
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
          if (raw.length > 1_000_000) {
            request.destroy(new Error('Registry response too large'));
          }
        });
        response.on('end', () => {
          try {
            const parsed = JSON.parse(raw) as { version?: unknown };
            resolve(typeof parsed.version === 'string' ? parsed.version : undefined);
          } catch {
            reject(new Error('Could not parse registry response'));
          }
        });
      },
    );
    request.setTimeout(LATEST_VERSION_FETCH_TIMEOUT_MS, () => {
      request.destroy(new Error('Registry request timed out'));
    });
    request.on('error', reject);
  });
}

function resolveClaudeProjectDir(workspacePath: string): string | undefined {
  const projectsRoot = path.join(os.homedir(), '.claude', 'projects');
  const normalized = normalizeProjectPath(workspacePath);
  const expected = path.join(projectsRoot, normalized);
  if (fs.existsSync(expected)) {
    return expected;
  }
  try {
    if (fs.existsSync(projectsRoot)) {
      const lower = normalized.toLowerCase();
      const match = fs.readdirSync(projectsRoot).find((name) => name.toLowerCase() === lower);
      if (match) {
        return path.join(projectsRoot, match);
      }
    }
  } catch {
    return expected;
  }
  return expected;
}

function normalizeProjectPath(absPath: string): string {
  return absPath.replace(/[^a-zA-Z0-9-]/g, '-');
}

function customPresetId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `custom-${slug || 'layout'}-${hashText(name)}`;
}

function hashText(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function formatToolStatus(toolName: string, input: Record<string, unknown>): string {
  const base = (value: unknown) => (typeof value === 'string' ? path.basename(value) : '');
  switch (toolName) {
    case 'Read':
      return `Reading ${base(input.file_path)}`;
    case 'Edit':
      return `Editing ${base(input.file_path)}`;
    case 'Write':
      return `Writing ${base(input.file_path)}`;
    case 'Bash': {
      const command = typeof input.command === 'string' ? input.command : '';
      return command ? `Running ${truncate(command, 56)}` : 'Running shell command';
    }
    case 'Glob':
      return 'Scanning files';
    case 'Grep':
      return 'Searching code';
    case 'WebFetch':
      return 'Fetching web content';
    case 'WebSearch':
      return 'Searching web';
    case 'Task':
    case 'Agent': {
      const description = typeof input.description === 'string' ? input.description : '';
      return description ? `Sub-agent: ${truncate(description, 64)}` : 'Running sub-agent';
    }
    case 'AskUserQuestion':
      return 'Waiting for input';
    case 'EnterPlanMode':
      return 'Planning';
    default:
      return `Using ${toolName}`;
  }
}

function subagentName(input: Record<string, unknown>, fallbackIndex: number): string {
  const typedName =
    stringField(input.subagent_type) ||
    stringField(input.agent_type) ||
    stringField(input.agentName) ||
    stringField(input.name);
  if (typedName) {
    return titleCase(typedName.replace(/^warnyin[-_]/i, '').replace(/[-_]+/g, ' '));
  }
  const description = stringField(input.description);
  return description ? truncate(description, 26) : `Sub-agent ${fallbackIndex}`;
}

function inferRole(name: string, input: Record<string, unknown>): string {
  const text = `${name} ${stringField(input.description) ?? ''} ${stringField(input.prompt) ?? ''}`.toLowerCase();
  if (text.includes('security')) {
    return 'Security';
  }
  if (text.includes('infra') || text.includes('deploy')) {
    return 'Infra';
  }
  if (text.includes('qa') || text.includes('test') || text.includes('verify')) {
    return 'QA';
  }
  if (text.includes('tech') || text.includes('lead')) {
    return 'Tech Lead';
  }
  if (text.includes('sa') || text.includes('architect')) {
    return 'Solution Architect';
  }
  if (text.includes('ba') || text.includes('business')) {
    return 'Business Analyst';
  }
  if (text.includes('po') || text.includes('product')) {
    return 'Product Owner';
  }
  return 'Developer';
}

function extractNestedToolActivity(data: unknown): string | undefined {
  if (!isRecord(data)) {
    return undefined;
  }
  const message = isRecord(data.message) ? data.message : undefined;
  const innerMessage = isRecord(message?.message) ? message.message : undefined;
  const blocks = extractContentBlocks(innerMessage);
  if (!blocks) {
    return undefined;
  }
  for (const block of blocks) {
    if (block.type === 'tool_use') {
      const toolName = stringField(block.name) || 'Tool';
      const input = isRecord(block.input) ? block.input : {};
      return formatToolStatus(toolName, input);
    }
  }
  return undefined;
}

function extractContentBlocks(value: unknown): Array<Record<string, unknown>> | undefined {
  const content = isRecord(value) ? value.content : value;
  if (!Array.isArray(content)) {
    return undefined;
  }
  return content.filter(isRecord);
}

function extractToolResults(value: unknown): Array<{ toolUseId: string; isError: boolean }> {
  const blocks = extractContentBlocks(value);
  if (!blocks) {
    return [];
  }
  return blocks
    .filter((block) => block.type === 'tool_result' && typeof block.tool_use_id === 'string')
    .map((block) => ({
      toolUseId: block.tool_use_id as string,
      isError: block.is_error === true,
    }));
}

function extractText(value: unknown): string {
  const content = isRecord(value) ? value.content : value;
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .filter(isRecord)
    .map((block) => stringField(block.text) ?? '')
    .join('\n');
}

function readRecordTime(record: Record<string, unknown>, fallbackTime: number): number {
  const timestamp = stringField(record.timestamp) || stringField(record.created_at);
  if (timestamp) {
    const parsed = Date.parse(timestamp);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallbackTime || Date.now();
}

function readTokenUsage(value: unknown): Partial<TokenUsage> {
  const usage = isRecord(value) && isRecord(value.usage) ? value.usage : undefined;
  if (!usage) {
    return {};
  }
  return {
    input: numberField(usage.input_tokens),
    output: numberField(usage.output_tokens),
    cacheCreation: numberField(usage.cache_creation_input_tokens),
    cacheRead: numberField(usage.cache_read_input_tokens),
  };
}

function addTokenUsage(total: TokenUsage, next: Partial<TokenUsage>): void {
  total.input += next.input ?? 0;
  total.output += next.output ?? 0;
  total.cacheCreation += next.cacheCreation ?? 0;
  total.cacheRead += next.cacheRead ?? 0;
}

function addTokenUsageCopy(total: TokenUsage | undefined, next: Partial<TokenUsage>): TokenUsage {
  const result = total ? cloneTokenUsage(total) : emptyTokenUsage();
  addTokenUsage(result, next);
  return result;
}

function numberField(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function tailLines(content: string, limit: number): string[] {
  const lines = content.split(/\r?\n/);
  return lines.length > limit ? lines.slice(lines.length - limit) : lines;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function statIfExists(filePath: string): Promise<fs.Stats | undefined> {
  try {
    return await fs.promises.stat(filePath);
  } catch {
    return undefined;
  }
}

async function countDirectories(directoryPath: string): Promise<number> {
  try {
    const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).length;
  } catch {
    return 0;
  }
}

async function countFilesByName(directoryPath: string, fileName: string): Promise<number> {
  try {
    const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      const child = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        count += await countFilesByName(child, fileName);
      } else if (entry.isFile() && entry.name === fileName) {
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

async function findFilesByName(directoryPath: string, fileName: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const child = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...await findFilesByName(child, fileName));
      } else if (entry.isFile() && entry.name === fileName) {
        files.push(child);
      }
    }
    return files;
  } catch {
    return [];
  }
}

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function getNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let index = 0; index < 32; index++) {
    result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return result;
}
