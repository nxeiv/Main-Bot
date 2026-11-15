'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createPermissionService } = require('../permissions');

const registry = [
  { name: 'help', access: 'public' },
  { name: 'status', access: 'admin' },
  { name: 'owner-tool', access: 'owner' },
  { name: 'rejoin', access: 'restricted' },
];

function makePermissions() {
  return createPermissionService({
    config: {
      adminUserIds: ['11111111111111111'],
      adminRoleIds: ['22222222222222222'],
    },
    commandRegistry: registry,
    memberHasAnyRole: (member, allowed) =>
      Boolean(member?.roleIds?.some(id => allowed.includes(id))),
    isRejoinAuthorized: userId => userId === '33333333333333333',
  });
}

test('public, admin, owner, and restricted access come from registry metadata', () => {
  const permissions = makePermissions();

  assert.equal(permissions.hasFeatureAccess('help', 'anyone'), true);
  assert.equal(permissions.hasFeatureAccess('status', 'anyone'), false);
  assert.equal(permissions.hasFeatureAccess('status', 'anyone', { roleIds: ['22222222222222222'] }), true);
  assert.equal(permissions.hasFeatureAccess('owner-tool', '11111111111111111'), true);
  assert.equal(permissions.hasFeatureAccess('owner-tool', 'anyone', { roleIds: ['22222222222222222'] }), false);
  assert.equal(permissions.hasFeatureAccess('rejoin', '33333333333333333'), true);
  assert.equal(permissions.hasFeatureAccess('rejoin', 'anyone'), false);
});

test('unknown features fail closed', () => {
  const permissions = makePermissions();
  assert.equal(permissions.hasFeatureAccess('unknown-feature', '11111111111111111'), false);
});
