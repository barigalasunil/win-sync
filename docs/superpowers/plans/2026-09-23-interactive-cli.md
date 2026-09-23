# Interactive CLI (Tables + Prompts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `win-sync backup` and `win-sync restore` pause after scanning to show cli-table3 summary tables and ask the user what to do via inquirer@8 list prompts with letter-labeled shortcuts, instead of immediately dumping/installing.

**Architecture:** A new shared CommonJS module `src/ui.js` owns all table rendering (cli-table3) and prompting (inquirer@8). `src/backup.js` and `src/restore.js` keep their scanning/install logic and call the shared helpers. Pure row/payload builders (`buildSummaryRows`, `buildBackupPayload`) are separated from I/O so they can be unit-tested with Node's built-in test runner.

**Tech Stack:** Node.js 18+ (CommonJS), commander, chalk@4, ora@5, cli-progress, cli-table3, inquirer@8, `node:test` built-in runner.

## Global Constraints

- Project is `"type": "commonjs"` — every file uses `require`, never `import`.
- `inquirer` must be pinned to **v8** (`^8.2.6`) to avoid ESM issues; same reason chalk is `^4.1.2` and ora is `^5.4.1`. Never upgrade to inquirer v9+.
- Exact shortcut labels in prompts: `(B) Backup`, `(S) Save Managed Only`, `(D) Discard` for backup; `(P) Proceed`, `(C) Cancel` for restore.
- Exact prompt messages: `What would you like to do with this setup?` (backup), `Ready to restore your setup. How would you like to proceed?` (restore).
- Summary table columns are always `Category | Count | Status` with rows in order: Winget Apps, NPM Globals, PIP Packages, Manual Apps.
- Status copy (verbatim): `✅ Ready to backup` / `⚠️ Needs re-download` (backup); `✅ Ready to install` / `⚠️ Will not be installed` (restore).
- Preserve behavior choices: `S` (Save Managed Only) writes `manual_apps: []`; `B` writes `manual_apps: [manualApps]`; `D` writes nothing.
- Tests use Node's built-in `node:test` / `node:assert/strict` — **add no new test dependency** (project requires Node 18+, which ships `node:test`).
- README updates are out of scope for this plan.
- Do not change scan logic, spinner logic, install loop, or progress bar — only add tables/prompts around them.

---

### Task 1: Dependencies + Repo Init

**Files:**
- Modify: `package.json`
- Create: `.gitignore`
- Create: (git repo init at `D:\win-sync`)

**Interfaces:**
- Consumes: nothing.
- Produces: `cli-table3`, `inquirer@8` installed in `node_modules`; `npm test` script available for later tasks.

- [ ] **Step 1: Add dependencies and test script to `package.json`**

Change the `scripts` block and the `dependencies` block to exactly:

```json
{
  "name": "win-sync",
  "version": "1.0.0",
  "description": "CLI tool to backup and restore Windows development environment (Winget, NPM, PIP)",
  "main": "index.js",
  "bin": {
    "win-sync": "./index.js"
  },
  "scripts": {
    "test": "node --test"
  },
  "keywords": [
    "windows",
    "backup",
    "restore",
    "winget",
    "npm",
    "pip",
    "cli"
  ],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "chalk": "^4.1.2",
    "cli-progress": "^3.12.0",
    "cli-table3": "^0.6.5",
    "commander": "^15.0.0",
    "inquirer": "^8.2.6",
    "ora": "^5.4.1"
  }
}
```

- [ ] **Step 2: Install the new dependencies**

Run: `npm install`
Expected: completes without error; `package-lock.json` updates.

- [ ] **Step 3: Verify inquirer is v8 (not v9 ESM) and cli-table3 loaded**

