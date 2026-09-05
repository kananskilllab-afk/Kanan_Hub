import { Router } from 'express';
import User, { MODULE_ACCESS_KEYS } from '../models/User.js';
import EmployeeVerification from '../models/EmployeeVerification.js';
import AuditLog from '../models/AuditLog.js';
import { requireAuth, requireRole, requireHRMAdmin } from '../middleware/auth.js';
import { generateVerificationToken } from '../utils/token.js';
import { sendWelcomeEmail } from '../services/emailService.js';

const router = Router();
router.use(requireAuth, requireHRMAdmin);

async function logAudit(employeeId, action, performedBy, meta = {}) {
  await AuditLog.create({ employee: employeeId, action, performedBy, meta });
}

function toEmployeeSummary(u) {
  return {
    id: u._id,
    employeeId: u.employeeId,
    name: u.name,
    firstName: u.firstName,
    lastName: u.lastName,
    mobile: u.mobile,
    email: u.email,
    personalEmail: u.personalEmail,
    department: u.department,
    designation: u.designation,
    branch: u.branch,
    joinDate: u.joinDate,
    reportingManager: u.reportingManager,
    employmentType: u.employmentType,
    employeeStatus: u.employeeStatus,
    accountStatus: u.accountStatus,
    emailVerified: u.emailVerified,
    emailCreationStatus: u.emailCreationStatus,
    welcomeEmailStatus: u.welcomeEmailStatus,
    role: u.role,
    moduleAccess: u.moduleAccess,
    createdAt: u.createdAt
  };
}

// GET /api/employees — HR onboarding dashboard / directory list, with optional filters
router.get('/', async (req, res) => {
  const { q, department, designation, branch, status, employmentType } = req.query;
  const filter = {};
  if (department) filter.department = department;
  if (designation) filter.designation = designation;
  if (branch) filter.branch = branch;
  if (status) filter.employeeStatus = status;
  if (employmentType) filter.employmentType = employmentType;
  if (q) {
    const rx = new RegExp(q, 'i');
    filter.$or = [{ name: rx }, { employeeId: rx }, { email: rx }];
  }

  const employees = await User.find(filter).sort({ createdAt: -1 }).populate('reportingManager', 'name');
  res.json({ employees: employees.map(toEmployeeSummary) });
});

// GET /api/employees/filter-options — distinct values to populate Directory filter dropdowns
router.get('/filter-options', async (req, res) => {
  const [departments, designations, branches] = await Promise.all([
    User.distinct('department', { department: { $ne: '' } }),
    User.distinct('designation', { designation: { $ne: '' } }),
    User.distinct('branch', { branch: { $ne: '' } })
  ]);
  res.json({ departments: departments.sort(), designations: designations.sort(), branches: branches.sort() });
});

// GET /api/employees/managers — active employees eligible as a reporting manager
router.get('/managers', async (req, res) => {
  const managers = await User.find({ employeeStatus: 'ACTIVE' }, 'name employeeId designation');
  res.json({ managers });
});

// GET /api/employees/:id — single employee detail for the Employee Profile page
router.get('/:id', async (req, res) => {
  const employee = await User.findById(req.params.id).populate('reportingManager', 'name employeeId designation');
  if (!employee) return res.status(404).json({ message: 'Employee not found' });
  res.json({ employee: toEmployeeSummary(employee) });
});

// PATCH /api/employees/:id — HR edits employment info. Tracked fields (department, designation,
// branch, reportingManager, employmentType) get an Employee History entry per change instead of
// silently overwriting — untracked fields (name/mobile/personalEmail) just update directly.
const TRACKED_FIELDS = {
  department: 'Department Changed',
  designation: 'Designation Changed',
  branch: 'Branch Changed',
  employmentType: 'Employment Type Changed'
};

