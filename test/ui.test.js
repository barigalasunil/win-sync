const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSummaryRows } = require('../src/ui');

test('buildSummaryRows returns 4 rows in spec order with backup counts', () => {
  const rows = buildSummaryRows({ winget: 48, npm: 15, pip: 71, manual: 0 }, 'backup');
  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map(r => r.label),
    ['Winget Apps', 'NPM Globals', 'PIP Packages', 'Manual Apps']
  );
  assert.deepEqual(rows.map(r => r.count), [48, 15, 71, 0]);
});

test('buildSummaryRows uses backup status copy', () => {
  const rows = buildSummaryRows({ winget: 1, npm: 0, pip: 0, manual: 2 }, 'backup');
  assert.match(rows[0].status, /✅ Ready to backup/);
  assert.match(rows[3].status, /⚠️ Needs re-download/);
});

test('buildSummaryRows uses restore status copy', () => {
  const rows = buildSummaryRows({ winget: 1, npm: 0, pip: 0, manual: 2 }, 'restore');
  assert.match(rows[0].status, /✅ Ready to install/);
  assert.match(rows[3].status, /⚠️ Will not be installed/);
});

test('buildSummaryRows defaults omitted counts to 0', () => {
  const rows = buildSummaryRows({}, 'backup');
  assert.deepEqual(rows.map(r => r.count), [0, 0, 0, 0]);
});