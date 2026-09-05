import { Router } from 'express';
import User from '../models/User.js';
import LeaveRequest from '../models/LeaveRequest.js';
import { requireAuth } from '../middleware/auth.js';
import { notify } from '../services/notifyService.js';
import { isHRMAdmin } from '../utils/roles.js';

const router = Router();
router.use(requireAuth);

function daysBetween(from, to) {
  const ms = new Date(to).setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0);
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

// Resolves which user's leave data to read: yourself by default, or — via ?employeeId= — another
// employee, but only if you're HR/Admin or that employee's direct reporting manager.
async function resolveViewTarget(req) {
  const { employeeId } = req.query;
  if (!employeeId || employeeId === req.userId) return req.userId;

  const requester = await User.findById(req.userId);
  if (isHRMAdmin(requester)) return employeeId;

  const target = await User.findById(employeeId);
  if (target?.reportingManager && String(target.reportingManager) === String(req.userId)) return employeeId;

  return null;
}

router.get('/balance', async (req, res) => {
  const targetId = await resolveViewTarget(req);
  if (!targetId) return res.status(403).json({ message: 'You cannot view this employee’s leave.' });
  const user = await User.findById(targetId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ leaveBalance: user.leaveBalance });
});

router.get('/requests', async (req, res) => {
  const targetId = await resolveViewTarget(req);
  if (!targetId) return res.status(403).json({ message: 'You cannot view this employee’s leave.' });
  const requests = await LeaveRequest.find({ user: targetId }).sort({ createdAt: -1 });
  res.json({ requests });
});

// Applying leave auto-approves and deducts balance immediately (demo simplification — no approval workflow yet).
router.post('/requests', async (req, res) => {
  const { type, fromDate, toDate, reason } = req.body;
  if (!type || !fromDate || !toDate) return res.status(400).json({ message: 'type, fromDate and toDate are required' });

  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const days = daysBetween(fromDate, toDate);

  if (type === 'Casual' || type === 'Sick' || type === 'Earned') {
    const key = type.toLowerCase();
    const remaining = user.leaveBalance[key] - user.leaveBalance[`${key}Used`];
    if (days > remaining) {
      return res.status(400).json({ message: `Insufficient ${type} leave balance. ${remaining} day(s) remaining.` });
    }
    user.leaveBalance[`${key}Used`] += days;
    await user.save();
  }

  const request = await LeaveRequest.create({
    user: req.userId,
    type,
    fromDate,
    toDate,
    days,
    reason: reason || '',
    status: 'Approved'
  });

  const fromLabel = new Date(fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const toLabel = new Date(toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  // Leave auto-approves today (no approval workflow yet — see the comment above), so this is a
  // confirmation, not an approval-request notification.
  await notify({
    recipientId: req.userId,
    event: type === 'WFH' ? 'WFH_CREATED' : 'LEAVE_CREATED',
    title: type === 'WFH' ? 'WFH recorded' : `${type} leave recorded`,
    body: `${fromLabel} → ${toLabel} (${days} day${days > 1 ? 's' : ''})`,
    link: '/leave',
    sourceModule: 'LeaveRequest',
    sourceId: request._id
  });
  if (user.reportingManager) {
    await notify({
      recipientId: user.reportingManager,
      event: type === 'WFH' ? 'WFH_CREATED' : 'LEAVE_CREATED',
      title: `${user.name} — ${type === 'WFH' ? 'WFH' : type + ' leave'}`,
      body: `${fromLabel} → ${toLabel} (${days} day${days > 1 ? 's' : ''})`,
      sourceModule: 'LeaveRequest',
      sourceId: request._id
    });
  }

  res.status(201).json({ request, leaveBalance: user.leaveBalance });
});

export default router;
