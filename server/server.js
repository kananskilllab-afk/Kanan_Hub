import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import leaveRoutes from './routes/leave.js';
import announcementRoutes from './routes/announcements.js';
import dashboardRoutes from './routes/dashboard.js';
import employeeRoutes from './routes/employees.js';
import verifyRoutes from './routes/verify.js';
import hrmRoutes from './routes/hrm.js';
import notificationRoutes from './routes/notifications.js';
import recruitRoutes from './routes/recruit.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/hrm', hrmRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/recruit', recruitRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Kanan Hub API listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
