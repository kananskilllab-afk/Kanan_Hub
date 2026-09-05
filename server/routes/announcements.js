import { Router } from 'express';
import Announcement from '../models/Announcement.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const announcements = await Announcement.find().sort({ createdAt: -1 }).limit(10);
  res.json({ announcements });
});

export default router;
