# win-sync Interactive CLI — Design

**Date:** 2026-09-23
**Status:** Approved

## Goal

Make the `win-sync` CLI interactive: show scan results in beautiful terminal
tables, pause for confirmation, and let the user decide what happens via
keyboard-friendly prompts — instead of dumping a JSON file immediately.

## Decisions

- **Shortcut behavior:** Stylized `list` prompt with letter labels (e.g.
  `(B) Backup`). Inquirer@8's native `list` uses arrow keys + Enter; the letter
  is shorthand in the label. No custom raw keypress handler.
- **Structure:** Shared UI helper module `src/ui.js` used by both
  `src/backup.js` and `src/restore.js` (matches existing shared `src/utils.js`
  pattern).

## 1. Dependencies

Add to `package.json` and `npm install`:

- `cli-table3` — ASCII terminal tables.
- `inquirer@^8.2.6` — interactive prompts (v8 pinned to avoid ESM issues,
  same as chalk@4 / ora@5).

Project remains CommonJS (`"type": "commonjs"`). No other dependency changes.

## 2. New file: `src/ui.js` (shared helper)

CommonJS module exporting two functions:

### `printSummaryTable(rows)`

- Takes `rows: [{ label, count, status }]` (status values include chalk styling
  and emoji).
- Builds and prints a `cli-table3` table with columns `Category | Count | Status`.
- Single import point for `cli-table3` and the table style, so the manual-apps
  detail table (Step C below) can reuse it.

### `promptChoice(message, choices)`

- Generic inquirer `list` wrapper. `choices` are
  `[{ name: '(B) Backup — ...', value: 'backup' }]`.
- Returns the selected choice's `value`.
- Wraps inquirer in one place; Ctrl+C / cancel surfaces as a caught signal so
  callers can exit gracefully (yellow "Cancelled" message) instead of crashing.

## 3. `src/backup.js` — interactive scanner

`runBackup()` steps:

- **A (unchanged):** Existing `ora` spinners scan Winget, NPM, PIP, and Manual
  apps.
- **B (Summary Table):** After scanning, print a summary table:
  `Winget Apps | <n> | ✅ Ready to backup`
  `NPM Globals | <n> | ✅ Ready to backup`
  `PIP Packages | <n> | ✅ Ready to backup`
  `Manual Apps | <n> | ⚠️ Needs re-download`
- **C (Manual detail):** If `manual_apps.length > 0`, print a second table
  listing the manual app names (name, version, publisher — preserving the
  information shown today in the post-save list).
- **D (Prompt):** Ask *"What would you like to do with this setup?"* with:
  - `(B) Backup` → save everything.
  - `(S) Save Managed Only` → save Winget/NPM/PIP only (drop `manual_apps`).
  - `(D) Discard` → exit without saving.
- **E (Execute):**
  - B: write full JSON including `manual_apps`; green `✓ Backup saved`.
  - S: write JSON with `manual_apps: []`; green `✓ Backup saved`.
  - D: yellow `Discarded` message; no file write.

The existing "manual apps must be downloaded manually" reminder prints only when
the saved file actually contains them (choice B).

## 4. `src/restore.js` — interactive installer

`runRestore()` steps:

- **A (unchanged):** Read + parse `win-sync-setup.json`; keep the missing-file
  guard and the zero-package early return.
- **B (Summary Table):** Print what will be installed:
  `Winget Apps | <n> | ✅ Ready to install`
  `NPM Globals | <n> | ✅ Ready to install`
  `PIP Packages | <n> | ✅ Ready to install`
  plus `Manual Apps | <n> | ⚠️ Will not be installed` when present.
- **C (Prompt):** Ask *"Ready to restore your setup. How would you like to
  proceed?"* with:
  - `(P) Proceed` — install everything.
  - `(C) Cancel` — exit without installing.
- **D (Execute):**
  - P: existing `cli-progress` bar + install loops unchanged.
  - C: yellow "Cancelled — no changes made", graceful return.

## 5. Error handling & edge cases

- No `process.exit` added. Cancels / Ctrl+C are caught and map to a yellow
  message + `return` (no partial writes).
- Restore with zero installable packages prints `No packages to restore.` and
  returns before any table or prompt.
- Backup with zero manual apps skips the manual detail table (section C).

## Out of scope

- `[S] Select categories` option in restore (deferred).
- README updates (follow-up, not part of this change).
- Native single-keypress handling (decision above).