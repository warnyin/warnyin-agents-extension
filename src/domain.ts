export type StageId = 'discovery' | 'design' | 'build' | 'verify' | 'ship';

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

const DEFAULT_OFFICE_SEATS: OfficeSeat[] = [
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
];

const DEFAULT_ROLE_PALETTE: RolePaletteEntry[] = [
  { role: 'Main Controller', shirt: '#3e4f7d', accent: '#c28a2c', skin: '#e0b083', hair: '#4b2414', body: 'jacket', hairStyle: 'side', accessory: 'badge' },
  { role: 'Business Analyst', shirt: '#8a9a62', accent: '#c28a2c', skin: '#d8a47d', hair: '#5a2b18', body: 'classic', hairStyle: 'side', accessory: 'none' },
  { role: 'Product Owner', shirt: '#a96835', accent: '#8a9a62', skin: '#f0bf8d', hair: '#6c351d', body: 'classic', hairStyle: 'short', accessory: 'badge' },
  { role: 'Solution Architect', shirt: '#3e4f7d', accent: '#2d6f62', skin: '#c98f68', hair: '#3c2116', body: 'jacket', hairStyle: 'short', accessory: 'none' },
  { role: 'Tech Lead', shirt: '#6c351d', accent: '#3e4f7d', skin: '#d09b73', hair: '#4b2414', body: 'jacket', hairStyle: 'cap', accessory: 'headset' },
  { role: 'Developer', shirt: '#2d6f62', accent: '#8a9a62', skin: '#d09b73', hair: '#5a2b18', body: 'classic', hairStyle: 'short', accessory: 'headset' },
  { role: 'QA', shirt: '#8a9a62', accent: '#3e4f7d', skin: '#e5b489', hair: '#4b2414', body: 'apron', hairStyle: 'side', accessory: 'badge' },
  { role: 'Security', shirt: '#b65b4c', accent: '#6c351d', skin: '#c88d68', hair: '#3c2116', body: 'jacket', hairStyle: 'cap', accessory: 'badge' },
  { role: 'Infra', shirt: '#3e4f7d', accent: '#b65b4c', skin: '#d5a27b', hair: '#4b2414', body: 'apron', hairStyle: 'cap', accessory: 'headset' },
];

const DEFAULT_FURNITURE: FurnitureItem[] = [
  { id: 'f-logo-wall', kind: 'logo-wall', x: 164, y: 70 },
  { id: 'f-docs-shelf', kind: 'docs-shelf', x: 84, y: 190 },
  { id: 'f-review-table', kind: 'review-table', x: 618, y: 278 },
  { id: 'f-release-board', kind: 'release-board', x: 790, y: 70 },
  { id: 'f-plant', kind: 'plant', x: 890, y: 424 },
];

const FURNITURE_CATALOG: FurnitureCatalogItem[] = [
  { kind: 'review-table', label: 'Review Table' },
  { kind: 'build-bench', label: 'Build Bench' },
  { kind: 'qa-station', label: 'QA Station' },
  { kind: 'release-board', label: 'Release Board' },
  { kind: 'docs-shelf', label: 'Docs Shelf' },
  { kind: 'plant', label: 'Plant' },
  { kind: 'logo-wall', label: 'Logo Wall' },
];

export function buildSlashCommand(commandId: string, args: Record<string, string>): string {
  switch (commandId) {
    case 'init':
      return '/warnyin:init';
    case 'installSkill':
      return optionalArgumentCommand('/warnyin:install-skill', args.role);
    case 'updateCodemaps':
      return '/warnyin:update-codemaps';
    case 'explore':
      return optionalArgumentCommand('/warnyin:explore', args.question);
    case 'next': {
      const slug = cleanSlug(args.slug);
      return slug ? `/warnyin:next ${slug}` : '/warnyin:next';
    }
    case 'discovery': {
      const topic = cleanFreeText(args.topic);
      if (!topic) {
        throw new Error('Discovery needs a topic.');
      }
      return `/warnyin:discovery ${topic}`;
    }
    case 'design': {
      const slug = cleanSlug(args.slug);
      const change = cleanFreeText(args.change);
      if (!slug || !change) {
        throw new Error('Design needs a slug and change description.');
      }
      return `/warnyin:design ${slug} ${change}`;
    }
    case 'build':
    case 'verify':
    case 'ship': {
      const slug = cleanSlug(args.slug);
      if (!slug) {
        throw new Error(`${commandId} needs a stage slug.`);
      }
      return `/warnyin:${commandId} ${slug}`;
    }
    default:
      throw new Error(`Unknown Warnyin command: ${commandId}`);
  }
}

