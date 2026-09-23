const chalk = require('chalk');
const { execFileSync } = require('child_process');

function buildBannerText() {
  return [
    '██╗    ██╗██╗███╗   ██╗      ███████╗██╗   ██╗███╗   ██╗ ██████╗',
    '██║    ██║██║████╗  ██║      ██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝',
    '██║ █╗ ██║██║██╔██╗ ██║█████╗███████╗ ╚████╔╝ ██╔██╗ ██║██║     ',
    '██║███╗██║██║██║╚██╗██║╚════╝╚════██║  ╚██╔╝  ██║╚██╗██║██║     ',
    '╚███╔███╔╝██║██║ ╚████║      ███████║   ██║   ██║ ╚████║╚██████╗',
    ' ╚══╝╚══╝ ╚═╝╚═╝  ╚═══╝      ╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝'
  ].join('\n');
}

function printBanner() {
  console.log(chalk.green.bold(buildBannerText()));
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