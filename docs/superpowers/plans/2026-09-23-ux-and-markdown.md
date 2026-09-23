# UX Improvements and Markdown Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade win-sync with a default backup command, an ASCII-art banner, an auto-maximized terminal, clarified choice labels, and human-readable Markdown export alongside the JSON backup.

**Architecture:** New CommonJS modules `src/banner.js` (terminal maximize + banner) and `src/markdown-generator.js` (pure Markdown string builder). `index.js` adds the default command via commander's `isDefault: true` and fires banner/maximize before parse. `src/backup.js` captures a version side-channel during its existing scans (used only by Markdown) and swaps the B/S/D prompt for a B/M/A/S/D flow with dual file writes. Pure builders stay separated from I/O for `node:test`.

**Tech Stack:** Node.js 18+ (CommonJS), commander@15, chalk@4, inquirer@8, `node:test` built-in runner.

## Global Constraints

- Project is `"type": "commonjs"` — every file uses `require`, never `import`.
- Dependencies are pinned: chalk `^4.1.2`, inquirer `^8.2.6`, ora `^5.4.1`, commander `^15.0.0`. Do not add new runtime dependencies. Do not upgrade inquirer to v9+.
- Tests use Node's built-in `node:test` / `node:assert/strict`. Add no new test dependency.
- Backup prompt message stays `What would you like to do with this setup?`. Option labels (verbatim, in order): `(B) Backup (JSON)`, `(M) Save as Markdown only`, `(A) Save as Both (JSON + Markdown)`, `(S) Save Auto-Restorable Only (exclude manual apps)`, `(D) Discard and exit`.
- JSON schema is unchanged: keys `winget`, `npm`, `pip`, `manual_apps`, `exportedAt`. Versions for winget/npm live ONLY in a side-channel map passed to the Markdown generator.
- Files written to `process.cwd()` with fixed names `win-sync-setup.json` and `win-sync-setup.md`.
- Success messages with absolute paths: `✓ JSON saved to: <cwd>\win-sync-setup.json`, `✓ Markdown saved to: <cwd>\win-sync-setup.md`.
- Banner text is the hardcoded `win-sync` ASCII art below; rendered cyan via chalk.
- Maximize uses Win32 `ShowWindow(hwnd, 3)` via PowerShell `GetConsoleWindow()`; win32 only; failures silently caught.
- Markdown contains literal ✅/⚠️ Unicode and NO ANSI color codes. Markdown table cells escape `|`, backtick, and newlines.
- Markdown header `**Total Packages:**` = winget + npm + pip + shown-manual counts.
- README updates are in scope (Task 6).

---

### Task 1: Banner module (`src/banner.js`) with tests

**Files:**
- Create: `src/banner.js`
- Create: `test/banner.test.js`

**Interfaces:**
- Consumes: `chalk`, `child_process.execFileSync` (both already available; no `npm install` needed).
- Produces (exact names later tasks rely on):
  - `maximizeTerminal()` — no return; focuses the console window to full screen on win32; never throws.
  - `printBanner()` — no return; prints the cyan banner art + tagline + blank line to stdout.
  - `buildBannerText()` — returns the raw (uncolored) banner art string, `BANNER_LINES` joined with `\n`.

- [ ] **Step 1: Write the failing tests**

Create `test/banner.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBannerText, maximizeTerminal, printBanner } = require('../src/banner');

test('buildBannerText returns the win-sync ASCII art', () => {
  const text = buildBannerText();
  assert.match(text, /_    _           _   _____ _ _/);
  assert.equal(text.split('\n').length, 6);
  assert.ok(text.includes('\\'), 'art must contain backslash strokes');
});

test('maximizeTerminal does not throw', () => {
  maximizeTerminal();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/banner'`.

- [ ] **Step 3: Create `src/banner.js`**

```js
const chalk = require('chalk');
const { execFileSync } = require('child_process');

const BANNER_LINES = [
  ' _    _           _   _____ _ _     ',
  '| |  | |         | | /  ___(_) |    ',
  '| |  | | ___  ___| | \\ `--. _| |_   ',
  '| |/\\| |/ _ \\/ __| |  `--. \\ | __|  ',
  '\\  /\\  /  __/\\__ \\_| /\\__/ / | |_    ',
  ' \\/  \\/ \\___||___(_) \\____/|_|\\__|   '
];

