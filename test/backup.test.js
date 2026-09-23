const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBackupPayload, buildWingetVersions, buildNpmVersions } = require('../src/backup');

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

test('buildWingetVersions maps package ids to versions', () => {
  const entries = [
    { PackageIdentifier: 'Git.Git', Version: '2.43.0' },
    { PackageIdentifier: 'Microsoft.VSCode', Version: '1.85.0' },
    { PackageIdentifier: 'NoVersion' }
  ];
  const result = buildWingetVersions(entries);
  assert.equal(result['Git.Git'], '2.43.0');
  assert.equal(result['Microsoft.VSCode'], '1.85.0');
  assert.equal(result['NoVersion'], undefined);
});

test('buildWingetVersions tolerates non-array input', () => {
  assert.deepEqual(buildWingetVersions(null), {});
});

test('buildNpmVersions maps names to versions and skips npm', () => {
  const deps = {
    typescript: { version: '5.3.2' },
    npm: { version: '10.0.0' },
    nodemon: { version: '3.0.2', other: 'x' }
  };
  const result = buildNpmVersions(deps);
  assert.equal(result.typescript, '5.3.2');
  assert.equal(result.nodemon, '3.0.2');
  assert.equal(result.npm, undefined);
});

test('buildNpmVersions tolerates nullish input and missing versions', () => {
  assert.deepEqual(buildNpmVersions(null), {});
  assert.deepEqual(buildNpmVersions({ a: {}, b: null }), {});
});
