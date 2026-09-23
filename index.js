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
