'use strict';

function getRoleIds(member) {
  const roles = member?.roles;
  const source = roles?.cache ?? roles;

  if (!source) {
    return [];
  }

  let values;

  if (Array.isArray(source)) {
    values = source;
  } else if (typeof source.values === 'function') {
    values = [...source.values()];
  } else if (typeof source[Symbol.iterator] === 'function') {
    values = [...source];
  } else {
    return [];
  }

  return values
    .map(role => typeof role === 'string' ? role : role?.id)
    .filter(roleId => typeof roleId === 'string' && roleId.length > 0);
}

function memberHasAnyRole(member, allowedRoleIds = []) {
  if (!Array.isArray(allowedRoleIds) || allowedRoleIds.length === 0) {
    return false;
  }

  const allowed = new Set(allowedRoleIds.map(String));
  return getRoleIds(member).some(roleId => allowed.has(roleId));
}

module.exports = {
  getRoleIds,
  memberHasAnyRole,
};
