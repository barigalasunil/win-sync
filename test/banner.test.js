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