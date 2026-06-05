# Full Pixel Agents Parity Roadmap

This roadmap tracks the path from the Warnyin Agents MVP to a full pixel office experience inspired by `pixel-agents-hq/pixel-agents`, while keeping Warnyin workflow files as the source of truth.

## Current MVP Target

- VS Code extension with a Warnyin activity view.
- React webview with Warnyin Paper Office theme.
- Locked state when `warnyin/workflow` and `.claude/commands/warnyin` are missing.
- Installer actions:
  - `npx @warnyin/agents`
  - `npx @warnyin/agents --dry-run`
  - `npx @warnyin/agents --update`
- Dedicated `Warnyin Agents` terminal.
- Command forms for:
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
- Stage detection from `warnyin/stages/<slug>/`.
- Claude Code transcript scan for workspace-local `.jsonl` sessions.
- Dark isometric pixel office canvas with one controllable, walkable main agent and rendered sub-agents/role bench.
- Workspace-scoped persistent seat layout with edit, save, reset, and export actions.
- Layout import with preview, built-in and user-created named presets, furniture placement/deletion, multi-select movement, undo/redo, keyboard shortcuts, and per-role character palette/body/hair/accessory persistence.
- Workflow intelligence summary from local Warnyin stage artifacts, including dependency graph edges, verify gates, fix counts, and ship archive target.
- Command previews, validation hints, saved prompts, command history, and raw Warnyin slash command replay.
- Active and archived slug visibility.
- Main-agent focus, read-only sub-agent detail interaction, speech bubbles, transcript source, elapsed time, persisted session state, failed tool status, and token usage.
- Unit tests for core domain helpers and Playwright smoke test for webview/canvas rendering.
- `.vsix` packaging script and release metadata.

## Parity Milestones

### 1. Persistent Pixel Office Layout

- Status: parity implemented for current Warnyin contract.
- Saves office seat layout in VS Code `globalState`, scoped by workspace path.
- Uses a default Warnyin Paper Office layout.
- Supports reset-to-default and export layout commands.
- Stores desk positions per role:
  - Main Controller
  - BA
  - PO
  - SA
  - Tech Lead
  - Developer
  - QA
  - Security
  - Infra

Custom preset parity:
- Users can save the current layout as a workspace-scoped custom preset.
- Users can apply built-in and custom presets from the same picker.
- Users can delete custom presets while built-in presets remain protected.

### 2. Layout Editor

Status: parity implemented for current Warnyin contract.

- Implemented edit mode with toolbar actions:
  - Explicit select/move mode
  - Move seats by dragging
  - Place furniture
  - Move furniture by dragging
  - Delete selected furniture
  - Undo / redo
  - Reset
  - Save
- Keeps grid-aligned movement.
- Prevents seats from moving outside safe canvas bounds.
- Adds keyboard shortcuts:
  - Delete / Backspace for selected furniture
  - Escape to clear placement/selection
  - Ctrl/Cmd+Z and Ctrl/Cmd+Y for undo/redo
  - Ctrl/Cmd+S to save
- Supports Shift-click multi-select across seats and furniture.
- Supports bulk movement of selected seats/furniture with grid-aligned dragging.

### 3. Pixel Asset System

Status: parity implemented for current Warnyin contract.

- Added Warnyin-specific character palettes and per-role body/hair/accessory customization.
- Added a manifest-backed furniture catalog with procedural fallback rendering:
  - desks
  - review table
  - build benches
  - QA test station
  - release board
  - docs bookshelf
  - yarn-ball logo wall mark
- Added speech bubbles for active/blocked agents.

Optional extension hook:
- External asset directory loading is deferred until Warnyin needs third-party asset packs with a stable manifest contract.

### 4. Rich Claude Transcript Runtime

Status: parity implemented for observable Claude Code JSONL contract.

- Status now renders core tool lifecycle heuristics:
  - start
  - progress
  - waiting for input / permission-like state
  - done
  - failed
- Rendered sub-agent lifecycle from `Task` and `Agent` tool calls.
- Shows transcript source, parent tool id, elapsed time, failed tool-result state, persisted snapshot state, file cursors, and token usage.

