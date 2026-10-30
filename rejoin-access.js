'use strict';

const REJOIN_ALLOWED_USER_ID = '1235216001260458084';
const REJOIN_ALLOWED_ROLE_ID = '1398595607853142086';

function isRejoinAuthorized(userId, member = null) {
  if (String(userId || '') === REJOIN_ALLOWED_USER_ID) return true;

  const roleCache = member?.roles?.cache;
  if (roleCache && typeof roleCache.has === 'function') {
    return roleCache.has(REJOIN_ALLOWED_ROLE_ID);
  }

  const roles = member?.roles;
  if (Array.isArray(roles)) {
    return roles.some(role =>
      (typeof role === 'string' ? role : role?.id) === REJOIN_ALLOWED_ROLE_ID,
    );
  }

  return false;
}

module.exports = {
  REJOIN_ALLOWED_ROLE_ID,
  REJOIN_ALLOWED_USER_ID,
  isRejoinAuthorized,
};
