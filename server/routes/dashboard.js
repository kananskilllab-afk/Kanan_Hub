import { Router } from 'express';
import User from '../models/User.js';
import Task from '../models/Task.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/summary', async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const pendingTasks = await Task.countDocuments({ user: req.userId, done: false });

  const lb = user.leaveBalance;
  const leaveRemaining = (lb.casual - lb.casualUsed) + (lb.sick - lb.sickUsed) + (lb.earned - lb.earnedUsed);

  const higherRanked = await User.countDocuments({ kPoints: { $gt: user.kPoints } });
  const leaderboardRank = higherRanked + 1;

  res.json({
    pendingTasks,
    leaveRemaining,
    leaveBalance: lb,
    kPoints: user.kPoints,
    leaderboardRank
  });
});

export default router;