function optionalArgumentCommand(baseCommand: string, value: string | undefined): string {
  const argument = cleanFreeText(value);
  return argument ? `${baseCommand} ${argument}` : baseCommand;
}

export function cleanFreeText(value: string | undefined): string {
  return (value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function cleanSlug(value: string | undefined): string {
  const slug = (value ?? '').trim();
  if (!slug) {
    return '';
  }
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
    throw new Error('Slug must use letters, numbers, and hyphens only.');
  }
  return slug;
}

export function defaultOfficeLayout(): OfficeLayout {
  return {
    version: 1,
    name: 'Warnyin Paper Office',
    seats: DEFAULT_OFFICE_SEATS.map((seat) => ({ ...seat })),
    furniture: DEFAULT_FURNITURE.map((item) => ({ ...item })),
    updatedAt: 0,
  };
}

export function furnitureCatalog(): FurnitureCatalogItem[] {
  return FURNITURE_CATALOG.map((item) => ({ ...item }));
}

export function officeLayoutPresets(): OfficeLayoutPreset[] {
  const base = defaultOfficeLayout();
  return [
    {
      id: 'paper-office',
      name: 'Paper Office',
      description: 'Balanced default layout for every stage.',
      layout: base,
    },
    {
      id: 'review-panel',
      name: 'Review Panel',
      description: 'Reviewer roles near the board for DESIGN review.',
      layout: {
        ...base,
        name: 'Warnyin Review Panel',
        seats: [
          { id: 'main', x: 164, y: 276, role: 'Main Controller' },
          { id: 'slot-1', x: 420, y: 206, role: 'Solution Architect' },
          { id: 'slot-2', x: 536, y: 206, role: 'Tech Lead' },
          { id: 'slot-3', x: 652, y: 206, role: 'QA' },
          { id: 'slot-4', x: 768, y: 206, role: 'Security' },
          { id: 'slot-5', x: 884, y: 206, role: 'Infra' },
          { id: 'slot-6', x: 420, y: 354, role: 'Developer' },
          { id: 'slot-7', x: 536, y: 354, role: 'Developer' },
          { id: 'slot-8', x: 652, y: 354, role: 'Business Analyst' },
          { id: 'slot-9', x: 768, y: 354, role: 'Product Owner' },
          { id: 'slot-10', x: 884, y: 354, role: 'Reviewer' },
          { id: 'slot-11', x: 278, y: 206, role: 'Standby' },
          { id: 'slot-12', x: 278, y: 354, role: 'Standby' },
        ],
      },
    },
    {
      id: 'build-waves',
      name: 'Build Waves',
      description: 'Developer desks grouped for parallel BUILD work.',
      layout: {
        ...base,
        name: 'Warnyin Build Waves',
        seats: [
          { id: 'main', x: 156, y: 244, role: 'Main Controller' },
          { id: 'slot-1', x: 338, y: 192, role: 'Developer' },
          { id: 'slot-2', x: 480, y: 192, role: 'Developer' },
          { id: 'slot-3', x: 622, y: 192, role: 'Developer' },
          { id: 'slot-4', x: 764, y: 192, role: 'Developer' },
          { id: 'slot-5', x: 338, y: 356, role: 'Developer' },
          { id: 'slot-6', x: 480, y: 356, role: 'Developer' },
          { id: 'slot-7', x: 622, y: 356, role: 'QA' },
          { id: 'slot-8', x: 764, y: 356, role: 'Tech Lead' },
          { id: 'slot-9', x: 884, y: 274, role: 'Infra' },
          { id: 'slot-10', x: 224, y: 356, role: 'Security' },
          { id: 'slot-11', x: 224, y: 192, role: 'Solution Architect' },
          { id: 'slot-12', x: 884, y: 192, role: 'Standby' },
        ],
      },
    },
  ];
}

export function normalizeOfficeLayout(layout: OfficeLayout | undefined): OfficeLayout {
  const base = defaultOfficeLayout();
  if (!layout || layout.version !== 1 || !Array.isArray(layout.seats)) {
    return base;
  }

  const storedSeats = new Map(
    layout.seats
      .filter((seat) => typeof seat.id === 'string')
      .map((seat) => [seat.id, seat]),
  );

  return {
    version: 1,
    name: typeof layout.name === 'string' && layout.name.trim() ? layout.name.trim() : base.name,
    seats: base.seats.map((seat) => {
      const stored = storedSeats.get(seat.id);
      if (!stored) {
        return seat;
      }
      return {
        ...seat,
        x: clampCoordinate(stored.x, 84, 876, seat.x),
        y: clampCoordinate(stored.y, 178, 386, seat.y),
        role: typeof stored.role === 'string' && stored.role.trim() ? stored.role.trim() : seat.role,
      };
    }),
    furniture: normalizeFurniture(layout.furniture),
    updatedAt: Number.isFinite(layout.updatedAt) ? layout.updatedAt : Date.now(),
  };
}

export function defaultRolePalette(): RolePalette {
  return {
    version: 1,
    entries: DEFAULT_ROLE_PALETTE.map((entry) => ({ ...entry })),
    updatedAt: 0,
  };
}

export function normalizeRolePalette(palette: RolePalette | undefined): RolePalette {
  const base = defaultRolePalette();
  if (!palette || palette.version !== 1 || !Array.isArray(palette.entries)) {
    return base;
  }
  const stored = new Map(
    palette.entries
      .filter((entry) => typeof entry.role === 'string')
      .map((entry) => [entry.role, entry]),
  );
  return {
    version: 1,
    entries: base.entries.map((entry) => {
      const override = stored.get(entry.role);
      if (!override) {
        return entry;
      }
      return {
        role: entry.role,
        shirt: isHexColor(override.shirt) ? override.shirt : entry.shirt,
        accent: isHexColor(override.accent) ? override.accent : entry.accent,
        skin: isHexColor(override.skin) ? override.skin : entry.skin,
        hair: isHexColor(override.hair) ? override.hair : entry.hair,
        body: isCharacterBody(override.body) ? override.body : entry.body,
        hairStyle: isCharacterHairStyle(override.hairStyle) ? override.hairStyle : entry.hairStyle,
        accessory: isCharacterAccessory(override.accessory) ? override.accessory : entry.accessory,
      };
    }),
    updatedAt: Number.isFinite(palette.updatedAt) ? palette.updatedAt : Date.now(),
  };
}

export function summarizeChecklist(markdown: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\s*[-*]\s+\[([ xX])\]/);
    if (!match) {
      continue;
    }
    total++;
    if (match[1].toLowerCase() === 'x') {
      done++;
    }
  }
  return { done, total };
}

