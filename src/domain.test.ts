import { describe, expect, it } from 'vitest';

import {
  buildSlashCommand,
  cleanFreeText,
  defaultOfficeLayout,
  normalizeOfficeLayout,
  normalizeRolePalette,
  summarizeChecklist,
} from './domain';

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
});
