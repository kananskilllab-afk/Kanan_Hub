import { Router } from 'express';
import Notification from '../models/Notification.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/notifications?unread=true — mine, newest first, capped at 50 (Notification Center spec §27)
router.get('/', async (req, res) => {
  const filter = { recipient: req.userId };
  if (req.query.unread === 'true') filter.status = 'Unread';
  const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json({ notifications });
});

router.get('/unread-count', async (req, res) => {
  const count = await Notification.countDocuments({ recipient: req.userId, status: 'Unread' });
  res.json({ count });
});

router.patch('/:id/read', async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, recipient: req.userId });
  if (!notification) return res.status(404).json({ message: 'Notification not found' });
  notification.status = 'Read';
  await notification.save();
  res.json({ notification });
});

router.patch('/read-all', async (req, res) => {
  await Notification.updateMany({ recipient: req.userId, status: 'Unread' }, { status: 'Read' });
  res.json({ ok: true });
});

export default router;
