'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createAfkStore } = require('../afk-store');

function makeTemporaryStore(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cottage-afk-test-'));
  const filePath = path.join(directory, 'user-afk.json');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, filePath };
}

test('AFK status can be set, retrieved, and cleared', t => {
  const { filePath } = makeTemporaryStore(t);
  const store = createAfkStore({ filePath });

  store.setUserAfk('user-1', 'Taking a break');
  assert.deepEqual(store.getUserAfk('user-1').reason, 'Taking a break');
  assert.equal(Number.isSafeInteger(store.getUserAfk('user-1').setAt), true);
  assert.equal(store.clearUserAfk('user-1'), true);
  assert.equal(store.getUserAfk('user-1'), null);
  assert.equal(store.clearUserAfk('user-1'), false);
});

test('AFK state persists across store instances', t => {
  const { filePath } = makeTemporaryStore(t);
  const firstStore = createAfkStore({ filePath });
  firstStore.setUserAfk('user-2', 'Working');

  const secondStore = createAfkStore({ filePath });
  assert.equal(secondStore.getUserAfk('user-2').reason, 'Working');
});

test('AFK state loading ignores malformed records and reports invalid JSON safely', t => {
  const { filePath } = makeTemporaryStore(t);
  const logs = [];
  fs.writeFileSync(filePath, JSON.stringify({
    valid: { reason: 'Here soon', setAt: Date.now() },
    invalid: { reason: 42, setAt: Date.now() },
  }));
  const store = createAfkStore({ filePath, log: message => logs.push(message) });

  assert.equal(store.getUserAfk('valid').reason, 'Here soon');
  assert.equal(store.getUserAfk('invalid'), null);

  fs.writeFileSync(filePath, '{not json');
  const brokenStore = createAfkStore({ filePath, log: message => logs.push(message) });
  assert.equal(brokenStore.getUserAfk('valid'), null);
  assert.ok(logs.some(message => message.includes('Unable to load user AFK statuses')));
});

test('AFK reasons are normalized and capped at 200 characters', t => {
  const { filePath } = makeTemporaryStore(t);
  const store = createAfkStore({ filePath });

  store.setUserAfk('user-3', '   ' + 'x'.repeat(250) + '   ');
  assert.equal(store.getUserAfk('user-3').reason.length, 200);
  assert.throws(() => store.setUserAfk('', 'reason'), /user ID is required/);
});
