// Final Role & Module Access Logic (2026-08-25):
//   TechAdmin  — system/technical authority. Gets everything SuperAdmin has, PLUS exclusive
//                access to this app's technical-config surfaces (HR Settings' Shift/Permission
//                Policy versioning, module access grants). Never MORE restricted than SuperAdmin.
//   SuperAdmin — business/application authority (blanket access to every module).
//   Employee   — end user. HRM-Admin-ness is now a per-module GRANT (moduleAccess: [{module:
//                'mykanan', accessRole:'Admin'}]), not a global role — see spec §11 "Never treat
//                Admin as global access." 'HR' is kept in the role enum only as a legacy label for
//                existing accounts; it carries NO authorization meaning any more. Every ACTIVE
//                employee auto-gets {module:'mykanan', accessRole:'User'} on activation (§12) —
//                see routes/verify.js — so HRM self-service is visible without Tech Admin acting.
//                "Manager"/"HOD" stay derived from reportingManager, not stored roles.
//
// Use these helpers instead of comparing role === 'SuperAdmin' or role === 'HR' directly.

export function isTechAdminRole(role) {
  return role === 'TechAdmin';
}

// "Full business authority" tier — SuperAdmin and TechAdmin. Blanket access to every module,
// regardless of any per-module grant.
export function isAdminRole(role) {
  return role === 'SuperAdmin' || role === 'TechAdmin';
}

// Does this user have an explicit HRM (mykanan) Admin grant? Takes the *user document* (or any
// object with a moduleAccess array), not just the role string, since this is module-specific.
export function hasHRMAdminGrant(user) {
  return (user?.moduleAccess || []).some((m) => m.module === 'mykanan' && m.accessRole === 'Admin');
}

// The real replacement for the old "is this account privileged" check: SuperAdmin/TechAdmin
// (blanket), or an Employee/HR-labeled account with an explicit HRM Admin grant. This is who can
// see the HR Admin dashboard, manage the Employee Directory, approve other employees' requests,
// and view another employee's attendance/leave.
export function isHRMAdmin(user) {
  return isAdminRole(user?.role) || hasHRMAdminGrant(user);
}

// Generic versions of the above for any module (used by Kanan Recruit, and reusable for future
// modules) — SuperAdmin/TechAdmin always pass (blanket); everyone else needs an explicit grant on
// that specific module. hasModuleAccess = User or Admin level; isModuleAdmin = Admin level only.
export function hasModuleAccess(user, moduleKey) {
  return isAdminRole(user?.role) || (user?.moduleAccess || []).some((m) => m.module === moduleKey);
}

export function isModuleAdmin(user, moduleKey) {
  return isAdminRole(user?.role) || (user?.moduleAccess || []).some((m) => m.module === moduleKey && m.accessRole === 'Admin');
}
