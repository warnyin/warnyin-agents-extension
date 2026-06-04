# Warnyin Agents Extension

Pixel command center for the Warnyin Standard Workflow and Claude Code agents.

## Features

- Locks the command UI when Warnyin is not installed in the current workspace.
- Runs installer commands in a terminal:
  - `npx @warnyin/agents`
  - `npx @warnyin/agents --dry-run`
  - `npx @warnyin/agents --update`
- Opens a dedicated `Warnyin Agents` terminal for Claude Code.
- Sends every current Warnyin slash command through short forms:
  - `/warnyin:init`
  - `/warnyin:install-skill [role]`
  - `/warnyin:update-codemaps`
  - `/warnyin:explore [question]`
  - `/warnyin:next [slug]`
  - `/warnyin:discovery <topic>`
  - `/warnyin:design <slug> <change>`
  - `/warnyin:build <slug>`
  - `/warnyin:verify <slug>`
  - `/warnyin:ship <slug>`
- Detects stage slugs from `warnyin/stages/*`.
- Detects archived topics from `warnyin/stages/achieved/*`.
- Scans workspace-local Claude Code transcripts in `~/.claude/projects/*`.
- Renders a Warnyin Paper Office pixel canvas with the main controller and sub-agents.
- Uses manifest-backed pixel furniture assets with procedural fallbacks.
- Persists office seat and furniture layout per workspace with edit, save, reset, import, and export actions.
- Supports layout import, built-in presets, user-created custom presets, and per-role character palette/body/hair/accessory persistence.
- Supports furniture placement, multi-select seat/furniture movement, deletion, undo/redo, import preview, layout keyboard shortcuts, and Warnyin-themed office fixtures.
- Shows workflow intelligence from local Warnyin artifacts: gates, task counts, dependency graph edges, issues, build wave hints, verify status, fix counts, and ship archive target.
- Shows stage-specific pixel activity overlays for DESIGN, BUILD, VERIFY, and SHIP.
- Shows live transcript details: tool, stage, transcript source, elapsed time, speech bubbles, persisted session state, token usage, blocked state, and failed tool/sub-agent state.
- Keeps command history and supports raw `/warnyin:*` command replay.
- Supports saved prompts with import/export.
- Validates command form inputs before sending slash commands to the terminal.
- Lets the main pixel agent focus the terminal and sub-agents open read-only details.
- Offers optional webview sound cues through `warnyinAgents.soundCues`.
- Runs unit tests and Playwright webview smoke tests for nonblank canvas rendering.

## Development

```bash
npm install
npm run check
npm run smoke:webview
npm run package:vsix
```

`npm run check` runs unit tests, webview typecheck, webview production build, and extension TypeScript compile.
`npm run smoke:webview` runs the Playwright webview/canvas smoke test.
`npm run package:vsix` creates `warnyin-agents-extension-0.1.0.vsix`.

To run inside VS Code:

1. Open this folder in VS Code.
2. Run the `Run Extension` debug configuration.
3. Open the `Warnyin Agents` activity view.

## Roadmap

See `docs/full-pixel-agents-parity.md`.