Run: `npm ls inquirer cli-table3`
Expected:
```
win-sync@1.0.0 D:\win-sync
+-- cli-table3@0.6.x
`-- inquirer@8.2.x
```
(fails loudly if inquirer resolves to 9.x).

- [ ] **Step 4: Create `.gitignore`**

```gitignore
node_modules/
*.log
```

- [ ] **Step 5: Initialize git repo and commit the existing project + spec**

```bash
git init
git add .
git commit -m "chore: win-sync with interactive CLI spec"
```
Expected: repo created, one commit. (Skip this step and all later commit steps if the user declined a git repo.)

---

### Task 2: Shared UI helper module (`src/ui.js`) with tests

**Files:**
- Create: `src/ui.js`
- Create: `test/ui.test.js`

**Interfaces:**
- Consumes: `cli-table3`, `inquirer@8`, `chalk` (installed in Task 1).
- Produces (exact signatures later tasks rely on):
  - `buildSummaryRows({ winget, npm, pip, manual }, kind)` → `[{ label, count, status }]`, `kind` is `'backup'` or `'restore'`.
  - `printSummaryTable(rows)` → prints table, returns `undefined`.
  - `printManualAppsTable(apps)` → prints table, returns `undefined`.
  - `promptChoice(message, choices)` → `Promise<string | null>`; `choices` is `[{ name, value }]`; resolves selected `value`, or `null` on Ctrl+C/quit.

- [ ] **Step 1: Write the failing tests**

Create `test/ui.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSummaryRows } = require('../src/ui');

test('buildSummaryRows returns 4 rows in spec order with backup counts', () => {
  const rows = buildSummaryRows({ winget: 48, npm: 15, pip: 71, manual: 0 }, 'backup');
  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map(r => r.label),
    ['Winget Apps', 'NPM Globals', 'PIP Packages', 'Manual Apps']
  );
  assert.deepEqual(rows.map(r => r.count), [48, 15, 71, 0]);
});

test('buildSummaryRows uses backup status copy', () => {
  const rows = buildSummaryRows({ winget: 1, npm: 0, pip: 0, manual: 2 }, 'backup');
  assert.match(rows[0].status, /✅ Ready to backup/);
  assert.match(rows[3].status, /⚠️ Needs re-download/);
});

test('buildSummaryRows uses restore status copy', () => {
  const rows = buildSummaryRows({ winget: 1, npm: 0, pip: 0, manual: 2 }, 'restore');
  assert.match(rows[0].status, /✅ Ready to install/);
  assert.match(rows[3].status, /⚠️ Will not be installed/);
});