router.patch('/:id', async (req, res) => {
  const employee = await User.findById(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Employee not found' });

  const { firstName, lastName, mobile, personalEmail, reportingManager, ...rest } = req.body;

  if (firstName !== undefined) employee.firstName = firstName;
  if (lastName !== undefined) employee.lastName = lastName;
  if (firstName !== undefined || lastName !== undefined) {
    employee.name = `${employee.firstName} ${employee.lastName}`.trim();
  }
  if (mobile !== undefined) employee.mobile = mobile;
  if (personalEmail !== undefined) employee.personalEmail = personalEmail;

  for (const [field, action] of Object.entries(TRACKED_FIELDS)) {
    if (rest[field] !== undefined && rest[field] !== employee[field]) {
      await logAudit(employee._id, action, req.userId, { from: employee[field] || null, to: rest[field] });
      employee[field] = rest[field];
    }
  }

  if (reportingManager !== undefined && String(reportingManager || '') !== String(employee.reportingManager || '')) {
    const [fromMgr, toMgr] = await Promise.all([
      employee.reportingManager ? User.findById(employee.reportingManager, 'name') : null,
      reportingManager ? User.findById(reportingManager, 'name') : null
    ]);
    await logAudit(employee._id, 'Manager Changed', req.userId, { from: fromMgr?.name || null, to: toMgr?.name || null });
    employee.reportingManager = reportingManager || null;
  }

  await employee.save();
  res.json({ employee: toEmployeeSummary(employee) });
});

// PATCH /api/employees/:id/deactivate — HR deactivates rather than deletes (spec: no hard delete for HR)
router.patch('/:id/deactivate', async (req, res) => {
  const employee = await User.findById(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Employee not found' });
  employee.accountStatus = 'INACTIVE';
  await employee.save();
  await logAudit(employee._id, 'Employee Deactivated', req.userId);
  res.json({ employee: toEmployeeSummary(employee) });
});

// POST /api/employees — HR creates a new onboarding record (spec section 3 + 16 duplicate checks)
router.post('/', async (req, res) => {
  const {
    firstName, lastName, mobile, personalEmail, companyEmail,
    department, designation, branch, joiningDate, reportingManager, employmentType
  } = req.body;

  const missing = ['firstName', 'lastName', 'mobile', 'companyEmail', 'department', 'designation', 'branch', 'joiningDate', 'employmentType']
    .filter((f) => !req.body[f]);
  if (missing.length) return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });

  const email = companyEmail.toLowerCase().trim();
  const dupEmail = await User.findOne({ email });
  if (dupEmail) return res.status(400).json({ message: 'This company email is already in use.' });

  const dupMobile = await User.findOne({ mobile, employeeStatus: { $ne: 'CANCELLED' } });
  if (dupMobile) return res.status(400).json({ message: 'This mobile number already belongs to another employee.' });

  const count = await User.countDocuments();
  const employeeId = 'EMP' + String(count + 1).padStart(4, '0');
  const initials = ((firstName[0] || '') + (lastName[0] || '')).toUpperCase() || 'NA';

  const employee = await User.create({
    name: `${firstName} ${lastName}`.trim(),
    email,
    initials,
    employeeId,
    firstName,
    lastName,
    mobile,
    personalEmail: personalEmail || '',
    department,
    designation,
    branch,
    joinDate: joiningDate,
    reportingManager: reportingManager || null,
    employmentType,
    employeeStatus: 'ONBOARDING_PENDING',
    accountStatus: 'INACTIVE',
    emailVerified: false,
    emailCreationStatus: 'Created', // simulated — no real mailbox provisioning in this scaffold
    welcomeEmailStatus: 'NotSent',
    createdBy: req.userId,
    leaveBalance: { casual: 12, casualUsed: 0, sick: 8, sickUsed: 0, earned: 15, earnedUsed: 0 }
  });

  await logAudit(employee._id, 'Employee Created', req.userId, { employeeId });

  res.status(201).json({ employee: toEmployeeSummary(employee) });
});

// POST /api/employees/:id/send-welcome-email — spec section 6
router.post('/:id/send-welcome-email', async (req, res) => {
  const employee = await User.findById(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Employee not found' });
  if (employee.employeeStatus === 'ACTIVE') return res.status(400).json({ message: 'Employee is already active.' });

  await EmployeeVerification.updateMany(
    { employee: employee._id, status: 'Pending' },
    { $set: { status: 'Invalidated' } }
  );

  const { token, tokenHash, expiresAt } = generateVerificationToken();
  await EmployeeVerification.create({ employee: employee._id, email: employee.email, tokenHash, expiresAt });

  const verificationUrl = `${process.env.CLIENT_ORIGIN}/verify/${token}`;
  const result = await sendWelcomeEmail({ to: employee.email, name: employee.firstName || employee.name, verificationUrl });

  employee.employeeStatus = 'VERIFICATION_PENDING';
  employee.welcomeEmailStatus = result.status;
  await employee.save();

  await logAudit(employee._id, 'Welcome Email Sent', req.userId, { to: employee.email });

  res.json({ employee: toEmployeeSummary(employee), verificationUrl, emailChannel: result.channel });
});

// POST /api/employees/:id/resend-verification — spec section 14
router.post('/:id/resend-verification', async (req, res) => {
  const employee = await User.findById(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Employee not found' });
  if (employee.employeeStatus === 'ACTIVE') return res.status(400).json({ message: 'Employee is already active.' });

  await EmployeeVerification.updateMany(
    { employee: employee._id, status: 'Pending' },
    { $set: { status: 'Invalidated' } }
  );

  const { token, tokenHash, expiresAt } = generateVerificationToken();
  await EmployeeVerification.create({ employee: employee._id, email: employee.email, tokenHash, expiresAt });

  const verificationUrl = `${process.env.CLIENT_ORIGIN}/verify/${token}`;
  const result = await sendWelcomeEmail({ to: employee.email, name: employee.firstName || employee.name, verificationUrl });

  employee.employeeStatus = 'VERIFICATION_PENDING';
  employee.welcomeEmailStatus = result.status;
  await employee.save();

  await logAudit(employee._id, 'Verification Email Resent', req.userId, { to: employee.email });

  res.json({ employee: toEmployeeSummary(employee), verificationUrl, emailChannel: result.channel });
});

// GET /api/employees/:id/audit — audit trail for one employee
router.get('/:id/audit', async (req, res) => {
  const logs = await AuditLog.find({ employee: req.params.id }).sort({ createdAt: -1 });
  res.json({ logs });
});

// PATCH /api/employees/:id/module-access — TechAdmin-exclusive (Revised HRM Role Hierarchy §1:
// "Assign any module to any employee" / "Configure module-to-role mapping" is Tech Admin authority)
router.patch('/:id/module-access', requireRole('TechAdmin'), async (req, res) => {
  const { moduleAccess } = req.body;
  if (!Array.isArray(moduleAccess)) return res.status(400).json({ message: 'moduleAccess must be an array' });

  const invalid = moduleAccess.find((m) => !MODULE_ACCESS_KEYS.includes(m.module) || !['User', 'Admin'].includes(m.accessRole));
  if (invalid) return res.status(400).json({ message: 'Invalid module or role in moduleAccess' });

  const employee = await User.findById(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Employee not found' });
  if (employee.employeeStatus !== 'ACTIVE') return res.status(400).json({ message: 'Only active employees can be assigned module access.' });

  employee.moduleAccess = moduleAccess;
  await employee.save();

  await logAudit(employee._id, 'Module Access Updated', req.userId, { moduleAccess });

  res.json({ employee: toEmployeeSummary(employee) });
});

export default router;
