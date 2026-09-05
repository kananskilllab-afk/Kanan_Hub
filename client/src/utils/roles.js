// Final Role & Module Access Logic (2026-08-25):
//   TechAdmin  — system/technical authority. Gets everything SuperAdmin has, PLUS exclusive
//                access to this app's technical-config surfaces (HR Settings, Module Access).
//   SuperAdmin — business/application authority (blanket access to every module).
//   Employee   — end user. HRM-Admin-ness is now a per-module GRANT (moduleAccess: [{module:
//                'mykanan', accessRole:'Admin'}]), not a global role. 'HR' is kept as a legacy role
//                label for existing accounts but carries no authorization meaning any more — see
//                server/utils/roles.js for the matching backend logic.
//
// Use these helpers instead of comparing user.role === 'SuperAdmin' or 'HR' directly.

export function isTechAdminRole(role) {
  return role === 'TechAdmin';
}

export function isAdminRole(role) {
  return role === 'SuperAdmin' || role === 'TechAdmin';
}

// Does this user have an explicit HRM (mykanan) Admin grant? Takes the *user object* (from
// AuthContext), not just the role string, since this is module-specific.
export function hasHRMAdminGrant(user) {
  return (user?.moduleAccess || []).some((m) => m.module === 'mykanan' && m.accessRole === 'Admin');
}

// The real replacement for the old "is this account privileged" check — SuperAdmin/TechAdmin
// (blanket), or an account with an explicit HRM Admin grant.
export function isHRMAdmin(user) {
  return isAdminRole(user?.role) || hasHRMAdminGrant(user);
}

// Generic per-module versions (Kanan Recruit and any future module) — SuperAdmin/TechAdmin always
// pass (blanket); everyone else needs an explicit grant on that specific module.
export function hasModuleAccess(user, moduleKey) {
  return isAdminRole(user?.role) || (user?.moduleAccess || []).some((m) => m.module === moduleKey);
}

export function isModuleAdmin(user, moduleKey) {
  return isAdminRole(user?.role) || (user?.moduleAccess || []).some((m) => m.module === moduleKey && m.accessRole === 'Admin');
}
