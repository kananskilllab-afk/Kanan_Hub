import Notification from '../models/Notification.js';
import User from '../models/User.js';

// Centralized notification creation (Notification Engine spec §37: "do not build notification
// logic inside every individual HRM module" — every module calls through this one function
// instead of writing its own Notification.create()). In-app channel only for now.
export async function notify({ recipientId, event, title, body = '', link = null, sourceModule = null, sourceId = null }) {
  if (!recipientId) return null;
  return Notification.create({ recipient: recipientId, event, title, body, link, sourceModule, sourceId });
}

export async function notifyMany(recipientIds, payload) {
  const unique = [...new Set(recipientIds.filter(Boolean).map(String))];
  return Promise.all(unique.map((id) => notify({ ...payload, recipientId: id })));
}

// Who should be notified about a new pending request from `employeeId`: their reporting manager
// if one is set, else every HRM Admin — mirrors the approver-visibility logic already used by the
// half-day-leave/regularization/permission `?all=true` GET routes and requireHRMAdmin, so the same
// person who can see and act on a request in the Approval Center is the one who gets notified.
// HRM-Admin-ness is SuperAdmin/TechAdmin (blanket) or an explicit mykanan:Admin module grant —
// 'HR' as a role string alone doesn't qualify any more (Final Role & Module Access Logic, §11).
export async function resolveApprovers(employeeId) {
  const employee = await User.findById(employeeId);
  if (employee?.reportingManager) return [employee.reportingManager];
  const hrAdmins = await User.find({
    $or: [
      { role: { $in: ['SuperAdmin', 'TechAdmin'] } },
      { moduleAccess: { $elemMatch: { module: 'mykanan', accessRole: 'Admin' } } }
    ]
  }, '_id');
  return hrAdmins.map((u) => u._id);
}
