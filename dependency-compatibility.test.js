'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const uuid = require('uuid');
const yggdrasil = require('yggdrasil');
const msal = require('@azure/msal-node');

test('all transitive UUID dependencies resolve to the patched release', () => {
  const lock = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'package-lock.json'), 'utf8'),
  );
  const uuidEntries = Object.entries(lock.packages).filter(
    ([packagePath]) =>
      packagePath === 'node_modules/uuid' ||
      packagePath.endsWith('/node_modules/uuid'),
  );

  assert.deepEqual(
    uuidEntries.map(([packagePath, dependency]) => [
      packagePath,
      dependency.version,
    ]),
    [['node_modules/uuid', '11.1.1']],
  );
  assert.match(
    uuid.v4(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test('Minecraft authentication dependencies still load with the UUID override', () => {
  assert.equal(typeof yggdrasil, 'function');
  assert.equal(typeof msal.PublicClientApplication, 'function');
});
