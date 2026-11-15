'use strict';

function createPermissionService({
  config,
  commandRegistry,
  memberHasAnyRole,
  isRejoinAuthorized,
}) {
  if (!config || !Array.isArray(commandRegistry) ||
      typeof memberHasAnyRole !== 'function' ||
      typeof isRejoinAuthorized !== 'function') {
    throw new TypeError('Permission service requires config, registry, role and restricted-access helpers.');
  }

  const entries = new Map(commandRegistry.map(command => [command.name, command]));

  function isAdmin(userId, member = null) {
    if (config.adminUserIds?.includes(String(userId || ''))) return true;
    return memberHasAnyRole(member, config.adminRoleIds);
  }

  function hasFeatureAccess(feature, userId, member = null) {
    const command = entries.get(feature);

    // Unknown feature names must never inherit an admin policy.
    if (!command || typeof command.access !== 'string') return false;

    const access = command.access;

    if (access === 'public') return true;
    if (access === 'admin' || access === 'moderator') return isAdmin(userId, member);
    if (access === 'owner') return config.adminUserIds?.includes(String(userId || '')) || false;
    if (access === 'restricted') return isRejoinAuthorized(userId, member);

    return false;
  }

  return {
    isAdmin,
    hasFeatureAccess,
  };
}

module.exports = {
  createPermissionService,
};
