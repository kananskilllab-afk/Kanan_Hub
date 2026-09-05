import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import User from '../models/User.js';
import Holiday from '../models/Holiday.js';
import Announcement from '../models/Announcement.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Shift from '../models/Shift.js';
import HalfDayLeaveRequest from '../models/HalfDayLeaveRequest.js';
import RegularizationRequest from '../models/RegularizationRequest.js';
import PermissionRequest from '../models/PermissionRequest.js';
import PermissionPolicy from '../models/PermissionPolicy.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import JoiningRecord from '../models/JoiningRecord.js';
import { notify, notifyMany, resolveApprovers } from '../services/notifyService.js';
import { isHRMAdmin } from '../utils/roles.js';
import { requireAuth, requireRole, requireHRMAdmin } from '../middleware/auth.js';
import { computeAttendance, halfDayMinutesFor } from '../services/attendanceEngine.js';

const router = Router();
router.use(requireAuth);

const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');
const upload = multer({
  storage: multer.diskStorage({
    destination: AVATAR_DIR,
    filename: (req, file, cb) => cb(null, `${req.userId}-${Date.now()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
});

function toDirectoryEntry(u) {
  return {
    id: u._id,
    employeeId: u.employeeId,
    name: u.name,
    initials: u.initials,
    avatarUrl: u.avatarUrl,
    designation: u.designation,
    department: u.department,
    branch: u.branch,
    email: u.email,
    joinDate: u.joinDate
  };
}

// ---- Policy versioning helpers (HR Policy Management spec §16-17/§31) ----
// Shared shape: every "policy" below is really a list of dated versions. Resolving "the policy"
// always means picking the most recent version whose effectiveFrom is on or before the date being
// calculated — never just "whatever's most recently saved" — so a change HR makes today never
// silently rewrites how a past (or future-dated) transaction gets calculated.

// All Shift versions, oldest first. There are only ever a handful (HR rarely touches this), so it's
// cheap to fetch in full and resolve dates against it in memory.
async function getShiftVersions() {
  const versions = await Shift.find().sort({ effectiveFrom: 1, createdAt: 1 });
  if (versions.length === 0) return [await Shift.create({ effectiveFrom: new Date(0) })];
  return versions;
}

// Picks the version effective on `dateKey` ('YYYY-MM-DD') from an already-fetched, oldest-first list.
function resolveVersionFor(dateKey, versions) {
  const target = new Date(`${dateKey}T00:00:00`);
  let applicable = versions[0];
  for (const v of versions) {
    if (v.effectiveFrom <= target) applicable = v;
    else break;
  }
  return applicable;
}

// The shift/attendance-policy version effective today — used by every call site that doesn't need
// a specific date (real-time check-in/out, "what's the current policy" admin views, etc).
async function getDefaultShift() {
  return resolveVersionFor(toDateKey(new Date()), await getShiftVersions());
}

// Seed values from the Permission Management spec §4's "General Employee Permission Policy"
// example — HR can edit every value via PUT /permission-policy/:type; nothing here is hard-coded
// into the request/approval/attendance logic itself.
const DEFAULT_PERMISSION_POLICIES = {
  SHORT: { maxDurationMinutes: 120, monthlyRequestLimit: 3 },
  LATE: { maxDurationMinutes: 60, monthlyRequestLimit: 2 },
  EARLY_EXIT: { maxDurationMinutes: 120, monthlyRequestLimit: 2 }
};

// All versions of one permission type, oldest first (auto-seeds the first version if none exist yet).
async function getPermissionPolicyVersions(type) {
  const versions = await PermissionPolicy.find({ type }).sort({ effectiveFrom: 1, createdAt: 1 });
  if (versions.length === 0) {
    return [await PermissionPolicy.create({ type, ...DEFAULT_PERMISSION_POLICIES[type], effectiveFrom: new Date(0) })];
  }
  return versions;
}

async function getAllPermissionPolicyVersions() {
  const byType = {};
  for (const type of Object.keys(DEFAULT_PERMISSION_POLICIES)) {
    byType[type] = await getPermissionPolicyVersions(type);
  }
  return byType;
}

// The policy version effective on `dateKey` (defaults to today) for all 3 types at once.
async function getPermissionPolicies(dateKey) {
  const target = dateKey || toDateKey(new Date());
  const allVersions = await getAllPermissionPolicyVersions();
  const byType = {};
  Object.keys(allVersions).forEach((type) => { byType[type] = resolveVersionFor(target, allVersions[type]); });
  return byType;
}

// Resolves which user's attendance to read: yourself by default, or — via ?employeeId= — another
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

// Shared approval-authorization check: HR/Admin can act on anyone's request; a manager can act on
// their direct reports'. Works for any request doc with a `.user` field (half-day leave, regularization, ...).
async function canActOnUserRequest(approverId, request) {
  const approver = await User.findById(approverId);
  if (isHRMAdmin(approver)) return true;
  const target = await User.findById(request.user);
  return !!target && target.reportingManager && String(target.reportingManager) === String(approverId);
}

// Finds the next upcoming occurrence (this year or next) of a recurring month/day date field,
// e.g. birthdays or work anniversaries, within `withinDays` of today.
function upcomingByMonthDay(users, field, withinDays, { minYears = 0 } = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const results = [];
  for (const u of users) {
    const original = u[field];
    if (!original) continue;

    const next = new Date(original);
    next.setFullYear(today.getFullYear());
    next.setHours(0, 0, 0, 0);
    if (next < today) next.setFullYear(today.getFullYear() + 1);

    const daysUntil = Math.round((next - today) / 86400000);
    if (daysUntil > withinDays) continue;

    const years = next.getFullYear() - new Date(original).getFullYear();
    if (years < minYears) continue;

    results.push({ ...toDirectoryEntry(u), date: next, daysUntil, years: minYears > 0 ? years : undefined });
  }
  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}

// GET /api/hrm/home
router.get('/home', async (req, res) => {
  const me = await User.findById(req.userId).populate('reportingManager', 'name designation initials avatarUrl');
  if (!me) return res.status(404).json({ message: 'User not found' });

  const [myTeam, everyone, holidays, announcements] = await Promise.all([
    User.find({ reportingManager: me._id, employeeStatus: 'ACTIVE' }),
    User.find({ employeeStatus: 'ACTIVE' }),
    Holiday.find({ date: { $gte: new Date() } }).sort({ date: 1 }).limit(5),
    Announcement.find().sort({ createdAt: -1 }).limit(5)
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const newHires = everyone
    .filter((u) => u.joinDate >= thirtyDaysAgo && String(u._id) !== String(me._id))
    .sort((a, b) => b.joinDate - a.joinDate)
    .slice(0, 5)
    .map(toDirectoryEntry);

  const birthdays = upcomingByMonthDay(everyone, 'dateOfBirth', 30).slice(0, 5);
  const anniversaries = upcomingByMonthDay(everyone, 'joinDate', 30, { minYears: 1 }).slice(0, 5);

  res.json({
    profile: {
      ...toDirectoryEntry(me),
      personalEmail: me.personalEmail,
      mobile: me.mobile,
      employmentType: me.employmentType,
      manager: me.reportingManager
    },
    myTeam: myTeam.map(toDirectoryEntry),
    upcomingHolidays: holidays,
    newHires,
    announcements,
    birthdays,
    anniversaries
  });
});

// GET /api/hrm/profile — full profile for the logged-in employee
router.get('/profile', async (req, res) => {
  const me = await User.findById(req.userId).populate('reportingManager', 'name designation initials avatarUrl');
  if (!me) return res.status(404).json({ message: 'User not found' });

  const higherRanked = await User.countDocuments({ kPoints: { $gt: me.kPoints } });

  res.json({
    profile: {
      ...toDirectoryEntry(me),
      personalEmail: me.personalEmail,
      mobile: me.mobile,
      location: me.location,
      employmentType: me.employmentType,
      manager: me.reportingManager,
      kPoints: me.kPoints,
      badgesEarned: me.badgesEarned,
      leaderboardRank: higherRanked + 1
    }
  });
});

// PATCH /api/hrm/profile — self-service edit: only contact details an employee may change themselves.
// Everything else (name, designation, department, branch, employment type, manager, ...) is HR-controlled.
router.patch('/profile', async (req, res) => {
  const { mobile, personalEmail } = req.body;
  const me = await User.findById(req.userId);
  if (!me) return res.status(404).json({ message: 'User not found' });

  if (mobile !== undefined) me.mobile = mobile;
  if (personalEmail !== undefined) me.personalEmail = personalEmail;
  await me.save();

  res.json({
    profile: {
      ...toDirectoryEntry(me),
      personalEmail: me.personalEmail,
      mobile: me.mobile,
      location: me.location,
      employmentType: me.employmentType
    }
  });
});

// POST /api/hrm/profile/photo — upload/replace the logged-in employee's profile photo
router.post('/profile/photo', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Please upload an image file (max 3MB).' });

  const me = await User.findById(req.userId);
  if (!me) return res.status(404).json({ message: 'User not found' });

  const previousUrl = me.avatarUrl;
  me.avatarUrl = `/uploads/avatars/${req.file.filename}`;
  await me.save();

  if (previousUrl) {
    const previousPath = path.join(process.cwd(), previousUrl);
    fs.unlink(previousPath, () => {});
  }

  res.json({ avatarUrl: me.avatarUrl });
});

// GET /api/hrm/organization — company directory, grouped by department. Available to every active employee.
router.get('/organization', async (req, res) => {
  const { q } = req.query;
  const filter = { employeeStatus: 'ACTIVE' };
  if (q) {
    const rx = new RegExp(q, 'i');
    filter.$or = [{ name: rx }, { department: rx }, { designation: rx }, { employeeId: rx }];
  }

  const employees = await User.find(filter).populate('reportingManager', 'name');
  const byDepartment = {};
  for (const u of employees) {
    const dept = u.department || 'Unassigned';
    if (!byDepartment[dept]) byDepartment[dept] = [];
    byDepartment[dept].push({
      ...toDirectoryEntry(u),
      reportingManager: u.reportingManager?.name || null,
      reportingManagerId: u.reportingManager?._id || null
    });
  }

  res.json({ departments: byDepartment, total: employees.length });
});

// GET /api/hrm/birthdays — every active employee with a dateOfBirth on file, ordered by next
// occurrence (wraps into next year once this year's date has passed). Unlike the Home dashboard's
// "Upcoming Birthdays" widget (5 items, 30-day window), this is the full company-wide list for the
// Organization → Birthday Folks tab, so no window/limit is applied — someone whose birthday is
// 300 days away still shows up, just further down the list.
router.get('/birthdays', async (req, res) => {
  const everyone = await User.find({ employeeStatus: 'ACTIVE' });
  const birthdays = upcomingByMonthDay(everyone, 'dateOfBirth', 366);
  res.json({ birthdays });
});

// GET /api/hrm/dashboard-summary — HR/Admin only: org-wide today's attendance + pending HR actions.
// Only reports numbers we can actually compute from real data — no placeholder/fake tiles for
// subsystems that don't exist yet (WFH requests, regularization, overtime, documents, exit, etc.).
router.get('/dashboard-summary', requireHRMAdmin, async (req, res) => {
  const todayKey = toDateKey(new Date());
  const dow = new Date().getDay();
  const isWeeklyOff = dow === 0 || dow === 6;

  const [employees, todaysRecords, holidayToday, todaysHalfLeaves, shift, pendingHalfDay, pendingOnboarding] = await Promise.all([
    User.find({ employeeStatus: 'ACTIVE' }, '_id'),
    Attendance.find({ date: todayKey }),
    Holiday.findOne({ date: { $gte: new Date(`${todayKey}T00:00:00`), $lte: new Date(`${todayKey}T23:59:59`) } }),
    HalfDayLeaveRequest.find({ date: todayKey, status: 'Approved' }),
    getDefaultShift(),
    HalfDayLeaveRequest.countDocuments({ status: 'Pending' }),
    User.countDocuments({ employeeStatus: { $nin: ['ACTIVE', 'CANCELLED'] } })
  ]);
  const isHoliday = !!holidayToday;

  const recordByUser = {};
  todaysRecords.forEach((r) => { recordByUser[String(r.user)] = r; });
  const halfLeaveByUser = {};
  todaysHalfLeaves.forEach((hl) => { halfLeaveByUser[String(hl.user)] = hl.half; });

  const [startH, startM] = shift.startTime.split(':').map(Number);
  const graceMinutes = shift.lateGraceMinutes || 0;

  const counts = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0, MISSING_CHECKOUT: 0, LATE: 0, notYetCheckedIn: 0 };

  if (!isHoliday && !isWeeklyOff) {
    for (const emp of employees) {
      const record = recordByUser[String(emp._id)];
      const checkIn = record?.checkIn || null;
      const checkOut = record?.checkOut || null;

      if (!checkIn) {
        counts.notYetCheckedIn += 1;
        continue;
      }
      if (!checkOut) {
        counts.MISSING_CHECKOUT += 1;
      }

      const checkInDate = new Date(checkIn);
      const shiftStart = new Date(checkInDate);
      shiftStart.setHours(startH, startM + graceMinutes, 0, 0);
      if (checkInDate > shiftStart) counts.LATE += 1;

      if (!checkOut) continue; // day not finished — don't classify into Present/Absent/HalfDay yet

      const evalResult = computeAttendance({ checkIn, checkOut, shift, approvedHalf: halfLeaveByUser[String(emp._id)] || null });
      if (evalResult.status === 'PRESENT') counts.PRESENT += 1;
      else if (evalResult.status === 'HALF_DAY') counts.HALF_DAY += 1;
      else counts.ABSENT += 1;
    }
  }

  res.json({
    totalEmployees: employees.length,
    isHoliday,
    isWeeklyOff,
    today: counts,
    pending: {
      halfDayLeave: pendingHalfDay,
      onboarding: pendingOnboarding
    }
  });
});

// GET /api/hrm/tech-dashboard — TechAdmin-only: system-control view (Tech Admin Dashboard spec).
// Deliberately does NOT report HR operational metrics (present/absent/leave — that's
// dashboard-summary's job, per the spec's own "Most Important Principle"). Every number here is
// computed from real data; sections with no real data source in this app (API/biometric health,
// security/2FA/sessions, error monitoring, scheduler, automation, a dynamic permission engine) are
// left out entirely rather than faked — see the roadmap memory for what's deferred and why.
router.get('/tech-dashboard', requireRole('TechAdmin'), async (req, res) => {
  const [
    totalUsers,
    usersByStatus,
    usersByRole,
    allUsersModuleAccess,
    pendingHalfDay,
    pendingRegularization,
    pendingPermission,
    noManagerCount,
    stuckOnboarding,
    recentAudit,
    recentNotifications
  ] = await Promise.all([
    User.countDocuments(),
    User.aggregate([{ $group: { _id: '$employeeStatus', count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.find({}, 'moduleAccess'),
    HalfDayLeaveRequest.countDocuments({ status: 'Pending' }),
    RegularizationRequest.countDocuments({ status: 'Pending' }),
    PermissionRequest.countDocuments({ status: 'Pending' }),
    User.countDocuments({ employeeStatus: 'ACTIVE', reportingManager: null }),
    User.countDocuments({
      employeeStatus: { $in: ['EMAIL_SENT', 'VERIFICATION_PENDING'] },
      createdAt: { $lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
    }),
    AuditLog.find().sort({ createdAt: -1 }).limit(10).populate('employee', 'name'),
    Notification.find().sort({ createdAt: -1 }).limit(10).populate('recipient', 'name')
  ]);

  // Database health: a real, timed ping — not a canned "healthy" string.
  const dbStart = Date.now();
  let dbStatus = 'CRITICAL';
  let dbResponseMs = null;
  try {
    await mongoose.connection.db.admin().ping();
    dbResponseMs = Date.now() - dbStart;
    dbStatus = 'HEALTHY';
  } catch {
    dbStatus = 'CRITICAL';
  }

  const statusMap = {};
  usersByStatus.forEach((s) => { statusMap[s._id] = s.count; });
  const roleMap = {};
  usersByRole.forEach((r) => { roleMap[r._id] = r.count; });

  const moduleCounts = { mykanan: 0, workhub: 0, growthhub: 0, helpdesk: 0 };
  allUsersModuleAccess.forEach((u) => {
    (u.moduleAccess || []).forEach((m) => {
      if (moduleCounts[m.module] !== undefined) moduleCounts[m.module] += 1;
    });
  });

  const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

  // AuditLog.performedBy is a free-text string — some call sites pass a raw user id instead of a
  // name. Resolve those to a display name here rather than showing a bare ObjectId in the feed.
  const rawIdPerformers = [...new Set(
    recentAudit.map((a) => a.performedBy).filter((p) => /^[0-9a-f]{24}$/i.test(p))
  )];
  const performerNameById = {};
  if (rawIdPerformers.length) {
    const performers = await User.find({ _id: { $in: rawIdPerformers } }, 'name');
    performers.forEach((p) => { performerNameById[String(p._id)] = p.name; });
  }
  const performedByLabel = (performedBy) => performerNameById[performedBy] || performedBy;

  const activity = [
    ...recentAudit.map((a) => ({
      id: `audit-${a._id}`,
      at: a.createdAt,
      text: `${performedByLabel(a.performedBy)} — ${a.action}${a.employee?.name ? ` (${a.employee.name})` : ''}`,
      source: 'Audit'
    })),
    ...recentNotifications.map((n) => ({
      id: `notif-${n._id}`,
      at: n.createdAt,
      text: `Notification → ${n.recipient?.name || 'Unknown'}: ${n.title}`,
      source: 'Notification'
    }))
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 15);

  res.json({
    users: { total: totalUsers, byStatus: statusMap },
    roles: roleMap,
    // "Module access" here means explicit grants recorded on User.moduleAccess — SuperAdmin/
    // TechAdmin bypass this check entirely (see isHRMAdmin), so this counts non-blanket-privileged
    // employees only, i.e. real per-module grants, not a claim about who "has access" overall.
    moduleAccess: moduleCounts,
    systemHealth: {
      database: { status: dbStatus, responseMs: dbResponseMs },
      applicationServer: { status: 'HEALTHY', detail: 'Responding (this request)' },
      email: {
        status: smtpConfigured ? 'CONNECTED' : 'STUB_MODE',
        detail: smtpConfigured ? 'Gmail SMTP' : 'No SMTP credentials configured — emails are logged to console only'
      }
    },
    workflow: {
      pendingHalfDayLeave: pendingHalfDay,
      pendingRegularization,
      pendingPermission
    },
    configAlerts: {
      noReportingManager: noManagerCount,
      stuckOnboarding
    },
    recentActivity: activity
  });
});

// GET /api/hrm/shift — today's effective shift/attendance policy version
router.get('/shift', async (req, res) => {
  const shift = await getDefaultShift();
  res.json({ shift, halfDayMinutes: halfDayMinutesFor(shift.requiredMinutes) });
});

// GET /api/hrm/shift/history — every version, newest first (Policy Versioning spec §17)
// HR Settings is TechAdmin-exclusive (Revised HRM Role Hierarchy §1/§5) — SuperAdmin no longer
// reaches shift/permission-policy config, even though it can still read GET /shift and
// GET /permission-policy's plain "current" values (those stay open to any authenticated user —
// they're informational, used across Attendance/half-day-leave/permission validation).
router.get('/shift/history', requireRole('TechAdmin'), async (req, res) => {
  const versions = await Shift.find().sort({ effectiveFrom: -1, createdAt: -1 }).populate('createdBy', 'name');
  res.json({ versions });
});

// PUT /api/hrm/shift — TechAdmin-exclusive: creates a NEW version effective from the given date,
// rather than overwriting the current one in place (Policy Versioning spec §16-17/§31 — past days
// keep using whatever was active at the time; see getShiftVersions/resolveVersionFor and
// GET /attendance's per-day resolution).
router.put('/shift', requireRole('TechAdmin'), async (req, res) => {
  const {
    name, startTime, endTime, requiredMinutes, breakMinutes, breakPolicy,
    halfDayLeaveEnabled, firstHalfEnabled, secondHalfEnabled, effectiveFrom, changeSummary
  } = req.body;
  const current = await getDefaultShift();
  const from = effectiveFrom || toDateKey(new Date());
  const shift = await Shift.create({
    name: name !== undefined ? name : current.name,
    startTime: startTime !== undefined ? startTime : current.startTime,
    endTime: endTime !== undefined ? endTime : current.endTime,
    requiredMinutes: requiredMinutes !== undefined ? Number(requiredMinutes) : current.requiredMinutes,
    breakMinutes: breakMinutes !== undefined ? Number(breakMinutes) : current.breakMinutes,
    breakPolicy: breakPolicy !== undefined ? breakPolicy : current.breakPolicy,
    lateGraceMinutes: current.lateGraceMinutes,
    earlyCheckoutGraceMinutes: current.earlyCheckoutGraceMinutes,
    halfDayLeaveEnabled: halfDayLeaveEnabled !== undefined ? halfDayLeaveEnabled : current.halfDayLeaveEnabled,
    firstHalfEnabled: firstHalfEnabled !== undefined ? firstHalfEnabled : current.firstHalfEnabled,
    secondHalfEnabled: secondHalfEnabled !== undefined ? secondHalfEnabled : current.secondHalfEnabled,
    effectiveFrom: new Date(`${from}T00:00:00`),
    createdBy: req.userId,
    changeSummary: changeSummary || ''
  });
  res.json({ shift, halfDayMinutes: halfDayMinutesFor(shift.requiredMinutes) });
});

// POST /api/hrm/half-day-leave — employee applies for a half-day (spec section 12: must be approved before it affects attendance)
router.post('/half-day-leave', async (req, res) => {
  const { date, half, reason } = req.body;
  if (!date || !['FIRST_HALF', 'SECOND_HALF'].includes(half)) {
    return res.status(400).json({ message: 'date and a valid half (FIRST_HALF/SECOND_HALF) are required.' });
  }
  const shift = await getDefaultShift();
  if (!shift.halfDayLeaveEnabled) return res.status(400).json({ message: 'Half-day leave is not enabled for your shift.' });
  if (half === 'FIRST_HALF' && !shift.firstHalfEnabled) return res.status(400).json({ message: 'First-half leave is not enabled.' });
  if (half === 'SECOND_HALF' && !shift.secondHalfEnabled) return res.status(400).json({ message: 'Second-half leave is not enabled.' });

  try {
    const request = await HalfDayLeaveRequest.create({ user: req.userId, date, half, reason: reason || '' });
    const me = await User.findById(req.userId, 'name');
    await notifyMany(await resolveApprovers(req.userId), {
      event: 'HALF_DAY_LEAVE_CREATED',
      title: `${me.name} — Half-Day Leave`,
      body: `${date} · ${half === 'FIRST_HALF' ? 'First Half' : 'Second Half'}${reason ? ` — ${reason}` : ''}`,
      link: '/attendance',
      sourceModule: 'HalfDayLeaveRequest',
      sourceId: request._id
    });
    res.status(201).json({ request });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'You already have a half-day leave request for this date.' });
    throw err;
  }
});

// GET /api/hrm/half-day-leave?all=true — own requests, or (for HR/Admin/managers) requests awaiting their approval
router.get('/half-day-leave', async (req, res) => {
  let filter;
  if (req.query.all === 'true') {
    const me = await User.findById(req.userId);
    if (isHRMAdmin(me)) {
      filter = {};
    } else {
      const reports = await User.find({ reportingManager: req.userId }, '_id');
      filter = { user: { $in: reports.map((r) => r._id) } };
    }
  } else {
    filter = { user: req.userId };
  }
  const requests = await HalfDayLeaveRequest.find(filter).sort({ createdAt: -1 }).populate('user', 'name employeeId initials');
  res.json({ requests });
});

router.patch('/half-day-leave/:id/approve', async (req, res) => {
  const request = await HalfDayLeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (!(await canActOnUserRequest(req.userId, request))) return res.status(403).json({ message: 'You cannot approve this request.' });
  request.status = 'Approved';
  request.approvedBy = req.userId;
  await request.save();
  await notify({
    recipientId: request.user, event: 'HALF_DAY_LEAVE_APPROVED', title: 'Half-Day Leave Approved',
    body: `${request.date} · ${request.half === 'FIRST_HALF' ? 'First Half' : 'Second Half'}`,
    link: '/attendance', sourceModule: 'HalfDayLeaveRequest', sourceId: request._id
  });
  res.json({ request });
});

router.patch('/half-day-leave/:id/reject', async (req, res) => {
  const request = await HalfDayLeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (!(await canActOnUserRequest(req.userId, request))) return res.status(403).json({ message: 'You cannot reject this request.' });
  request.status = 'Rejected';
  request.approvedBy = req.userId;
  await request.save();
  await notify({
    recipientId: request.user, event: 'HALF_DAY_LEAVE_REJECTED', title: 'Half-Day Leave Rejected',
    body: `${request.date} · ${request.half === 'FIRST_HALF' ? 'First Half' : 'Second Half'}`,
    link: '/attendance', sourceModule: 'HalfDayLeaveRequest', sourceId: request._id
  });
  res.json({ request });
});

// POST /api/hrm/regularization — request a correction to a day's attendance (e.g. missing checkout,
// wrong punch time). The original raw punch is never overwritten — see GET /attendance, which
// applies an approved regularization's times on top of the raw record only when computing status.
router.post('/regularization', async (req, res) => {
  const { date, requestedCheckIn, requestedCheckOut, reason } = req.body;
  if (!date || !reason) return res.status(400).json({ message: 'date and reason are required.' });
  if (!requestedCheckIn && !requestedCheckOut) {
    return res.status(400).json({ message: 'Provide at least a requested check-in or check-out time.' });
  }

  const existing = await Attendance.findOne({ user: req.userId, date });

  const request = await RegularizationRequest.create({
    user: req.userId,
    date,
    originalCheckIn: existing?.checkIn || null,
    originalCheckOut: existing?.checkOut || null,
    requestedCheckIn: requestedCheckIn ? new Date(`${date}T${requestedCheckIn}:00`) : null,
    requestedCheckOut: requestedCheckOut ? new Date(`${date}T${requestedCheckOut}:00`) : null,
    reason
  });

  const me = await User.findById(req.userId, 'name');
  await notifyMany(await resolveApprovers(req.userId), {
    event: 'REGULARIZATION_CREATED',
    title: `${me.name} — Attendance Regularization`,
    body: `${date} — ${reason}`,
    link: '/attendance',
    sourceModule: 'RegularizationRequest',
    sourceId: request._id
  });

  res.status(201).json({ request });
});

// GET /api/hrm/regularization?all=true — own requests, or (for HR/Admin/managers) requests awaiting approval
router.get('/regularization', async (req, res) => {
  let filter;
  if (req.query.all === 'true') {
    const me = await User.findById(req.userId);
    if (isHRMAdmin(me)) {
      filter = {};
    } else {
      const reports = await User.find({ reportingManager: req.userId }, '_id');
      filter = { user: { $in: reports.map((r) => r._id) } };
    }
  } else {
    filter = { user: req.userId };
  }
  const requests = await RegularizationRequest.find(filter).sort({ createdAt: -1 }).populate('user', 'name employeeId initials');
  res.json({ requests });
});

router.patch('/regularization/:id/approve', async (req, res) => {
  const request = await RegularizationRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (!(await canActOnUserRequest(req.userId, request))) return res.status(403).json({ message: 'You cannot approve this request.' });
  request.status = 'Approved';
  request.approvedBy = req.userId;
  await request.save();
  await notify({
    recipientId: request.user, event: 'REGULARIZATION_APPROVED', title: 'Attendance Regularization Approved',
    body: request.date, link: '/attendance', sourceModule: 'RegularizationRequest', sourceId: request._id
  });
  res.json({ request });
});

router.patch('/regularization/:id/reject', async (req, res) => {
  const request = await RegularizationRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (!(await canActOnUserRequest(req.userId, request))) return res.status(403).json({ message: 'You cannot reject this request.' });
  request.status = 'Rejected';
  request.approvedBy = req.userId;
  await request.save();
  await notify({
    recipientId: request.user, event: 'REGULARIZATION_REJECTED', title: 'Attendance Regularization Rejected',
    body: request.date, link: '/attendance', sourceModule: 'RegularizationRequest', sourceId: request._id
  });
  res.json({ request });
});

// ---- Permission Management (Short / Late Check-In / Early Check-Out) ----
// Spec: an employee never directly edits attendance — they request a permission, it goes through
// approval, and only an *approved* permission can adjust what the attendance engine credits
// (see computeAttendance's permissionAdjustmentMinutes and GET /attendance below).

// GET /api/hrm/permission-policy — the 3 types' effective-today versions (auto-seeded with spec §4's example values on first read)
router.get('/permission-policy', async (req, res) => {
  const byType = await getPermissionPolicies();
  res.json({ policies: Object.values(byType) });
});

// GET /api/hrm/permission-policy/:type/history — every version of one type, newest first (TechAdmin-exclusive)
router.get('/permission-policy/:type/history', requireRole('TechAdmin'), async (req, res) => {
  const { type } = req.params;
  if (!DEFAULT_PERMISSION_POLICIES[type]) return res.status(400).json({ message: 'Unknown permission type.' });
  const versions = await PermissionPolicy.find({ type }).sort({ effectiveFrom: -1, createdAt: -1 }).populate('createdBy', 'name');
  res.json({ versions });
});

// PUT /api/hrm/permission-policy/:type — TechAdmin-exclusive. Creates a NEW version effective from
// the given date rather than overwriting the current one (see the versioning helpers above).
router.put('/permission-policy/:type', requireRole('TechAdmin'), async (req, res) => {
  const { type } = req.params;
  if (!DEFAULT_PERMISSION_POLICIES[type]) return res.status(400).json({ message: 'Unknown permission type.' });
  const { maxDurationMinutes, monthlyRequestLimit, countsAsWorkingTime, enabled, effectiveFrom, changeSummary } = req.body;
  const current = (await getPermissionPolicies())[type];
  const from = effectiveFrom || toDateKey(new Date());
  const policy = await PermissionPolicy.create({
    type,
    maxDurationMinutes: maxDurationMinutes !== undefined ? Number(maxDurationMinutes) : current.maxDurationMinutes,
    monthlyRequestLimit: monthlyRequestLimit !== undefined ? Number(monthlyRequestLimit) : current.monthlyRequestLimit,
    countsAsWorkingTime: countsAsWorkingTime !== undefined ? countsAsWorkingTime : current.countsAsWorkingTime,
    enabled: enabled !== undefined ? enabled : current.enabled,
    effectiveFrom: new Date(`${from}T00:00:00`),
    createdBy: req.userId,
    changeSummary: changeSummary || ''
  });
  res.json({ policy });
});

// POST /api/hrm/permission — apply for Short / Late / Early-Exit permission
router.post('/permission', async (req, res) => {
  const { type, date, outTime, returnTime, requestedTime, reason } = req.body;
  if (!type || !date || !reason) return res.status(400).json({ message: 'type, date and reason are required.' });
  if (!DEFAULT_PERMISSION_POLICIES[type]) return res.status(400).json({ message: 'Unknown permission type.' });

  // Resolved against the request's own date, not "today" — a permission requested for a future
  // date should be judged against whatever policy will actually be effective then (spec §16).
  const policies = await getPermissionPolicies(date);
  const policy = policies[type];
  if (!policy.enabled) return res.status(400).json({ message: 'This permission type is currently disabled.' });

  const shift = resolveVersionFor(date, await getShiftVersions());
  let durationMinutes;
  let doc = { type, date, reason, outTime: null, returnTime: null, requestedTime: null };

  if (type === 'SHORT') {
    if (!outTime || !returnTime) return res.status(400).json({ message: 'Out time and expected return time are required.' });
    const out = new Date(`${date}T${outTime}:00`);
    const ret = new Date(`${date}T${returnTime}:00`);
    durationMinutes = Math.round((ret - out) / 60000);
    if (durationMinutes <= 0) return res.status(400).json({ message: 'Return time must be after out time.' });
    doc.outTime = out;
    doc.returnTime = ret;
  } else if (type === 'LATE') {
    if (!requestedTime) return res.status(400).json({ message: 'Expected arrival time is required.' });
    const shiftStart = new Date(`${date}T${shift.startTime}:00`);
    const arrival = new Date(`${date}T${requestedTime}:00`);
    durationMinutes = Math.round((arrival - shiftStart) / 60000);
    if (durationMinutes <= 0) return res.status(400).json({ message: 'Expected arrival must be after shift start.' });
    doc.requestedTime = arrival;
  } else {
    if (!requestedTime) return res.status(400).json({ message: 'Expected exit time is required.' });
    const shiftEnd = new Date(`${date}T${shift.endTime}:00`);
    const exit = new Date(`${date}T${requestedTime}:00`);
    durationMinutes = Math.round((shiftEnd - exit) / 60000);
    if (durationMinutes <= 0) return res.status(400).json({ message: 'Expected exit must be before shift end.' });
    doc.requestedTime = exit;
  }

  if (durationMinutes > policy.maxDurationMinutes) {
    return res.status(400).json({
      message: `Exceeds the maximum ${type.toLowerCase().replace('_', ' ')} permission duration of ${Math.floor(policy.maxDurationMinutes / 60)}h ${policy.maxDurationMinutes % 60}m for a single request.`
    });
  }

  const request = await PermissionRequest.create({ user: req.userId, durationMinutes, ...doc });
  const me = await User.findById(req.userId, 'name');
  await notifyMany(await resolveApprovers(req.userId), {
    event: 'PERMISSION_CREATED',
    title: `${me.name} — ${CALENDAR_PERMISSION_LABEL[type]}`,
    body: `${date} — ${reason}`,
    link: '/attendance',
    sourceModule: 'PermissionRequest',
    sourceId: request._id
  });
  res.status(201).json({ request });
});

// GET /api/hrm/permission?all=true — own requests, or (for HR/Admin/managers) requests awaiting approval
router.get('/permission', async (req, res) => {
  let filter;
  if (req.query.all === 'true') {
    const me = await User.findById(req.userId);
    if (isHRMAdmin(me)) {
      filter = {};
    } else {
      const reports = await User.find({ reportingManager: req.userId }, '_id');
      filter = { user: { $in: reports.map((r) => r._id) } };
    }
  } else {
    filter = { user: req.userId };
  }
  const requests = await PermissionRequest.find(filter).sort({ createdAt: -1 }).populate('user', 'name employeeId initials');
  res.json({ requests });
});

router.patch('/permission/:id/approve', async (req, res) => {
  const request = await PermissionRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (!(await canActOnUserRequest(req.userId, request))) return res.status(403).json({ message: 'You cannot approve this request.' });
  request.status = 'Approved';
  request.approvedBy = req.userId;
  await request.save();
  await notify({
    recipientId: request.user, event: 'PERMISSION_APPROVED', title: `${CALENDAR_PERMISSION_LABEL[request.type]} Approved`,
    body: request.date, link: '/attendance', sourceModule: 'PermissionRequest', sourceId: request._id
  });
  res.json({ request });
});

router.patch('/permission/:id/reject', async (req, res) => {
  const request = await PermissionRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (!(await canActOnUserRequest(req.userId, request))) return res.status(403).json({ message: 'You cannot reject this request.' });
  request.status = 'Rejected';
  request.approvedBy = req.userId;
  await request.save();
  await notify({
    recipientId: request.user, event: 'PERMISSION_REJECTED', title: `${CALENDAR_PERMISSION_LABEL[request.type]} Rejected`,
    body: request.date, link: '/attendance', sourceModule: 'PermissionRequest', sourceId: request._id
  });
  res.json({ request });
});

// Local-calendar-day key ('YYYY-MM-DD') — deliberately NOT toISOString(), which is UTC and would
// shift the date by the server's UTC offset (e.g. always a day behind in IST).
function toDateKey(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

// Sunday-to-Saturday week containing the given 'YYYY-MM-DD' (or today if omitted).
function weekRange(anchorKey) {
  const anchor = anchorKey ? new Date(`${anchorKey}T00:00:00`) : new Date();
  const sunday = new Date(anchor);
  sunday.setDate(anchor.getDate() - anchor.getDay());
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return { from: toDateKey(sunday), to: toDateKey(saturday) };
}

// If month/day (dob, joinDate, ...) falls within [from,to] (inclusive, local dates), returns that
// occurrence's date key for whichever year in the range it lands on; otherwise null. Used for
// recurring calendar events (birthdays, work anniversaries).
function occurrenceInRange(original, from, to) {
  const fromD = new Date(`${from}T00:00:00`);
  const toD = new Date(`${to}T00:00:00`);
  for (let y = fromD.getFullYear(); y <= toD.getFullYear(); y++) {
    const occ = new Date(y, original.getMonth(), original.getDate());
    occ.setHours(0, 0, 0, 0);
    if (occ >= fromD && occ <= toD) return toDateKey(occ);
  }
  return null;
}

function ordinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

const CALENDAR_PERMISSION_LABEL = { SHORT: 'Short Permission', LATE: 'Late Check-In', EARLY_EXIT: 'Early Check-Out' };

// GET /api/hrm/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&department=&branch=&type=HOLIDAY,LEAVE,...
// Pure aggregation/view layer (HR Calendar spec §20/§30) — every event is pulled live from its
// owning module (Holiday, LeaveRequest, HalfDayLeaveRequest, PermissionRequest, User) at request
// time. Nothing here is stored separately, so the calendar can never drift from the source data.
// HR/Admin only for now — see roadmap memory for the deferred employee-facing / manager-team views.
router.get('/calendar', requireHRMAdmin, async (req, res) => {
  const { from, to, department, branch } = req.query;
  if (!from || !to) return res.status(400).json({ message: 'from and to are required.' });
  const typeFilter = req.query.type ? req.query.type.split(',') : null;
  const includes = (t) => !typeFilter || typeFilter.includes(t);

  const userFilter = {};
  if (department) userFilter.department = department;
  if (branch) userFilter.branch = branch;

  const fromD = new Date(`${from}T00:00:00`);
  const toD = new Date(`${to}T23:59:59`);

  const users = await User.find(userFilter, 'name department branch designation dateOfBirth joinDate employeeId');
  const userById = {};
  users.forEach((u) => { userById[String(u._id)] = u; });
  const userIds = users.map((u) => u._id);

  const empBrief = (u) => ({ id: u._id, name: u.name, department: u.department, branch: u.branch, designation: u.designation });

  const events = [];

  if (includes('HOLIDAY')) {
    const holidays = await Holiday.find({ date: { $gte: fromD, $lte: toD } });
    holidays.forEach((h) => {
      events.push({
        id: `HOLIDAY-${h._id}`, type: 'HOLIDAY', date: toDateKey(h.date), title: h.name,
        employee: null, status: null, sourceModule: 'Holiday', sourceId: h._id,
        detail: { name: h.name }
      });
    });
  }

  if (includes('LEAVE') || includes('WFH')) {
    const leaves = await LeaveRequest.find({
      user: { $in: userIds }, status: 'Approved', fromDate: { $lte: toD }, toDate: { $gte: fromD }
    });
    leaves.forEach((lv) => {
      const u = userById[String(lv.user)];
      if (!u) return;
      const evType = lv.type === 'WFH' ? 'WFH' : 'LEAVE';
      if (!includes(evType)) return;
      const cursor = new Date(Math.max(lv.fromDate, fromD));
      const end = new Date(Math.min(lv.toDate, toD));
      while (cursor <= end) {
        const dateKey = toDateKey(cursor);
        events.push({
          id: `${evType}-${lv._id}-${dateKey}`, type: evType, date: dateKey,
          title: evType === 'WFH' ? `${u.name} — WFH` : `${u.name} — ${lv.type}`,
          employee: empBrief(u), status: lv.status, sourceModule: 'LeaveRequest', sourceId: lv._id,
          detail: { leaveType: lv.type, fromDate: lv.fromDate, toDate: lv.toDate, days: lv.days, reason: lv.reason, status: lv.status }
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    });
  }

  if (includes('HALF_DAY_LEAVE')) {
    const halfDays = await HalfDayLeaveRequest.find({ user: { $in: userIds }, status: 'Approved', date: { $gte: from, $lte: to } });
    halfDays.forEach((hd) => {
      const u = userById[String(hd.user)];
      if (!u) return;
      events.push({
        id: `HALF_DAY_LEAVE-${hd._id}`, type: 'HALF_DAY_LEAVE', date: hd.date,
        title: `${u.name} — ${hd.half === 'FIRST_HALF' ? 'First Half Leave' : 'Second Half Leave'}`,
        employee: empBrief(u), status: hd.status, sourceModule: 'HalfDayLeaveRequest', sourceId: hd._id,
        detail: { half: hd.half, reason: hd.reason, status: hd.status }
      });
    });
  }

  if (includes('PERMISSION')) {
    const perms = await PermissionRequest.find({ user: { $in: userIds }, status: 'Approved', date: { $gte: from, $lte: to } });
    perms.forEach((p) => {
      const u = userById[String(p.user)];
      if (!u) return;
      events.push({
        id: `PERMISSION-${p._id}`, type: 'PERMISSION', date: p.date,
        title: `${u.name} — ${CALENDAR_PERMISSION_LABEL[p.type]}`,
        employee: empBrief(u), status: p.status, sourceModule: 'PermissionRequest', sourceId: p._id,
        detail: { permissionType: p.type, durationMinutes: p.durationMinutes, reason: p.reason, status: p.status }
      });
    });
  }

  if (includes('JOINING')) {
    users.forEach((u) => {
      if (!u.joinDate) return;
      const jd = new Date(u.joinDate);
      jd.setHours(0, 0, 0, 0);
      if (jd >= fromD && jd <= toD) {
        events.push({
          id: `JOINING-${u._id}`, type: 'JOINING', date: toDateKey(jd),
          title: `${u.name} — New Joiner`, employee: empBrief(u), status: null,
          sourceModule: 'User', sourceId: u._id, detail: { joinDate: u.joinDate }
        });
      }
    });
  }

  if (includes('BIRTHDAY')) {
    users.forEach((u) => {
      if (!u.dateOfBirth) return;
      const dateKey = occurrenceInRange(new Date(u.dateOfBirth), from, to);
      if (dateKey) {
        events.push({
          id: `BIRTHDAY-${u._id}-${dateKey}`, type: 'BIRTHDAY', date: dateKey,
          title: `🎂 ${u.name} — Birthday`, employee: empBrief(u), status: null,
          sourceModule: 'User', sourceId: u._id, detail: {}
        });
      }
    });
  }

  if (includes('ANNIVERSARY')) {
    users.forEach((u) => {
      if (!u.joinDate) return;
      const jd = new Date(u.joinDate);
      const dateKey = occurrenceInRange(jd, from, to);
      if (dateKey) {
        const years = Number(dateKey.slice(0, 4)) - jd.getFullYear();
        if (years >= 1) {
          events.push({
            id: `ANNIVERSARY-${u._id}-${dateKey}`, type: 'ANNIVERSARY', date: dateKey,
            title: `🎉 ${u.name} — ${ordinal(years)} Work Anniversary`, employee: empBrief(u), status: null,
            sourceModule: 'User', sourceId: u._id, detail: { years }
          });
        }
      }
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  res.json({ from, to, events });
});

// GET /api/hrm/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD — runs every day in the range through the
// attendance engine. Defaults to the Sunday-Saturday week containing today if from/to are omitted.
router.get('/attendance', async (req, res) => {
  const targetId = await resolveViewTarget(req);
  if (!targetId) return res.status(403).json({ message: 'You cannot view this employee’s attendance.' });

  const { from, to } = req.query.from && req.query.to ? { from: req.query.from, to: req.query.to } : weekRange();

  const [records, holidays, halfLeaves, regularizations, permissions, allPolicyVersions, shiftVersions] = await Promise.all([
    Attendance.find({ user: targetId, date: { $gte: from, $lte: to } }).sort({ date: 1 }),
    Holiday.find({ date: { $gte: new Date(`${from}T00:00:00`), $lte: new Date(`${to}T23:59:59`) } }),
    HalfDayLeaveRequest.find({ user: targetId, date: { $gte: from, $lte: to }, status: 'Approved' }),
    RegularizationRequest.find({ user: targetId, date: { $gte: from, $lte: to }, status: 'Approved' }),
    PermissionRequest.find({ user: targetId, date: { $gte: from, $lte: to }, status: 'Approved' }),
    getAllPermissionPolicyVersions(),
    getShiftVersions()
  ]);
  // Every day (and every permission) resolves its OWN applicable policy version below — never "the
  // current one" — so a policy change HR makes today never recalculates a past or future day.
  const shift = resolveVersionFor(to, shiftVersions);

  const recordByDate = {};
  records.forEach((r) => { recordByDate[r.date] = r; });
  const holidayByDate = {};
  holidays.forEach((h) => { holidayByDate[toDateKey(h.date)] = h.name; });
  const halfLeaveByDate = {};
  halfLeaves.forEach((hl) => { halfLeaveByDate[hl.date] = hl.half; });
  const regByDate = {};
  regularizations.forEach((r) => { regByDate[r.date] = r; });

  // Group approved permissions per day, and fold each into a single signed adjustment (spec §15):
  // Short Permission subtracts its gap unless policy says it counts as working time; Late/Early-Exit
  // add credit only if policy says it counts. Also keep the raw list per day for the UI badge.
  const permissionsByDate = {};
  const permissionAdjustmentByDate = {};
  permissions.forEach((p) => {
    const policy = resolveVersionFor(p.date, allPolicyVersions[p.type]);
    let adjustment = 0;
    if (policy?.countsAsWorkingTime) {
      adjustment = p.type === 'SHORT' ? 0 : p.durationMinutes;
    } else {
      adjustment = p.type === 'SHORT' ? -p.durationMinutes : 0;
    }
    permissionAdjustmentByDate[p.date] = (permissionAdjustmentByDate[p.date] || 0) + adjustment;
    (permissionsByDate[p.date] = permissionsByDate[p.date] || []).push({
      type: p.type,
      durationMinutes: p.durationMinutes,
      countsAsWorkingTime: !!policy?.countsAsWorkingTime
    });
  });

  const todayKey = toDateKey(new Date());

  const days = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end) {
    const dateKey = toDateKey(cursor);
    const dow = cursor.getDay(); // 0=Sun, 6=Sat
    const record = recordByDate[dateKey];
    const reg = regByDate[dateKey];
    const rawCheckIn = record?.checkIn || null;
    const rawCheckOut = record?.checkOut || null;
    // An approved regularization overrides the punch used for status/hours calculation — the raw
    // transaction itself is never modified (rawCheckIn/rawCheckOut always reflect the real punch).
    const checkIn = reg?.requestedCheckIn || rawCheckIn;
    const checkOut = reg?.requestedCheckOut || rawCheckOut;

    let entry;
    if (holidayByDate[dateKey]) {
      entry = { status: 'HOLIDAY', reason: 'NORMAL', minutesWorked: null, label: holidayByDate[dateKey] };
    } else if (dow === 0 || dow === 6) {
      entry = { status: 'WEEKLY_OFF', reason: 'NORMAL', minutesWorked: null };
    } else if (dateKey > todayKey) {
      entry = { status: 'PENDING', reason: null, minutesWorked: null, label: 'Upcoming' };
    } else if (dateKey === todayKey && !checkIn) {
      entry = { status: 'PENDING', reason: null, minutesWorked: null };
    } else if (dateKey === todayKey && checkIn && !checkOut) {
      entry = { status: 'IN_PROGRESS', reason: null, minutesWorked: null };
    } else {
      const dayShift = resolveVersionFor(dateKey, shiftVersions);
      entry = computeAttendance({
        checkIn,
        checkOut,
        shift: dayShift,
        approvedHalf: halfLeaveByDate[dateKey] || null,
        permissionAdjustmentMinutes: permissionAdjustmentByDate[dateKey] || 0
      });
      // Keep the record's cached snapshot in sync now that we've (re)evaluated a completed day.
      // Only sync from the raw punch (not a regularization or permission-credited override) so the
      // cache always reflects what actually happened, even though the response below uses the
      // adjusted entry.
      if (
        record && !reg && !permissionAdjustmentByDate[dateKey] &&
        (record.status !== entry.status || record.reason !== entry.reason || record.minutesWorked !== entry.minutesWorked)
      ) {
        record.status = entry.status;
        record.reason = entry.reason;
        record.minutesWorked = entry.minutesWorked;
        await record.save();
      }
    }

    if (reg) entry.regularized = true;
    if (permissionsByDate[dateKey]) entry.permissions = permissionsByDate[dateKey];
    days.push({ date: dateKey, checkIn, checkOut, rawCheckIn, rawCheckOut, ...entry });
    cursor.setDate(cursor.getDate() + 1);
  }

  const summary = { PRESENT: 0, HALF_DAY: 0, ABSENT: 0, LEAVE: 0, HOLIDAY: 0, WEEKLY_OFF: 0, WFH: 0, ON_DUTY: 0 };
  days.forEach((d) => { if (summary[d.status] !== undefined) summary[d.status] += 1; });

  const today = days.find((d) => d.date === todayKey) || null;

  res.json({ from, to, records, summary, today, shift, halfDayMinutes: halfDayMinutesFor(shift.requiredMinutes), days });
});

// POST /api/hrm/attendance/checkin
router.post('/attendance/checkin', async (req, res) => {
  const todayKey = toDateKey(new Date());
  const record = await Attendance.findOneAndUpdate(
    { user: req.userId, date: todayKey },
    { $setOnInsert: { user: req.userId, date: todayKey, checkIn: new Date() } },
    { upsert: true, new: true }
  );
  res.json({ record });
});

// POST /api/hrm/attendance/checkout — evaluates the attendance engine immediately
router.post('/attendance/checkout', async (req, res) => {
  const todayKey = toDateKey(new Date());
  const record = await Attendance.findOne({ user: req.userId, date: todayKey });
  if (!record) return res.status(400).json({ message: 'You have not checked in today yet.' });
  if (record.checkOut) return res.status(400).json({ message: 'You have already checked out today.' });

  record.checkOut = new Date();

  const [shift, halfLeave] = await Promise.all([
    getDefaultShift(),
    HalfDayLeaveRequest.findOne({ user: req.userId, date: todayKey, status: 'Approved' })
  ]);
  const evaluation = computeAttendance({ checkIn: record.checkIn, checkOut: record.checkOut, shift, approvedHalf: halfLeave?.half || null });
  record.status = evaluation.status;
  record.reason = evaluation.reason;
  record.minutesWorked = evaluation.minutesWorked;
  await record.save();

  res.json({ record, evaluation });
});

// ---- Joining List (Kanan Recruit spec §10-13) ----
// "This list belongs to HRM, not Recruit." Populated automatically when a Recruit offer is
// accepted (routes/recruit.js) — HR Admin turns each entry into a real onboarding record via the
// EXISTING employee-creation flow (POST /employees), then links it here rather than duplicating
// status. requireHRMAdmin, not requireModuleAccess('recruit') — Recruit team never sees this list.

// GET /api/hrm/joining-list — not-yet-onboarded entries first, then linked ones with their real employeeStatus
router.get('/joining-list', requireHRMAdmin, async (req, res) => {
  const records = await JoiningRecord.find()
    .sort({ joiningDate: 1 })
    .populate('reportingManager', 'name')
    .populate('linkedEmployee', 'name employeeId employeeStatus accountStatus emailVerified welcomeEmailStatus');
  res.json({ records });
});

// PATCH /api/hrm/joining-list/:id/link — called after HR successfully creates the real employee
// record via POST /employees, so this list reflects that record's live status from then on.
router.patch('/joining-list/:id/link', requireHRMAdmin, async (req, res) => {
  const { employeeId } = req.body;
  if (!employeeId) return res.status(400).json({ message: 'employeeId is required.' });

  const record = await JoiningRecord.findById(req.params.id);
  if (!record) return res.status(404).json({ message: 'Joining record not found' });

  record.linkedEmployee = employeeId;
  record.status = 'Onboarding Started';
  await record.save();
  res.json({ record });
});

export default router;