function buildBannerText() {
  return BANNER_LINES.join('\n');
}

function printBanner() {
  console.log(chalk.cyan(buildBannerText()));
  console.log(chalk.dim('Windows Development Environment Backup & Restore'));
  console.log('');
}

function maximizeTerminal() {
  if (process.platform !== 'win32') return;
  try {
    execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive',
      '-Command',
      "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class W{[DllImport(\"kernel32.dll\")]public static extern IntPtr GetConsoleWindow();[DllImport(\"user32.dll\")]public static extern bool ShowWindow(IntPtr h,int c);}'; $h=[W]::GetConsoleWindow(); [W]::ShowWindow($h,3) | Out-Null"
    ], { stdio: 'ignore', windowsHide: true });
  } catch (error) {
    // best-effort; never crash the tool
  }
}

module.exports = { maximizeTerminal, printBanner, buildBannerText };
```

Note: the art rows use `\\` in JS strings to produce a literal `\`. Row 3 contains an actual backtick character (`` `--. ``) — valid inside a single-quoted string.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. The `maximizeTerminal does not throw` test passes silently on CI/non-tty (the powerShell call is best-effort and caught).

- [ ] **Step 5: Syntax check**

Run: `node --check src/banner.js`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/banner.js test/banner.test.js
git commit -m "feat: add banner and terminal maximize module"
```

---

### Task 2: Markdown generator (`src/markdown-generator.js`) with tests

**Files:**
- Create: `src/markdown-generator.js`
- Create: `test/markdown-generator.test.js`

**Interfaces:**
- Consumes: nothing (pure module, no requires).
- Produces (exact signature Task 5 relies on):
  - `generateMarkdown(payload, { versions = {}, includeManualApps = true } = {})` → `string`.
    - `payload` shape: `{ winget: string[], npm: string[], pip: [{ name, version }], manual_apps: [{ name, version, publisher }] }`.
    - `versions` shape: `{ winget: { [packageId]: version }, npm: { [name]: version } }` (the side channel from Task 3).
    - Returns a Markdown document per the spec layout; always renders the Summary table (4 rows, counts ≥ 0) and every category heading (`## Winget Apps (N packages)` etc.), with `No packages found.` under an empty category heading; manual section omitted when `includeManualApps` is false.

- [ ] **Step 1: Write the failing tests**

Create `test/markdown-generator.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateMarkdown } = require('../src/markdown-generator');

const basePayload = {
  winget: ['Git.Git', 'Microsoft.VSCode'],
  npm: ['typescript', 'nodemon'],
  pip: [{ name: 'requests', version: '2.31.0' }],
  manual_apps: [{ name: 'SomeApp', version: '1.0.0', publisher: 'SomePublisher' }]
};

test('full backup renders all four sections and summary counts', () => {
  const md = generateMarkdown(basePayload, {
    versions: { winget: { 'Git.Git': '2.43.0' }, npm: { typescript: '5.3.2' } }
  });
  assert.match(md, /# Windows Development Setup Backup/);
  assert.match(md, /## Summary/);
  assert.match(md, /## Winget Apps \(2 packages\)/);
  assert.match(md, /## NPM Global Packages \(2 packages\)/);
  assert.match(md, /## PIP Packages \(1 packages\)/);
  assert.match(md, /## Manual Apps/);
  assert.match(md, /\*Generated by win-sync CLI tool\*/);
});

test('includeManualApps false omits manual section and shows 0', () => {
  const md = generateMarkdown(basePayload, { includeManualApps: false });
  assert.doesNotMatch(md, /## Manual Apps/);
  assert.match(md, /\| Manual Apps \| 0 \| Excluded from backup \|/);
});

test('winget and npm versions come from versions map with em-dash fallback', () => {
  const md = generateMarkdown(basePayload, {
    versions: {
      winget: { 'Git.Git': '2.43.0' },
      npm: { typescript: '5.3.2' }
    }
  });
  assert.match(md, /\| Git\.Git \| 2\.43\.0 \|/);
  assert.match(md, /\| Microsoft\.VSCode \| — \|/);
  assert.match(md, /\| typescript \| 5\.3\.2 \|/);
  assert.match(md, /\| nodemon \| — \|/);
});

test('pip versions come from payload', () => {
  const md = generateMarkdown(basePayload, {});
  assert.match(md, /\| requests \| 2\.31\.0 \|/);
});

test('a pipe in a package name is escaped and does not break the table', () => {
  const payload = {
    winget: ['Weird|Name'],
    npm: [],
    pip: [],
    manual_apps: []
  };
  const md = generateMarkdown(payload, {});
  assert.match(md, /\| Weird\\\|Name \| — \|/);
});

test('empty categories still render summary row with 0 and a placeholder line', () => {
  const md = generateMarkdown({ winget: [], npm: [], pip: [], manual_apps: [] }, {});
  assert.match(md, /\| Winget Apps \| 0 \| ✅ Auto-restorable \|/);
  assert.match(md, /## Winget Apps \(0 packages\)/);
  assert.match(md, /No packages found\./);
});

test('no ANSI escape codes in markdown output', () => {
  const md = generateMarkdown(basePayload, {});
  assert.doesNotMatch(md, /\u001b\[[0-9;]*m/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/markdown-generator'`.

