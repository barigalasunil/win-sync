const fs = require('fs');
const { execSync } = require('child_process');
const cliProgress = require('cli-progress');
const chalk = require('chalk');
const { runCommand } = require('./utils');

async function runRestore() {
  if (!fs.existsSync('win-sync-setup.json')) {
    console.log(chalk.red('✗ Error: win-sync-setup.json not found. Run "win-sync backup" first.'));
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync('win-sync-setup.json', 'utf8'));
  
  const totalPackages = 
    (data.winget?.length || 0) + 
    (data.npm?.length || 0) + 
    (data.pip?.length || 0);

  if (totalPackages === 0) {
    console.log(chalk.yellow('No packages to restore.'));
    return;
  }

  const bar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' {percentage}% | {value}/{total} | {package}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  }, cliProgress.Presets.shades_classic);

  bar.start(totalPackages, 0, { package: 'Starting...' });

  if (data.winget && data.winget.length > 0) {
    bar.update(0, { package: 'Importing Winget packages...' });
    try {
      runCommand('winget import win-sync-setup.json --accept-source-agreements');
      bar.increment(data.winget.length, { package: 'Winget done' });
    } catch (error) {
      console.log(chalk.red('\n✗ Winget import failed'));
    }
  }

  if (data.npm && data.npm.length > 0) {
    for (const pkg of data.npm) {
      bar.increment(0, { package: `npm: ${pkg}` });
      try {
        runCommand(`npm install -g ${pkg}`);
      } catch (error) {
        console.log(chalk.red(`\n✗ Failed to install npm package: ${pkg}`));
      }
      bar.increment(1, { package: `npm: ${pkg} ✓` });
    }
  }

  if (data.pip && data.pip.length > 0) {
    for (const pkg of data.pip) {
      const pkgSpec = `${pkg.name}==${pkg.version}`;
      bar.increment(0, { package: `pip: ${pkgSpec}` });
      try {
        runCommand(`pip install ${pkgSpec}`);
      } catch (error) {
        console.log(chalk.red(`\n✗ Failed to install pip package: ${pkgSpec}`));
      }
      bar.increment(1, { package: `pip: ${pkgSpec} ✓` });
    }
  }

  bar.stop();
  console.log(chalk.green('\n✓ Restore complete!'));

  if (data.manual_apps && data.manual_apps.length > 0) {
    console.log(chalk.bold.red('\n⚠  MANUAL APPS REQUIRED - These were NOT installed (not in Winget):'));
    data.manual_apps.forEach(app => {
      console.log(chalk.red(`  - ${app.name} (v${app.version}) by ${app.publisher}`));
    });
    console.log(chalk.yellow('\nPlease download and install these manually.'));
  }
}

module.exports = { runRestore };