function clampCoordinate(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(value), min), max);
}

function normalizeFurniture(value: unknown): FurnitureItem[] {
  if (!Array.isArray(value)) {
    return DEFAULT_FURNITURE.map((item) => ({ ...item }));
  }
  const knownKinds = new Set(FURNITURE_CATALOG.map((item) => item.kind));
  return value
    .filter((item): item is FurnitureItem => {
      return (
        typeof item === 'object' &&
        item !== null &&
        typeof (item as FurnitureItem).id === 'string' &&
        knownKinds.has((item as FurnitureItem).kind)
      );
    })
    .slice(0, 48)
    .map((item, index) => ({
      id: item.id.trim() || `furniture-${index}`,
      kind: item.kind,
      x: clampCoordinate(item.x, 52, 908, 240),
      y: clampCoordinate(item.y, 52, 444, 260),
    }));
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function isCharacterBody(value: unknown): value is CharacterBody {
  return value === 'classic' || value === 'jacket' || value === 'apron';
}

function isCharacterHairStyle(value: unknown): value is CharacterHairStyle {
  return value === 'short' || value === 'side' || value === 'cap';
}

function isCharacterAccessory(value: unknown): value is CharacterAccessory {
  return value === 'none' || value === 'badge' || value === 'headset';
}

export interface WarnyinVersionInfo {
  packageName: string;
  installed?: string;
  latest?: string;
  updateAvailable: boolean;
  checkedAt: number;
  offline: boolean;
}

/**
 * Parse a `major.minor.patch` semver core into a numeric tuple.
 * Ignores any pre-release/build metadata suffix. Returns undefined for
 * values that do not start with a numeric `x.y.z` core.
 */
export function parseSemver(value: string): [number, number, number] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const core = value.trim().replace(/^v/i, '').split(/[-+]/, 1)[0];
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(core);
  if (!match) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Compare two semver strings. Returns 1 when `a` is newer, -1 when `b` is
 * newer, and 0 when equal. Unparseable inputs fall back to a stable string
 * comparison so the result is always deterministic.
 */
export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) {
    if (a === b) {
      return 0;
    }
    return a < b ? -1 : 1;
  }
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) {
      return left[index] < right[index] ? -1 : 1;
    }
  }
  return 0;
}

