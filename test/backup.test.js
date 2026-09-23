const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBackupPayload } = require('../src/backup');

test('buildBackupPayload keeps manual_apps when includeManual is true', () => {
  const data = {
    winget: ['Git.Git'],
    npm: ['typescript'],
    pip: [{ name: 'requests', version: '2.31.0' }],
    manualApps: [{ name: 'SomeApp', version: '1.0.0', publisher: 'SomePublisher' }]
  };
  const payload = buildBackupPayload(data, true);
  assert.equal(payload.winget.length, 1);
  assert.equal(payload.npm.length, 1);
  assert.equal(payload.pip.length, 1);
  assert.deepEqual(payload.manual_apps, data.manualApps);
  assert.ok(typeof payload.exportedAt === 'string');
});

test('buildBackupPayload discards manual_apps when includeManual is false', () => {
  const data = {
    winget: ['Git.Git'],
    npm: [],
    pip: [],
    manualApps: [{ name: 'SomeApp', version: '1.0.0', publisher: 'SomePublisher' }]
  };
  const payload = buildBackupPayload(data, false);
  assert.deepEqual(payload.manual_apps, []);
});