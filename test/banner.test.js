const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBannerText, maximizeTerminal, printBanner } = require('../src/banner');

test('buildBannerText returns the win-sync ASCII art', () => {
  const text = buildBannerText();
  assert.match(text, /█╗    ██╗██╗███╗   ██╗/);
  assert.match(text, /WIN-SYNC|╚════╝/);
  assert.equal(text.split('\n').length, 6);
});

test('maximizeTerminal does not throw', () => {
  maximizeTerminal();
});