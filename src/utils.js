const { execSync } = require('child_process');

function runCommand(cmd) {
  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    });
    return output.trim();
  } catch (error) {
    return null;
  }
}

module.exports = { runCommand };