- [ ] **Step 3: Create `src/markdown-generator.js`**

```js
function escapeTableCell(value) {
  return String(value)
    .replace(/\|/g, '\\|')
    .replace(/`/g, '\\`')
    .replace(/\r?\n/g, ' ');
}

function generateMarkdown(payload, { versions = {}, includeManualApps = true } = {}) {
  const winget = payload.winget || [];
  const npm = payload.npm || [];
  const pip = payload.pip || [];
  const manual = payload.manual_apps || [];

  const shownManual = includeManualApps ? manual.length : 0;
  const total = winget.length + npm.length + pip.length + shownManual;
  const hr = '---';

  const lines = [];
  lines.push('# Windows Development Setup Backup');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toLocaleString()} **Total Packages:** ${total}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Category | Count | Status |');
  lines.push('|----------|-------|--------|');
  lines.push(`| Winget Apps | ${winget.length} | ✅ Auto-restorable |`);
  lines.push(`| NPM Globals | ${npm.length} | ✅ Auto-restorable |`);
  lines.push(`| PIP Packages | ${pip.length} | ✅ Auto-restorable |`);
  lines.push(`| Manual Apps | ${shownManual} | ${includeManualApps ? '⚠️ Requires manual download' : 'Excluded from backup'} |`);
  lines.push('');
  lines.push(hr);
  lines.push('');

  lines.push(`## Winget Apps (${winget.length} packages)`);
  lines.push('');
  if (winget.length === 0) {
    lines.push('No packages found.');
  } else {
    lines.push('| Package Name | Version |');
    lines.push('|--------------|---------|');
    winget.forEach(id => {
      const version = versions.winget ? versions.winget[id] : undefined;
      lines.push(`| ${escapeTableCell(id)} | ${escapeTableCell(version || '—')} |`);
    });
  }
  lines.push('');
  lines.push(hr);
  lines.push('');

  lines.push(`## NPM Global Packages (${npm.length} packages)`);
  lines.push('');
  if (npm.length === 0) {
    lines.push('No packages found.');
  } else {
    lines.push('| Package | Version |');
    lines.push('|---------|---------|');
    npm.forEach(name => {
      const version = versions.npm ? versions.npm[name] : undefined;
      lines.push(`| ${escapeTableCell(name)} | ${escapeTableCell(version || '—')} |`);
    });
  }
  lines.push('');
  lines.push(hr);
  lines.push('');

  lines.push(`## PIP Packages (${pip.length} packages)`);
  lines.push('');
  if (pip.length === 0) {
    lines.push('No packages found.');
  } else {
    lines.push('| Package | Version |');
    lines.push('|---------|---------|');
    pip.forEach(pkg => {
      lines.push(`| ${escapeTableCell(pkg.name)} | ${escapeTableCell(pkg.version)} |`);
    });
  }
  lines.push('');
  lines.push(hr);
  lines.push('');

  if (includeManualApps) {
    lines.push('## Manual Apps');
    lines.push('');
    lines.push('⚠️ **Warning:** These apps are not in Winget and must be downloaded manually.');
    lines.push('');
    if (manual.length === 0) {
      lines.push('No manual apps found!');
    } else {
      lines.push('| Name | Version | Publisher |');
      lines.push('|------|---------|-----------|');
      manual.forEach(app => {
        lines.push(`| ${escapeTableCell(app.name)} | ${escapeTableCell(app.version)} | ${escapeTableCell(app.publisher)} |`);
      });
    }
    lines.push('');
    lines.push(hr);
    lines.push('');
  }

  lines.push('*Generated by win-sync CLI tool*');
  return lines.join('\n') + '\n';
}