test('buildSummaryRows defaults omitted counts to 0', () => {
  const rows = buildSummaryRows({}, 'backup');
  assert.deepEqual(rows.map(r => r.count), [0, 0, 0, 0]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/ui'` (module not created yet).

- [ ] **Step 3: Create `src/ui.js`**

```js
const Table = require('cli-table3');
const chalk = require('chalk');
const inquirer = require('inquirer');

function buildSummaryRows({ winget = 0, npm = 0, pip = 0, manual = 0 } = {}, kind) {
  const isRestore = kind === 'restore';
  const ready = isRestore ? chalk.green('✅ Ready to install') : chalk.green('✅ Ready to backup');
  const manualStatus = isRestore ? chalk.yellow('⚠️ Will not be installed') : chalk.yellow('⚠️ Needs re-download');
  return [
    { label: 'Winget Apps', count: winget, status: ready },
    { label: 'NPM Globals', count: npm, status: ready },
    { label: 'PIP Packages', count: pip, status: ready },
    { label: 'Manual Apps', count: manual, status: manualStatus }
  ];
}

function printSummaryTable(rows) {
  const table = new Table({
    head: [chalk.bold('Category'), chalk.bold('Count'), chalk.bold('Status')],
    colWidths: [18, 8, 32]
  });
  rows.forEach(row => table.push([row.label, row.count, row.status]));
  console.log(table.toString());
}

function printManualAppsTable(apps) {
  const table = new Table({
    head: [chalk.bold('App'), chalk.bold('Version'), chalk.bold('Publisher')],
    colWidths: [40, 12, 28]
  });
  apps.forEach(app => table.push([app.name, app.version, app.publisher]));
  console.log(table.toString());
}

async function promptChoice(message, choices) {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message,
        choices: choices.map(c => ({ name: c.name, value: c.value }))
      }
    ]);
    return answers.choice;
  } catch (error) {
    return null;
  }
}

module.exports = { buildSummaryRows, printSummaryTable, printManualAppsTable, promptChoice };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 4 tests pass, `# fail 0`, exit code 0.

- [ ] **Step 5: Syntax check**

Run: `node --check src/ui.js`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/ui.js test/ui.test.js
git commit -m "feat: add shared ui helpers for summary tables and prompts"
```

---

### Task 3: Backup payload builder + tests

**Files:**
- Modify: `src/backup.js` (add one exported pure function; no behavior change yet)
- Create: `test/backup.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `buildBackupPayload(data, includeManual)` → object written to `win-sync-setup.json`. `data` is `{ winget: string[], npm: string[], pip: { name, version }[], manualApps: [{ name, version, publisher }] }`, `includeManual` is boolean. Result has keys `winget`, `npm`, `pip`, `manual_apps`, `exportedAt`.

- [ ] **Step 1: Write the failing tests**

Create `test/backup.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBackupPayload } = require('../src/backup');

test('buildBackupPayload keeps manual_apps when includeManual is true', () => {
  const data = {
    winget: ['Git.Git'],
    npm: ['typescript'],
    pip: [{ name: 'requests', version: '2.31.0' }],
    manualApps: [{ name: 'SomeApp', version: '1.0.0', publisher: 'SomePublisher' }]
  };
  const payload = buildBackupPayload(data, true);
  assert.equal(payload.winget.length, 1);
  assert.equal(payload.npm.length, 1);
  assert.equal(payload.pip.length, 1);
  assert.deepEqual(payload.manual_apps, data.manualApps);
  assert.ok(typeof payload.exportedAt === 'string');
});

test('buildBackupPayload discards manual_apps when includeManual is false', () => {
  const data = {
    winget: ['Git.Git'],
    npm: [],
    pip: [],
    manualApps: [{ name: 'SomeApp', version: '1.0.0', publisher: 'SomePublisher' }]
  };
  const payload = buildBackupPayload(data, false);
  assert.deepEqual(payload.manual_apps, []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/backup.js` does not export `buildBackupPayload` (TypeError: buildBackupPayload is not a function).

- [ ] **Step 3: Add the builder to `src/backup.js`**

Add this function above `async function runBackup() {`:

```js
function buildBackupPayload(data, includeManual) {
  return {
    winget: data.winget,
    npm: data.npm,
    pip: data.pip,
    manual_apps: includeManual ? data.manualApps : [],
    exportedAt: new Date().toISOString()
  };
}
```

And change the final export line from `module.exports = { runBackup };` to:

```js
module.exports = { runBackup, buildBackupPayload };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 6 tests total (4 from Task 2 + 2 new), `# fail 0`.

- [ ] **Step 5: Syntax check**

Run: `node --check src/backup.js`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/backup.js test/backup.test.js
git commit -m "feat: add buildBackupPayload helper with tests"
```

---

### Task 4: Make `runBackup()` interactive (summary table + manual detail + prompt)

**Files:**
- Modify: `src/backup.js` (import UI helpers; replace the write-file tail of `runBackup()`)

**Interfaces:**
- Consumes (from Task 2): `buildSummaryRows`, `printSummaryTable`, `printManualAppsTable`, `promptChoice`. Consumes (from Task 3): `buildBackupPayload`.
- Produces: `win-sync backup` no longer writes JSON immediately; it prints tables and waits for B/S/D selection. No exported signatures change.

- [ ] **Step 1: Add the UI import at the top of `src/backup.js`**

Add after the existing `const { runCommand } = require('./utils');` line:

```js
const { buildSummaryRows, printSummaryTable, printManualAppsTable, promptChoice } = require('./ui');
```

- [ ] **Step 2: Replace the write-file tail with the interactive flow**

Find this block (from `const backupData = {` through the closing of the manual-apps reminder, just before `}` that ends `runBackup`):

```js
  const backupData = {
    winget: wingetPackages,
    npm: npmPackages,
    pip: pipPackages,
    manual_apps: manualApps,
    exportedAt: new Date().toISOString()
  };

  fs.writeFileSync('win-sync-setup.json', JSON.stringify(backupData, null, 2));
  console.log(chalk.green('\n✓ Backup saved to win-sync-setup.json'));

  if (manualApps.length > 0) {
    console.log(chalk.bold.red('\n⚠  MANUAL APPS DETECTED - These are NOT in Winget and must be downloaded manually:'));
    manualApps.forEach(app => {
      console.log(chalk.red(`  - ${app.name} (v${app.version}) by ${app.publisher}`));
    });
    console.log(chalk.yellow('\nPlease download and install these manually after restore.'));
  }
}
```

Replace it entirely with:

```js
  console.log(chalk.bold('\nScan complete — here\'s what was found:\n'));
  printSummaryTable(buildSummaryRows({
    winget: wingetPackages.length,
    npm: npmPackages.length,
    pip: pipPackages.length,
    manual: manualApps.length
  }, 'backup'));

  if (manualApps.length > 0) {
    console.log(chalk.bold('\nManual apps — must be downloaded after restore:\n'));
    printManualAppsTable(manualApps);
  }

  const action = await promptChoice('What would you like to do with this setup?', [
    { name: chalk.green('  (B) Backup'), value: 'backup' },
    { name: chalk.cyan('  (S) Save Managed Only'), value: 'managed' },
    { name: chalk.yellow('  (D) Discard'), value: 'discard' }
  ]);

  if (action === null || action === 'discard') {
    console.log(chalk.yellow('\n🚫 Discarded — nothing was saved.'));
    return;
  }

  const includeManual = action === 'backup';
  const payload = buildBackupPayload({
    winget: wingetPackages,
    npm: npmPackages,
    pip: pipPackages,
    manualApps
  }, includeManual);

  fs.writeFileSync('win-sync-setup.json', JSON.stringify(payload, null, 2));
  console.log(chalk.green('\n✓ Backup saved to win-sync-setup.json'));

  if (includeManual && manualApps.length > 0) {
    console.log(chalk.bold.red('\n⚠  MANUAL APPS DETECTED - These are NOT in Winget and must be downloaded manually.'));
    console.log(chalk.yellow('Please download and install these manually after restore.'));
  }
}
```

- [ ] **Step 3: Syntax check**

Run: `node --check src/backup.js`
Expected: no output (exit 0).

- [ ] **Step 4: Unit tests still green**

Run: `npm test`
Expected: PASS — `# fail 0`.

- [ ] **Step 5: Manual smoke test — Discard path**

Run: `node index.js backup`
Expected in order: four `ora` spinners succeed; a 4-row `Category | Count | Status` summary table; (if manual apps found) a second `App | Version | Publisher` table; prompt `What would you like to do with this setup?` listing `(B) Backup`, `(S) Save Managed Only`, `(D) Discard`. Select `(D) Discard`, press Enter.
Expected final line: yellow `🚫 Discarded — nothing was saved.` and `win-sync-setup.json` mtime unchanged (verify with `Get-Item win-sync-setup.json | Select-Object LastWriteTime` before and after).

- [ ] **Step 6: Manual smoke test — Save Managed Only path**

Run `node index.js backup` again, select `(S) Save Managed Only`.
Expected: green `✓ Backup saved to win-sync-setup.json`. Verify JSON has empty manual list:
Run: `node -e "console.log(JSON.parse(require('fs').readFileSync('win-sync-setup.json','utf8')).manual_apps)"`
Expected: `[]`

- [ ] **Step 7: Commit**

```bash
git add src/backup.js
git commit -m "feat: pause backup after scan with summary table and B/S/D prompt"
```

---

### Task 5: Make `runRestore()` interactive (summary table + P/C prompt)

**Files:**
- Modify: `src/restore.js` (import UI helpers; add summary table + prompt between the zero-check and the progress bar)

**Interfaces:**
- Consumes (from Task 2): `buildSummaryRows`, `printSummaryTable`, `promptChoice`.
- Produces: `win-sync restore` prints a summary table and waits for P/C before starting the progress bar. Install loop below the prompt is unchanged.

- [ ] **Step 1: Add the UI import at the top of `src/restore.js`**

Add after `const { runCommand } = require('./utils');`:

```js
const { buildSummaryRows, printSummaryTable, promptChoice } = require('./ui');
```

- [ ] **Step 2: Insert the summary table and prompt before the progress bar**

Find this block:

```js
  if (totalPackages === 0) {
    console.log(chalk.yellow('No packages to restore.'));
    return;
  }

  const bar = new cliProgress.SingleBar({
```

Change it to:

```js
  if (totalPackages === 0) {
    console.log(chalk.yellow('No packages to restore.'));
    return;
  }

  console.log(chalk.bold('\nThis setup contains:\n'));
  printSummaryTable(buildSummaryRows({
    winget: data.winget?.length || 0,
    npm: data.npm?.length || 0,
    pip: data.pip?.length || 0,
    manual: data.manual_apps?.length || 0
  }, 'restore'));

  const action = await promptChoice('Ready to restore your setup. How would you like to proceed?', [
    { name: chalk.green('  (P) Proceed'), value: 'proceed' },
    { name: chalk.yellow('  (C) Cancel'), value: 'cancel' }
  ]);

  if (action !== 'proceed') {
    console.log(chalk.yellow('\n🚫 Cancelled — no changes were made.'));
    return;
  }

  const bar = new cliProgress.SingleBar({
```

- [ ] **Step 3: Syntax check**

Run: `node --check src/restore.js`
Expected: no output (exit 0).

- [ ] **Step 4: Unit tests still green**

Run: `npm test`
Expected: PASS — `# fail 0`.

- [ ] **Step 5: Manual smoke test — Cancel path**

Run: `node index.js restore`
Expected: `This setup contains:` heading, a 4-row summary table with `✅ Ready to install` / `⚠️ Will not be installed` statuses, prompt `Ready to restore your setup. How would you like to proceed?` with `(P) Proceed` and `(C) Cancel`. Select `(C) Cancel`.
Expected final line: yellow `🚫 Cancelled — no changes were made.` **No progress bar, no installs.**

- [ ] **Step 6: Commit**

```bash
git add src/restore.js
git commit -m "feat: pause restore before install with summary table and P/C prompt"
```

---

### Task 6: End-to-end verification

**Files:** none modified — verification only.

**Interfaces:**
- Consumes: Tasks 1–5 complete.
- Produces: confirmation both interactive flows work per the spec.

- [ ] **Step 1: Full test suite + syntax sweep**

Run:
```bash
npm test
node --check src/ui.js; node --check src/backup.js; node --check src/restore.js; node --check index.js
```
Expected: all tests pass (`# fail 0`), all syntax checks exit 0.

- [ ] **Step 2: Backup full-path smoke test**

Run: `node index.js backup`, select `(B) Backup`.
Expected: green `✓ Backup saved to win-sync-setup.json`, plus the yellow `MANUAL APPS DETECTED` reminder only if manual apps exist. Verify:
Run: `node -e "const d=JSON.parse(require('fs').readFileSync('win-sync-setup.json','utf8')); console.log(Object.keys(d), d.manual_apps.length)"`
Expected: `['winget', 'npm', 'pip', 'manual_apps', 'exportedAt']` then a number ≥ 0.

- [ ] **Step 3: Restore + Backup cancel paths re-confirmed**

Run `node index.js restore` → select `(C)` → expect `Cancelled — no changes were made.`
Run `node index.js backup` → select `(D)` → expect `Discarded — nothing was saved.`

- [ ] **Step 4: Report results**

Summarize: table output matches the spec's `Category | Count | Status` layout, both prompts show the letter-labeled shortcuts, S writes `manual_apps: []`, D/C write/apply nothing.