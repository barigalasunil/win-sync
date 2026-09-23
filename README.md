# ⚡ win-sync

> Backup and restore your entire Windows development environment in one command — never lose your setup again.

[![License](https://img.shields.io/github/license/barigalasunil/win-sync)](LICENSE)
[![Release](https://img.shields.io/github/v/release/barigalasunil/win-sync?color=blue)](https://github.com/barigalasunil/win-sync/releases)
[![Issues](https://img.shields.io/github/issues/barigalasunil/win-sync)](https://github.com/barigalasunil/win-sync/issues)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![OS](https://img.shields.io/badge/Windows-10%2F11-0078d6)](https://www.microsoft.com/windows)

---

## 📖 Introduction

Switching Windows machines means reinstalling everything from memory — and forgetting half of it. **win-sync** scans your machine for everything you have installed, flags the apps that can't be restored automatically, and saves it all to a JSON snapshot you can restore with a single command.

## ✨ Features

- **🚀 Instant full scan** — detects Winget packages, NPM global packages, PIP packages, and registry-installed apps in seconds.
- **🎨 Beautiful interactive tables** — color-coded terminal tables with live spinners and a clean, modern UI (courtesy of `chalk`, `ora`, and `cli-table3`).
- **⚠️ Smart manual-app detection** — apps installed outside Winget are flagged as *"Manual"* so you know exactly what you'll need to re-download by hand.
- **📦 JSON & Markdown export** — save a machine-readable backup for 1-click restores, or a human-readable document for sharing and documentation.
- **🔄 One-command restore** — reinstall everything automatically via `winget import`, `npm i -g`, and `pip install`.
- **🎯 Works with what you already have** — NPM, PIP, Winget, and PowerShell are all standard on a modern Windows dev box.

## 📦 Installation

Install globally via npm:

```bash
npm install -g win-sync
```

Or run from source during development:

```bash
git clone https://github.com/barigalasunil/win-sync.git
cd win-sync
npm install
npm link
```

After that, the `win-sync` command is available anywhere on your machine.

## 🚀 Usage & Commands

### Backup

Just run `win-sync` — the scan starts automatically (this is the same as `win-sync backup`):

```bash
win-sync
# or
win-sync backup
```

This detects:

- **Winget packages** (Windows Package Manager)
- **NPM global packages**
- **PIP packages** (Python)
- **Manual apps** — installed outside Winget (found via Windows Registry)

When the scan finishes, choose what to do with your setup:

| Option | Action |
|--------|--------|
| **(B) Backup (JSON)** | Save everything, including manual apps, to `win-sync-setup.json` |
| **(M) Save as Markdown only** | Generate a human-readable `win-sync-setup.md` |
| **(A) Save as Both (JSON + Markdown)** | Write both files |
| **(S) Save Auto-Restorable Only** | JSON backup *without* manual apps |
| **(D) Discard and exit** | Save nothing |

> **Note:** Apps not available in Winget are listed under `manual_apps` and must be downloaded manually after restore.

### How the backup files look

`win-sync-setup.json` captures everything needed for a full restore:

```json
{
  "winget": ["Microsoft.VisualStudioCode", "Git.Git"],
  "npm": ["typescript", "eslint"],
  "pip": [{ "name": "requests", "version": "2.31.0" }],
  "manual_apps": [
    { "name": "SomeApp", "version": "1.0.0", "publisher": "SomePublisher" }
  ],
  "exportedAt": "2026-09-23T10:30:00.000Z"
}
```

The **Markdown export** (`win-sync-setup.md`) is a polished, human-readable snapshot with a summary table and per-category sections for Winget, NPM, PIP, and manual apps — perfect for committing to your repo or sharing in docs.

### Restore

Installs all packages from the backup JSON:

```bash
win-sync restore
```

- **Winget** packages are reinstalled in bulk via `winget import`
- **NPM** and **PIP** packages are installed individually with a progress bar
- **Manual apps** are listed again so you remember to download them

## 🖥️ Output Example

Here's what running `win-sync` looks like:

```
 _    _           _   _____ _ _
| |  | |         | | /  ___(_) |
| |  | | ___  ___| | \ `--. _| |_
| |/\| |/ _ \/ __| |  `--. \ | __|
\  /\  /  __/\__ \_| /\__/ / | |_
 \/  \/ \___||___(_) \____/|_|\__|

Windows Development Environment Backup & Restore

✔ Scanning Winget packages...
✔ Scanning NPM global packages...
✔ Scanning PIP packages...
✔ Checking for manual apps...

Scan complete — here's what was found:

┌──────────────────┬───────┬──────────────────────────────┐
│ Category         │ Count │ Status                       │
├──────────────────┼───────┼──────────────────────────────┤
│ Winget Apps      │ 48    │ ✅ Ready to backup           │
│ NPM Globals      │ 15    │ ✅ Ready to backup           │
│ PIP Packages     │ 71    │ ✅ Ready to backup           │
│ Manual Apps      │ 4     │ ⚠️ Needs re-download         │
└──────────────────┴───────┴──────────────────────────────┘

Manual apps — must be downloaded after restore:

┌──────────────────────────────────────────┬────────────┬────────────────────────────┐
│ App                                     │ Version    │ Publisher                  │
├──────────────────────────────────────────┼────────────┼────────────────────────────┤
│ Some Proprietary Tool                    │ 2.3.1      │ SomeCompany                │
│ Another GUI App                          │ 1.0.0      │ AnotherPublisher           │
└──────────────────────────────────────────┴────────────┴────────────────────────────┘

? What would you like to do with this setup?
  (B) Backup (JSON)
  (M) Save as Markdown only
  (A) Save as Both (JSON + Markdown)
  (S) Save Auto-Restorable Only (exclude manual apps)
  (D) Discard and exit
```

During `win-sync restore`, a real-time progress bar tracks each package as it's installed:

```
installing ████████████████████░░░░░░░░░░░░ 58% | 170/292 | esbuild@0.21.5
```

## 📁 Project Structure

```
win-sync/
├── index.js                  # CLI entry point & command registration
├── package.json              # dependencies, metadata & bin config
├── src/
│   ├── backup.js             # backup scan + B/M/A/S/D save flow
│   ├── banner.js             # ASCII art banner + terminal maximize
│   ├── markdown-generator.js # human-readable .md export builder
│   ├── restore.js            # restore flow (winget/npm/pip + progress)
│   ├── ui.js                 # tables, spinners & interactive prompts
│   └── utils.js              # shared command runner helpers
└── test/
    ├── backup.test.js
    ├── banner.test.js
    ├── markdown-generator.test.js
    └── ui.test.js
```

## 🤝 Contributing

Contributions, issues, and feature requests are all welcome! Here's how to get started:

1. **Fork** the repo and create your feature branch:

   ```bash
   git checkout -b feat/amazing-feature
   ```

2. **Make your changes**, keeping code style consistent (CommonJS, existing utilities/patterns).

3. **Add tests** for your changes and make sure the suite passes:

   ```bash
   npm test
   ```

4. **Commit** with a clear message, push to your fork, and open a **Pull Request**.

Please make sure your PR is focused, well-documented, and passes all existing tests.

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for more information.

---

*Made for Windows developers who hate reinstalling everything twice. ⚡*