module.exports = { generateMarkdown };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — markdown-generator tests all pass, `# fail 0` (banner tests also pass).

- [ ] **Step 5: Syntax check**

Run: `node --check src/markdown-generator.js`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/markdown-generator.js test/markdown-generator.test.js
git commit -m "feat: add markdown generator with tests"
```

---

### Task 3: Version side-channel builders (`src/backup.js`) with tests

**Files:**
- Modify: `src/backup.js` (add two exported pure functions; no behavior change yet)
- Modify: `test/backup.test.js` (add tests)

**Interfaces:**
- Consumes: nothing new.
- Produces (exact names Task 5 relies on):
  - `buildWingetVersions(packages)` → `{ [packageId]: version }`. Input is the flat array of winget-export package entries (each `{ PackageIdentifier, Version }`). Entries without a `Version` are skipped; non-array input yields `{}`.
  - `buildNpmVersions(dependencies)` → `{ [name]: version }`. Input is the `dependencies` object from `npm list --depth=0 --json`. The `npm` entry is skipped; missing `version` skipped; nullish input yields `{}`.

- [ ] **Step 1: Write the failing tests**

Change the first line of `test/backup.test.js` from:

```js
const { buildBackupPayload } = require('../src/backup');
```

to:

```js
const { buildBackupPayload, buildWingetVersions, buildNpmVersions } = require('../src/backup');
```

Then append to `test/backup.test.js`:

```js
test('buildWingetVersions maps package ids to versions', () => {
  const entries = [
    { PackageIdentifier: 'Git.Git', Version: '2.43.0' },
    { PackageIdentifier: 'Microsoft.VSCode', Version: '1.85.0' },
    { PackageIdentifier: 'NoVersion' }
  ];
  const result = buildWingetVersions(entries);
  assert.equal(result['Git.Git'], '2.43.0');
  assert.equal(result['Microsoft.VSCode'], '1.85.0');
  assert.equal(result['NoVersion'], undefined);
});

test('buildWingetVersions tolerates non-array input', () => {
  assert.deepEqual(buildWingetVersions(null), {});
});

test('buildNpmVersions maps names to versions and skips npm', () => {
  const deps = {
    typescript: { version: '5.3.2' },
    npm: { version: '10.0.0' },
    nodemon: { version: '3.0.2', other: 'x' }
  };
  const result = buildNpmVersions(deps);
  assert.equal(result.typescript, '5.3.2');
  assert.equal(result.nodemon, '3.0.2');
  assert.equal(result.npm, undefined);
});

