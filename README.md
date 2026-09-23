# win-sync

CLI tool to backup and restore Windows development environment (Winget, NPM, PIP).

## Installation

```bash
npm install -g win-sync
```

Or clone and link locally:

```bash
git clone <repo-url>
cd win-sync
npm install
npm link
```

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

## Output

The backup creates a `win-sync-setup.json` file with this structure:

```json
{
  "winget": ["Microsoft.VisualStudioCode", "Git.Git"],
  "npm": ["typescript", "eslint"],
  "pip": [{"name": "requests", "version": "2.31.0"}],
  "manual_apps": [
    {"name": "SomeApp", "version": "1.0.0", "publisher": "SomePublisher"}
  ],
  "exportedAt": "2024-01-15T10:30:00.000Z"
}
```

### Markdown Export

Choosing **(M)** or **(A)** at the backup prompt also writes `win-sync-setup.md` — a human-readable snapshot with a summary table and per-category: Winget, NPM, PIP, and manual apps. Open it in your editor or commit it to GitHub for documentation.

## Requirements

- Windows 10/11
- Node.js 18+
- Winget (built into Windows 11, installable on Windows 10)
- NPM (comes with Node.js)
- PIP (comes with Python)

## License

ISC