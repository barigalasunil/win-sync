const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const ora = require('ora');
const chalk = require('chalk');
const { runCommand } = require('./utils');
const { buildSummaryRows, printSummaryTable, printManualAppsTable, promptChoice } = require('./ui');
const { generateMarkdown } = require('./markdown-generator');

function buildBackupPayload(data, includeManual) {
  return {
    winget: data.winget,
    npm: data.npm,
    pip: data.pip,
    manual_apps: includeManual ? data.manualApps : [],
    exportedAt: new Date().toISOString()
  };
}

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

async function runBackup() {
  const wingetPackages = [];
  const npmPackages = [];
  const pipPackages = [];
  const manualApps = [];
  const wingetVersions = {};
  const npmVersions = {};

  const tempDir = os.tmpdir();
  const wingetExportPath = path.join(tempDir, 'winget-export.json');

  const spinnerWinget = ora(chalk.green('Scanning Winget packages...')).start();
  try {
    runCommand(`winget export "${wingetExportPath}" --accept-source-agreements`);
    if (fs.existsSync(wingetExportPath)) {
      const content = fs.readFileSync(wingetExportPath, 'utf8');
      const data = JSON.parse(content);
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
      fs.unlinkSync(wingetExportPath);
    }
    spinnerWinget.succeed(chalk.green(`Found ${wingetPackages.length} Winget packages`));
  } catch (error) {
    spinnerWinget.fail(chalk.red('Failed to scan Winget packages'));
  }

  const spinnerNpm = ora(chalk.cyan('Scanning NPM global packages...')).start();
  try {
    const output = runCommand('npm list -g --depth=0 --json');
    if (output) {
      const data = JSON.parse(output);
      Object.assign(npmVersions, buildNpmVersions(data.dependencies));
      if (data.dependencies) {
        Object.keys(data.dependencies).forEach(name => {
          if (name !== 'npm') {
            npmPackages.push(name);
          }
        });
      }
    }
    spinnerNpm.succeed(chalk.cyan(`Found ${npmPackages.length} NPM packages`));
  } catch (error) {
    spinnerNpm.fail(chalk.red('Failed to scan NPM packages'));
  }

  const spinnerPip = ora(chalk.magenta('Scanning PIP packages...')).start();
  try {
    const output = runCommand('pip list --format=json');
    if (output) {
      const data = JSON.parse(output);
      data.forEach(pkg => {
        if (pkg.name && pkg.version) {
          pipPackages.push({ name: pkg.name, version: pkg.version });
        }
      });
    }
    spinnerPip.succeed(chalk.magenta(`Found ${pipPackages.length} PIP packages`));
  } catch (error) {
    spinnerPip.fail(chalk.red('Failed to scan PIP packages'));
  }

  const spinnerManual = ora(chalk.red('Checking for manual apps (Registry vs Winget)...')).start();
  try {
    const psCommand = `
      Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* |
      Select-Object DisplayName, DisplayVersion, Publisher |
      Where-Object { $_.DisplayName -ne $null } |
      ConvertTo-Json -Depth 3
    `;
    const output = runCommand(`powershell -Command "${psCommand}"`);
    if (output) {
      const registryApps = JSON.parse(output);
      const wingetSet = new Set(wingetPackages.map(p => p.toLowerCase()));
      
      const appsArray = Array.isArray(registryApps) ? registryApps : [registryApps];
      appsArray.forEach(app => {
        if (app.DisplayName && !wingetSet.has(app.DisplayName.toLowerCase())) {
          manualApps.push({
            name: app.DisplayName,
            version: app.DisplayVersion || 'Unknown',
            publisher: app.Publisher || 'Unknown'
          });
        }
      });
    }
    spinnerManual.succeed(chalk.red(`Found ${manualApps.length} manual apps not in Winget`));
  } catch (error) {
    spinnerManual.fail(chalk.red('Failed to scan Registry for manual apps'));
  }

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

module.exports = { runBackup, buildBackupPayload, buildWingetVersions, buildNpmVersions };
