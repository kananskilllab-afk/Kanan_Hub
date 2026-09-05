import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  if (!user.passwordHash) {
    return res.status(403).json({ message: 'Your account has not been activated yet. Please verify your email first.' });
  }
  if (user.employeeStatus !== 'ACTIVE' || user.accountStatus !== 'ACTIVE') {
    return res.status(403).json({ message: 'Your account is not active. Please contact HR.' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const token = signToken(user);
  res.json({ token, user: toPublicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user: toPublicUser(user) });
});

function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    initials: user.initials,
    avatarUrl: user.avatarUrl,
    role: user.role,
    employeeId: user.employeeId,
    designation: user.designation,
    department: user.department,
    location: user.location,
    monthlyCTC: user.monthlyCTC,
    joinDate: user.joinDate,
    kPoints: user.kPoints,
    badgesEarned: user.badgesEarned,
    employeeStatus: user.employeeStatus,
    moduleAccess: user.moduleAccess
  };
}

export default router;
