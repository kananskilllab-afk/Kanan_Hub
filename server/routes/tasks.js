import { Router } from 'express';
import Task from '../models/Task.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const tasks = await Task.find({ user: req.userId }).sort({ done: 1, createdAt: -1 });
  res.json({ tasks });
});

router.post('/', async (req, res) => {
  const { title, dueLabel } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });
  const task = await Task.create({ user: req.userId, title, dueLabel: dueLabel || '' });
  res.status(201).json({ task });
});

router.patch('/:id/toggle', async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, user: req.userId });
  if (!task) return res.status(404).json({ message: 'Task not found' });
  task.done = !task.done;
  await task.save();
  res.json({ task });
});

router.delete('/:id', async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!task) return res.status(404).json({ message: 'Task not found' });
  res.json({ ok: true });
});

export default router;
