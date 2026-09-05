import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import EmployeeVerification from '../models/EmployeeVerification.js';
import AuditLog from '../models/AuditLog.js';
import { hashToken } from '../utils/token.js';

const router = Router();

async function logAudit(employeeId, action, performedBy, meta = {}) {
  await AuditLog.create({ employee: employeeId, action, performedBy, meta });
}

async function findValidVerification(token) {
  const tokenHash = hashToken(token);
  const verification = await EmployeeVerification.findOne({ tokenHash });
  if (!verification) return { error: 'Verification link is invalid.' };

  if (verification.status === 'Verified') return { error: 'This verification link has already been used.' };
  if (verification.status === 'Invalidated') return { error: 'This verification link is no longer valid. Please request a new one.' };
  if (verification.expiresAt < new Date()) {
    if (verification.status !== 'Expired') {
      verification.status = 'Expired';
      await verification.save();
    }
    return { error: 'This verification link has expired. Please ask HR to resend it.' };
  }
  return { verification };
}

// GET /api/verify/:token — check token validity, show who it belongs to (no activation yet)
router.get('/:token', async (req, res) => {
  const { verification, error } = await findValidVerification(req.params.token);
  if (error) return res.status(400).json({ message: error });

  const employee = await User.findById(verification.employee);
  if (!employee) return res.status(404).json({ message: 'Employee record not found.' });

  res.json({
    name: employee.name,
    email: employee.email,
    department: employee.department,
    designation: employee.designation
  });
});

// POST /api/verify/:token — set password, activate account (spec section 8, 9, 12)
router.post('/:token', async (req, res) => {
  const { password, confirmPassword } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' });

  const { verification, error } = await findValidVerification(req.params.token);
  if (error) return res.status(400).json({ message: error });

  const employee = await User.findById(verification.employee);
  if (!employee) return res.status(404).json({ message: 'Employee record not found.' });

  employee.passwordHash = await bcrypt.hash(password, 10);
  employee.emailVerified = true;
  employee.employeeStatus = 'ACTIVE';
  employee.accountStatus = 'ACTIVE';
  // Final Role & Module Access Logic §12: every active employee auto-gets HRM (mykanan) User
  // access — Tech Admin doesn't need to manually grant the module every employee needs by default.
  if (!employee.moduleAccess.some((m) => m.module === 'mykanan')) {
    employee.moduleAccess.push({ module: 'mykanan', accessRole: 'User' });
  }
  await employee.save();

  verification.status = 'Verified';
  verification.verifiedAt = new Date();
  await verification.save();

  await logAudit(employee._id, 'Employee Verified', employee.name, { email: employee.email });
  await logAudit(employee._id, 'Account Activated', 'System');

  res.json({ message: 'Account verified and activated successfully.' });
});

export default router;
