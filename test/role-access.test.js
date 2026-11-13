'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { getRoleIds, memberHasAnyRole } = require('../role-access');

const allowed = ['role-allowed'];

test('recognizes Discord.js cached role collections', () => {
  const member = {
    roles: {
      cache: new Map([['role-allowed', { id: 'role-allowed' }]]),
    },
  };

  assert.deepEqual(getRoleIds(member), ['role-allowed']);
  assert.equal(memberHasAnyRole(member, allowed), true);
});

test('recognizes raw API interaction members with role ID arrays', () => {
  assert.equal(memberHasAnyRole({ roles: ['role-allowed'] }, allowed), true);
});

test('recognizes arrays of role objects and iterable collections', () => {
  assert.equal(memberHasAnyRole({ roles: [{ id: 'role-allowed' }] }, allowed), true);
  assert.equal(memberHasAnyRole({ roles: new Set(['role-allowed']) }, allowed), true);
});

test('does not authorize a missing or unrelated role', () => {
  assert.equal(memberHasAnyRole(null, allowed), false);
  assert.equal(memberHasAnyRole({ roles: ['role-other'] }, allowed), false);
  assert.equal(memberHasAnyRole({ roles: ['role-allowed'] }, []), false);
});