test('buildNpmVersions tolerates nullish input and missing versions', () => {
  assert.deepEqual(buildNpmVersions(null), {});
  assert.deepEqual(buildNpmVersions({ a: {}, b: null }), {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `TypeError: (0 , _backup.buildWingetVersions) is not a function` (exports not added yet).

- [ ] **Step 3: Add the builders to `src/backup.js`**

Add above `async function runBackup() {`:

```js
function buildWingetVersions(packages) {
  const versions = {};
  if (Array.isArray(packages)) {
    packages.forEach(pkg => {
      if (pkg.PackageIdentifier && pkg.Version) {
        versions[pkg.PackageIdentifier] = pkg.Version;
      }
    });
  }
  return versions;
}

function buildNpmVersions(dependencies) {
  const versions = {};
  if (dependencies && typeof dependencies === 'object') {
    Object.keys(dependencies).forEach(name => {
      const dep = dependencies[name];
      if (name !== 'npm' && dep && dep.version) {
        versions[name] = dep.version;
      }
    });
  }
  return versions;
}
```

Change the final export line:

```js
module.exports = { runBackup, buildBackupPayload, buildWingetVersions, buildNpmVersions };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all prior tests plus the 5 new ones pass, `# fail 0`.

- [ ] **Step 5: Syntax check**

Run: `node --check src/backup.js`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/backup.js test/backup.test.js
git commit -m "feat: add version side-channel builders with tests"
```

---

### Task 4: Wire default command + banner + maximize (`index.js`)

**Files:**
- Modify: `index.js`

**Interfaces:**
- Consumes (Task 1): `maximizeTerminal`, `printBanner` from `src/banner`; `runBackup`/`runRestore` (existing).
- Produces: `win-sync` (no subcommand) runs the same backup action as `win-sync backup`; banner + maximize run once before parse for every invocation; `--help`/`--version` still handled by commander.

- [ ] **Step 1: Update `index.js`**

Replace the whole file with:

```js
#!/usr/bin/env node

const { program } = require('commander');
const { runBackup } = require('./src/backup');
const { runRestore } = require('./src/restore');
const { maximizeTerminal, printBanner } = require('./src/banner');

program
  .name('win-sync')
  .version('1.0.0')
  .description('CLI tool to backup and restore Windows development environment (Winget, NPM, PIP)');

program
  .command('backup', { isDefault: true })
  .description('Scan machine for installed apps and save to JSON or Markdown')
  .action(async () => {
    await runBackup();
  });

program
  .command('restore')
  .description('Install packages from backup JSON')
  .action(async () => {
    await runRestore();
  });

maximizeTerminal();
printBanner();

program.parse(process.argv);
```

Note: `{ isDefault: true }` makes commander run the `backup` action when no subcommand is given, while still letting `--help`/`--version` work.

- [ ] **Step 2: Syntax check**

Run: `node --check index.js`
Expected: no output (exit 0).

- [ ] **Step 3: Smoke test — `--help` prints banner then help (no backup scan)**

Run: `node index.js --help`
Expected: cyan `win-sync` ASCII art + tagline printed first, then commander help text (name, description, `backup`, `restore`). Process exits without running any scan.

- [ ] **Step 4: Smoke test — no args triggers the default backup (banner first)**

Run: `node index.js`
Expected: banner art + tagline, then the backup scan starts (ora spinners appear). Cancel it (Ctrl+C) — the scan is allowed to run in Task 5's smoke tests.

- [ ] **Step 5: Commit**

```bash
git add index.js
git commit -m "feat: default backup command with banner and terminal maximize"
```

---

### Task 5: B/M/A/S/D flow with dual file writes (`src/backup.js`)

**Files:**
- Modify: `src/backup.js` (scan blocks + choice/save tail of `runBackup()`)

**Interfaces:**
- Consumes (Task 2): `generateMarkdown` from `src/markdown-generator`. Consumes (Task 3): `buildWingetVersions`, `buildNpmVersions`. Consumes (existing): `buildBackupPayload`, UI helpers, `chalk`, `fs`, `path`.
- Produces: backup prompt with options B/M/A/S/D; JSON written for B/A/S, Markdown written for M/A; success lines with absolute paths; manual-apps reminder only for JSON that includes manual apps.

- [ ] **Step 1: Add imports**

Add after the existing `const { buildSummaryRows, ... } = require('./ui');` line:

```js
const { generateMarkdown } = require('./markdown-generator');
```

- [ ] **Step 2: Collect version side channels during scans**

In `runBackup()`, change the declaration block from:

```js
  const wingetPackages = [];
  const npmPackages = [];
  const pipPackages = [];
  const manualApps = [];
```

to:

```js
  const wingetPackages = [];
  const npmPackages = [];
  const pipPackages = [];
  const manualApps = [];
  const wingetVersions = {};
  const npmVersions = {};
```

Inside the winget try block, replace:

```js
      if (data.Sources && data.Sources.length > 0) {
        data.Sources.forEach(source => {
          if (source.Packages && source.Packages.length > 0) {
            source.Packages.forEach(pkg => {
              if (pkg.PackageIdentifier) {
                wingetPackages.push(pkg.PackageIdentifier);
              }
            });
          }
        });
      }
```

with:

```js
      const wingetEntries = [];
      if (data.Sources && data.Sources.length > 0) {
        data.Sources.forEach(source => {
          if (source.Packages && source.Packages.length > 0) {
            source.Packages.forEach(pkg => {
              if (pkg.PackageIdentifier) {
                wingetEntries.push(pkg);
              }
            });
          }
        });
      }
      wingetPackages.push(...wingetEntries.map(pkg => pkg.PackageIdentifier));
      Object.assign(wingetVersions, buildWingetVersions(wingetEntries));
```

Inside the npm try block, replace:

```js
      if (data.dependencies) {
        Object.keys(data.dependencies).forEach(name => {
          if (name !== 'npm') {
            npmPackages.push(name);
          }
        });
      }
```

with:

```js
      Object.assign(npmVersions, buildNpmVersions(data.dependencies));
      if (data.dependencies) {
        Object.keys(data.dependencies).forEach(name => {
          if (name !== 'npm') {
            npmPackages.push(name);
          }
        });
      }
```

- [ ] **Step 3: Replace the choice prompt and save tail**

Find the block from `const action = await promptChoice(` through the end of `runBackup()` (the final manual-apps reminder and closing brace):

```js
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

Replace it entirely with:

```js
  const action = await promptChoice('What would you like to do with this setup?', [
    { name: chalk.green('  (B) Backup (JSON)'), value: 'json' },
    { name: chalk.cyan('  (M) Save as Markdown only'), value: 'markdown' },
    { name: chalk.magenta('  (A) Save as Both (JSON + Markdown)'), value: 'both' },
    { name: chalk.yellow('  (S) Save Auto-Restorable Only (exclude manual apps)'), value: 'managed' },
    { name: chalk.red('  (D) Discard and exit'), value: 'discard' }
  ]);

  if (action === null || action === 'discard') {
    console.log(chalk.yellow('\n🚫 Discarded — nothing was saved.'));
    return;
  }

  const wantsJson = action === 'json' || action === 'both' || action === 'managed';
  const wantsMarkdown = action === 'markdown' || action === 'both';
  const includeManual = action !== 'managed';
  const payload = buildBackupPayload({
    winget: wingetPackages,
    npm: npmPackages,
    pip: pipPackages,
    manualApps
  }, includeManual);

  let savedJson = false;
  if (wantsJson) {
    try {
      fs.writeFileSync('win-sync-setup.json', JSON.stringify(payload, null, 2));
      console.log(chalk.green(`\n✓ JSON saved to: ${path.join(process.cwd(), 'win-sync-setup.json')}`));
      savedJson = true;
    } catch (error) {
      console.log(chalk.red(`\n✗ Failed to save JSON: ${error.message}`));
    }
  }

  if (wantsMarkdown) {
    try {
      const markdown = generateMarkdown(payload, {
        versions: { winget: wingetVersions, npm: npmVersions }
      });
      fs.writeFileSync('win-sync-setup.md', markdown);
      console.log(chalk.green(`\n✓ Markdown saved to: ${path.join(process.cwd(), 'win-sync-setup.md')}`));
    } catch (error) {
      console.log(chalk.red(`\n✗ Failed to save Markdown: ${error.message}`));
    }
  }

  if (savedJson && includeManual && manualApps.length > 0) {
    console.log(chalk.bold.red('\n⚠  MANUAL APPS DETECTED - These are NOT in Winget and must be downloaded manually.'));
    console.log(chalk.yellow('Please download and install these manually after restore.'));
  }
}
```

- [ ] **Step 4: Syntax check**

Run: `node --check src/backup.js`
Expected: no output (exit 0).

- [ ] **Step 5: Unit tests still green**

Run: `npm test`
Expected: PASS — `# fail 0`.

- [ ] **Step 6: Smoke test — Discard path**

Run: `node index.js backup`, at the prompt select `(D) Discard and exit`.
Expected: yellow `🚫 Discarded — nothing was saved.`; neither `win-sync-setup.json` nor `win-sync-setup.md` is created/modified.

- [ ] **Step 7: Smoke test — Markdown only path**

Run: `node index.js backup`, select `(M) Save as Markdown only`.
Expected: green `✓ Markdown saved to: D:\win-sync\win-sync-setup.md`; `win-sync-setup.json` is NOT written. Verify:
Run: `Test-Path win-sync-setup.md`
Expected: `True`.

- [ ] **Step 8: Smoke test — Both path**

Run: `node index.js backup`, select `(A) Save as Both (JSON + Markdown)`.
Expected: two green lines (`✓ JSON saved to: ...` then `✓ Markdown saved to: ...`). Verify:
Run: `node -e "const d=JSON.parse(require('fs').readFileSync('win-sync-setup.json','utf8')); console.log(Object.keys(d).join(','))"`
Expected: `winget,npm,pip,manual_apps,exportedAt`

- [ ] **Step 9: Smoke test — Managed-only path**

Run: `node index.js backup`, select `(S) Save Auto-Restorable Only (exclude manual apps)`.
Expected: only the JSON success line. Verify:
Run: `node -e "console.log(JSON.parse(require('fs').readFileSync('win-sync-setup.json','utf8')).manual_apps.length)"`
Expected: `0`

- [ ] **Step 10: Add the Markdown artifact to `.gitignore`**

Append to `.gitignore`:

```gitignore
win-sync-setup.md
```

- [ ] **Step 11: Commit**

```bash
git add src/backup.js .gitignore
git commit -m "feat: B/M/A/S/D backup options with JSON and Markdown export"
```

---

### Task 6: README update

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the final user-facing behavior from Tasks 4 and 5.
- Produces: accurate usage docs (`win-sync` default, `backup`/`restore`, B/M/A/S/D options, Markdown export).

- [ ] **Step 1: Update the Usage section**

Replace the README block from `## Usage` through the end of the `### Restore` section with:

````markdown
## Usage

### Backup

Scan your machine for installed applications. Just run `win-sync` — the backup scan starts automatically (this is the same as `win-sync backup`):

```bash
win-sync
# or
win-sync backup
```

This will detect:
- **Winget packages** (Windows Package Manager)
- **NPM global packages**
- **PIP packages** (Python)
- **Manual apps** - Applications installed outside Winget (found via Windows Registry)

After scanning, choose what to do with the setup:

- **(B) Backup (JSON)** - save everything, including manual apps, to `win-sync-setup.json`
- **(M) Save as Markdown only** - generate a human-readable `win-sync-setup.md`
- **(A) Save as Both (JSON + Markdown)** - write both files
- **(S) Save Auto-Restorable Only (exclude manual apps)** - JSON backup without manual apps
- **(D) Discard and exit** - save nothing

Apps not available in Winget are listed under `manual_apps` and must be downloaded manually after restore.

### Restore

Installs all packages from the backup JSON:

```bash
win-sync restore
```

- Winget packages are installed in bulk via `winget import`
- NPM and PIP packages are installed individually with a progress bar
- Manual apps are listed again as a reminder to download them
````

- [ ] **Step 2: Add a Markdown export note**

After the JSON output example code block (immediately before the `## Requirements` heading), insert:

````markdown
### Markdown Export

Choosing **(M)** or **(A)** at the backup prompt also writes `win-sync-setup.md` — a human-readable snapshot with a summary table and per-category: Winget, NPM, PIP, and manual apps. Open it in your editor or commit it to GitHub for documentation.
````

- [ ] **Step 3: Verify the file renders sensibly**

Run: `node --check README.md > $null; if ($?) { "README ok" }`
Expected: prints `README ok` (README is Markdown; this is just a sanity invocation, not a real checker).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document default command, new options, and markdown export"
```

---

### Task 7: End-to-end verification

**Files:** none modified — verification only.

**Interfaces:**
- Consumes: Tasks 1–6 complete.
- Produces: confirmation the whole feature set works together per the spec.

- [ ] **Step 1: Full test suite + syntax sweep**

Run:
```bash
npm test
node --check index.js; node --check src/banner.js; node --check src/markdown-generator.js; node --check src/backup.js; node --check src/ui.js; node --check src/restore.js
```
Expected: all tests pass (`# fail 0`), all syntax checks exit 0.

- [ ] **Step 2: Default command + Banner**

Run: `node index.js`
Expected: cyan banner art + tagline, then backup scan spinners. Cancel with Ctrl+C.

- [ ] **Step 3: Backup full path — Both option**

Run: `node index.js backup`, select `(A)`.
Expected: banner first, scan, summary table, prompt, then two success lines. Verify Markdown content:
Run: `Get-Content win-sync-setup.md -TotalCount 12`
Expected: first lines include `# Windows Development Setup Backup`, the summary table, and `## Winget Apps (...)`.

- [ ] **Step 4: Restore path unaffected**

Run: `node index.js restore`, select `(C) Cancel`.
Expected: banner first, summary table with `✅ Ready to install`, then yellow `🚫 Cancelled — no changes were made.`

- [ ] **Step 5: Report results**

Summarize: default command works, banner displays, terminal maximizes on win32, option labels match the spec verbatim, JSON schema is unchanged, Markdown file generated with versions (em-dash fallback where unknown), and restore behavior is intact.