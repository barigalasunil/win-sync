#!/usr/bin/env node

const { program } = require('commander');
const { runBackup } = require('./src/backup');
const { runRestore } = require('./src/restore');

program
  .name('win-sync')
  .version('1.0.0')
  .description('CLI tool to backup and restore Windows development environment (Winget, NPM, PIP)');

program
  .command('backup')
  .description('Scan machine for installed apps and save to JSON')
  .action(async () => {
    await runBackup();
  });

program
  .command('restore')
  .description('Install packages from backup JSON')
  .action(async () => {
    await runRestore();
  });

program.parse(process.argv);