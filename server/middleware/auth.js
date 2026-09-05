import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { isHRMAdmin, hasModuleAccess, isModuleAdmin } from '../utils/roles.js';

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// Verifies the JWT AND that the referenced user still exists (a token can otherwise look
// cryptographically valid while pointing at a user deleted by a reseed), attaching the
// user doc to req so downstream handlers/role checks don't need a second lookup.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not authenticated' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  const user = await User.findById(payload.sub);
  if (!user) return res.status(401).json({ message: 'Your session is no longer valid. Please log in again.' });

  req.userId = user._id.toString();
  req.user = user;
  next();
}

// TechAdmin is never MORE restricted than SuperAdmin (Revised HRM Role Hierarchy, 2026-08-24) — a
// route that requires 'SuperAdmin' must also accept 'TechAdmin', enforced here once rather than at
// every individual requireRole('SuperAdmin', ...) call site. Routes that should be TechAdmin-
// EXCLUSIVE (HR Settings, Module Access) simply call requireRole('TechAdmin') without 'SuperAdmin'.
export function requireRole(...roles) {
  const allowed = roles.includes('SuperAdmin') && !roles.includes('TechAdmin') ? [...roles, 'TechAdmin'] : roles;
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    next();
  };
}

// Final Role & Module Access Logic (2026-08-25): replaces requireRole('HR', 'SuperAdmin') for
// routes that manage HRM operations (Employee Directory, HR Admin dashboard, approving other
// employees' requests, ...). SuperAdmin/TechAdmin pass via blanket access; anyone else needs an
// explicit HRM (mykanan) Admin grant on their own moduleAccess — 'HR' as a role string alone no
// longer grants anything (see utils/roles.js).
export function requireHRMAdmin(req, res, next) {
  if (!req.user || !isHRMAdmin(req.user)) {
    return res.status(403).json({ message: 'You do not have permission to perform this action' });
  }
  next();
}

// Generic per-module equivalents (Kanan Recruit spec §1: "Kanan Recruit is not visible to normal
// employees... only Recruit Team gets Recruit module access"). requireModuleAccess = User or Admin
// level on that module; requireModuleAdmin = Admin level only (e.g. creating a Job Requisition or
// Offer is Recruit-Admin-only, per spec §6/§9, while any Recruit member can view/schedule).
export function requireModuleAccess(moduleKey) {
  return (req, res, next) => {
    if (!req.user || !hasModuleAccess(req.user, moduleKey)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    next();
  };
}

export function requireModuleAdmin(moduleKey) {
  return (req, res, next) => {
    if (!req.user || !isModuleAdmin(req.user, moduleKey)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    next();
  };
}