Claude/Warnyin contract-dependent follow-up:
- Correlate terminal session id with transcript id when Claude Code exposes a stable contract.
- Detect background agents beyond JSONL `Task` / `Agent` records when Claude Code exposes explicit background lifecycle events.

### 5. Warnyin Workflow Intelligence

- Status: parity implemented for current Warnyin artifact format.
- Parses stage artifacts for richer status:
  - gate checklist completion
  - task counts
  - task dependency graph edges
  - passed/failed/pending task status from task markdown
  - issue count
  - build wave hints from design/build markdown
  - verify gate completion
  - verify fix count
  - ship archive target
- Renders stage-specific office overlays for:
  - DESIGN review panel
  - BUILD waves
  - VERIFY tester loop
  - SHIP archive/promotion activity

Warnyin contract-dependent follow-up:
- Replace heuristics with explicit Warnyin machine-readable metadata if the workflow later emits it.

### 6. Command Palette Enhancements

- Status: parity implemented for current Warnyin command contract.
- Added command history.
- Added raw slash command input/replay.
- Added command preview before send.
- Added validation hints before send.
- Added saved prompts with import/export.
- Added complete Warnyin slash command coverage for:
  - init
  - install-skill with optional role
  - update-codemaps
  - explore
  - next
  - discovery
  - design
  - build
  - verify
  - ship
- Added recent active slugs and archived slug visibility.

Warnyin contract-dependent follow-up:
- Add validation from local Warnyin files beyond slug/input shape.
- Add command-specific prompt variables if Warnyin workflow adds a prompt variable contract.

### 7. Agent Interaction Model

- Status: parity implemented for current Warnyin control contract.
- Keeps only the main agent controllable.
- Allows clicking the main agent to focus the Warnyin terminal.
- Allows clicking sub-agents for read-only detail:
  - current tool
  - role
  - current activity
  - parent tool id
  - transcript source
  - elapsed time

Warnyin contract-dependent follow-up:
- Add parent task display when Warnyin emits a stable parent task id.
- Do not expose direct control buttons for sub-agents unless Warnyin workflow adds an explicit control contract.

### 8. Notifications And Sound

- Status: parity implemented for current Warnyin contract.
- Added optional VS Code notification for blocked, failed, or input-needed states.
- Added optional webview sound cues controlled by `warnyinAgents.soundCues`:
  - command sent
  - blocked or failed agent attention
  - verify passed
  - ship ready
- Notifications remain controlled by `warnyinAgents.notifyOnBlocked`.

### 9. Testing And QA

- Status: implemented for release smoke and core domain coverage.
- Unit test:
  - slash command construction
  - layout normalization
  - furniture normalization
  - palette/style validation
  - checklist parsing
- Playwright smoke:
  - webview shell rendered
  - canvas visible
  - nonblank pixels
  - multiple colors rendered
  - layout editor controls enabled in edit mode

QA hardening follow-up:
- Unit test:
  - Warnyin install detection
  - slug discovery
  - stage status calculation
  - transcript parsing
- VS Code Extension Host smoke test for actual activity-view integration.

### 10. Packaging

- Status: implemented.
- Added production bundle pipeline.
- Added `.vsix` packaging with `vsce`.
- Added release notes and changelog.
- Added license file.
- Added marketplace metadata.
- Added Playwright smoke test script.

Marketplace polish follow-up:
- Add icon variants if the activity bar needs a monochrome asset.

## Non-Goals Until Contract Exists

- Directly controlling sub-agents outside Claude Code/Warnyin workflow.
- Mutating Warnyin workflow files silently.
- Replacing Claude Code orchestration with a custom orchestrator.
- Running build waves from the extension without going through `/warnyin:build`.

## Design Constraints

- Theme stays anchored to the Warnyin logo:
  - paper cream
  - cocoa brown
  - copper accents
  - sage, teal, indigo, amber, and rose for state signals
- UI remains operational and dense enough for repeated use.
- Cards are limited to repeated items and framed tool areas.
- Pixel office remains a primary working surface, not a marketing hero.
