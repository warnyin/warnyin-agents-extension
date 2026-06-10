import { describe, expect, it } from 'vitest';

import {
  buildSlashCommand,
  buildWarnyinCommand,
  cleanFreeText,
  compareSemver,
  defaultOfficeLayout,
  isUpdateAvailable,
  normalizeOfficeLayout,
  normalizeRolePalette,
  parseCommandFrontmatter,
  parseSemver,
  sortWarnyinCommands,
  summarizeChecklist,
} from './domain';
import type { WarnyinCommand } from './domain';

describe('Warnyin domain helpers', () => {
  it('builds slash commands with normalized text', () => {
    expect(buildSlashCommand('init', {})).toBe('/warnyin:init');
    expect(buildSlashCommand('installSkill', { role: ' tech-lead ' })).toBe(
      '/warnyin:install-skill tech-lead',
    );
    expect(buildSlashCommand('explore', { question: '  auth risk\ncheck  ' })).toBe(
      '/warnyin:explore auth risk check',
    );
    expect(buildSlashCommand('next', {})).toBe('/warnyin:next');
    expect(buildSlashCommand('next', { slug: 'checkout-flow' })).toBe(
      '/warnyin:next checkout-flow',
    );
    expect(buildSlashCommand('discovery', { topic: '  checkout\nflow  ' })).toBe(
      '/warnyin:discovery checkout flow',
    );
    expect(buildSlashCommand('design', { slug: 'checkout-flow', change: ' add cart  ' })).toBe(
      '/warnyin:design checkout-flow add cart',
    );
  });

  it('rejects invalid slugs', () => {
    expect(() => buildSlashCommand('build', { slug: 'bad slug' })).toThrow(
      'Slug must use letters',
    );
  });

  it('normalizes free text', () => {
    expect(cleanFreeText(' one\n\n two\tthree ')).toBe('one two three');
  });

  it('normalizes office layout seats into safe canvas bounds', () => {
    const layout = defaultOfficeLayout();
    const normalized = normalizeOfficeLayout({
      ...layout,
      seats: [
        { id: 'main', x: -100, y: 999, role: 'Main Controller' },
        { id: 'slot-1', x: 500.4, y: 200.2, role: 'Developer' },
      ],
      updatedAt: 42,
    });

    expect(normalized.seats[0]).toMatchObject({ id: 'main', x: 84, y: 386 });
    expect(normalized.seats[1]).toMatchObject({ id: 'slot-1', x: 500, y: 200 });
    expect(normalized.seats).toHaveLength(layout.seats.length);
  });

  it('normalizes office furniture into safe canvas bounds', () => {
    const normalized = normalizeOfficeLayout({
      ...defaultOfficeLayout(),
      furniture: [
        { id: 'plant', kind: 'plant', x: -50, y: 900 },
        { id: 'unknown', kind: 'not-real' as never, x: 100, y: 100 },
      ],
      updatedAt: 42,
    });

    expect(normalized.furniture).toEqual([
      { id: 'plant', kind: 'plant', x: 52, y: 444 },
    ]);
  });

  it('keeps invalid palette values from overriding defaults', () => {
    const palette = normalizeRolePalette({
      version: 1,
      entries: [{
        role: 'Developer',
        shirt: 'green',
        accent: '#123456',
        skin: '#abcdef',
        hair: 'brown',
        body: 'spacesuit' as never,
        hairStyle: 'mohawk' as never,
        accessory: 'wings' as never,
      }],
      updatedAt: 1,
    });
    const developer = palette.entries.find((entry) => entry.role === 'Developer');
    expect(developer).toMatchObject({
      shirt: '#2d6f62',
      accent: '#123456',
      skin: '#abcdef',
      hair: '#5a2b18',
      body: 'classic',
      hairStyle: 'short',
      accessory: 'headset',
    });
  });

  it('summarizes markdown checklists', () => {
    expect(summarizeChecklist('- [x] done\n- [ ] todo\n* [X] also done')).toEqual({
      done: 2,
      total: 3,
    });
  });

  it('parses semver cores and ignores metadata', () => {
    expect(parseSemver('0.10.0')).toEqual([0, 10, 0]);
    expect(parseSemver('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseSemver('1.2.3-beta.1')).toEqual([1, 2, 3]);
    expect(parseSemver('not-a-version')).toBeUndefined();
    expect(parseSemver('1.2')).toBeUndefined();
  });

  it('compares semver ordering numerically, not lexically', () => {
    expect(compareSemver('0.10.0', '0.9.0')).toBe(1);
    expect(compareSemver('0.9.0', '0.10.0')).toBe(-1);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
  });

  it('flags an available update only when latest is strictly newer and both known', () => {
    expect(isUpdateAvailable('0.9.0', '0.10.0')).toBe(true);
    expect(isUpdateAvailable('0.10.0', '0.10.0')).toBe(false);
    expect(isUpdateAvailable('0.11.0', '0.10.0')).toBe(false);
    expect(isUpdateAvailable(undefined, '0.10.0')).toBe(false);
    expect(isUpdateAvailable('0.10.0', undefined)).toBe(false);
  });

  it('parses command frontmatter description and argument-hint', () => {
    const raw = [
      '---',
      'description: Run DESIGN stage',
      'argument-hint: "[slug] [change]"',
      '---',
      '',
      'body text',
    ].join('\n');
    expect(parseCommandFrontmatter(raw)).toEqual({
      description: 'Run DESIGN stage',
      argumentHint: '[slug] [change]',
    });
    expect(parseCommandFrontmatter('no frontmatter here')).toEqual({});
    expect(parseCommandFrontmatter('---\ndescription: Init only\n---\n')).toEqual({
      description: 'Init only',
    });
  });

  it('builds a command descriptor with slug and hasArgs from the file name', () => {
    expect(buildWarnyinCommand('design.md', '---\ndescription: D\nargument-hint: "[slug]"\n---\n')).toEqual({
      id: 'design',
      slug: '/warnyin:design',
      description: 'D',
      argumentHint: '[slug]',
      hasArgs: true,
    });
    const noArgs = buildWarnyinCommand('init', '---\ndescription: Init\n---\n');
    expect(noArgs.slug).toBe('/warnyin:init');
    expect(noArgs.hasArgs).toBe(false);
    expect(noArgs.argumentHint).toBeUndefined();
    const bare = buildWarnyinCommand('mystery.md', 'no frontmatter');
    expect(bare).toEqual({
      id: 'mystery',
      slug: '/warnyin:mystery',
      description: '',
      argumentHint: undefined,
      hasArgs: false,
    });
  });

  it('sorts commands by workflow order and appends unknown ones alphabetically', () => {
    const make = (id: string): WarnyinCommand => ({
      id,
      slug: `/warnyin:${id}`,
      description: '',
      hasArgs: false,
    });
    const sorted = sortWarnyinCommands([make('zeta'), make('design'), make('audit'), make('init')]);
    expect(sorted.map((command) => command.id)).toEqual(['init', 'design', 'audit', 'zeta']);
  });
});
