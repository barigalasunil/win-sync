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