/**
 * True when `latest` is strictly newer than `installed`. Missing values
 * (unknown installed or latest) never report an update.
 */
export function isUpdateAvailable(installed: string | undefined, latest: string | undefined): boolean {
  if (!installed || !latest) {
    return false;
  }
  return compareSemver(latest, installed) > 0;
}

export interface WarnyinCommand {
  id: string;
  slug: string;
  description: string;
  argumentHint?: string;
  hasArgs: boolean;
}

/**
 * Canonical workflow order. Commands not listed here are unknown to this
 * extension build (e.g. added by a newer @warnyin/agents release) and are
 * appended alphabetically so they still surface as buttons automatically.
 */
const WARNYIN_COMMAND_ORDER: readonly string[] = [
  'init',
  'discovery',
  'design',
  'build',
  'verify',
  'ship',
  'next',
  'explore',
  'install-skill',
  'update-codemaps',
];

/**
 * Parse the leading YAML-style frontmatter block of a command markdown file.
 * Recognizes the `description` and `argument-hint` keys, stripping a single
 * layer of matching surrounding quotes. Returns empty fields when no
 * frontmatter block is present.
 */
export function parseCommandFrontmatter(raw: string): { description?: string; argumentHint?: string } {
  if (typeof raw !== 'string') {
    return {};
  }
  const text = raw.replace(/^﻿/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) {
    return {};
  }
  const result: { description?: string; argumentHint?: string } = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!pair) {
      continue;
    }
    const key = pair[1].toLowerCase();
    const value = stripMatchingQuotes(pair[2].trim());
    if (key === 'description') {
      result.description = value;
    } else if (key === 'argument-hint') {
      result.argumentHint = value;
    }
  }
  return result;
}

function stripMatchingQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * Build a WarnyinCommand descriptor from a command file name (with or without
 * the `.md` extension) and its raw markdown contents. The command id is the
 * file's base name, the slug is the `/warnyin:<id>` invocation, and `hasArgs`
 * reflects whether the frontmatter declares an argument hint.
 */
export function buildWarnyinCommand(fileName: string, raw: string): WarnyinCommand {
  const id = fileName.replace(/\.md$/i, '').trim();
  const front = parseCommandFrontmatter(raw);
  const argumentHint = front.argumentHint?.trim() ? front.argumentHint.trim() : undefined;
  return {
    id,
    slug: `/warnyin:${id}`,
    description: front.description?.trim() ?? '',
    argumentHint,
    hasArgs: Boolean(argumentHint),
  };
}

/**
 * Sort commands by the canonical workflow order, with any unrecognized
 * commands appended alphabetically so newly added commands still surface.
 */
export function sortWarnyinCommands(commands: readonly WarnyinCommand[]): WarnyinCommand[] {
  return [...commands].sort((a, b) => {
    const rankA = rankWarnyinCommand(a.id);
    const rankB = rankWarnyinCommand(b.id);
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function rankWarnyinCommand(id: string): number {
  const index = WARNYIN_COMMAND_ORDER.indexOf(id);
  return index === -1 ? WARNYIN_COMMAND_ORDER.length : index;
}
