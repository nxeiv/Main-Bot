'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REJOIN_ALLOWED_ROLE_ID,
  REJOIN_ALLOWED_USER_ID,
  isRejoinAuthorized,
} = require('../rejoin-access');

test('the explicitly allowed user can rejoin without a role', () => {
  assert.equal(isRejoinAuthorized(REJOIN_ALLOWED_USER_ID), true);
});

test('members with the configured role can rejoin', () => {
  const member = { roles: { cache: new Set([REJOIN_ALLOWED_ROLE_ID]) } };
  assert.equal(isRejoinAuthorized('987654321098765432', member), true);
});

test('other members and users without role data are denied', () => {
  assert.equal(isRejoinAuthorized('987654321098765432'), false);
  assert.equal(
    isRejoinAuthorized('987654321098765432', { roles: { cache: new Set() } }),
    false,
  );
});

test('the exact role ID is required', () => {
  const member = { roles: { cache: new Set(['1398595607853142087']) } };
  assert.equal(isRejoinAuthorized('987654321098765432', member), false);
});
