import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Task from '../models/Task.js';
import Announcement from '../models/Announcement.js';
import LeaveRequest from '../models/LeaveRequest.js';
import EmployeeVerification from '../models/EmployeeVerification.js';
import AuditLog from '../models/AuditLog.js';
import mongoose from 'mongoose';

async function run() {
  await connectDB();

  const email = 'chirag@kanan.co';
  await User.deleteMany({});
  await Task.deleteMany({});
  await Announcement.deleteMany({});
  await LeaveRequest.deleteMany({});
  await EmployeeVerification.deleteMany({});
  await AuditLog.deleteMany({});

  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await User.create({
    name: 'Chirag Parmar',
    email,
    passwordHash,
    initials: 'CP',
    role: 'SuperAdmin',
    employeeId: 'EMP0001',
    firstName: 'Chirag',
    lastName: 'Parmar',
    mobile: '9900000001',
    department: 'Admissions',
    designation: 'Admissions Counsellor',
    branch: 'Surat',
    employmentType: 'Full-time',
    employeeStatus: 'ACTIVE',
    accountStatus: 'ACTIVE',
    emailVerified: true,
    emailCreationStatus: 'Created',
    welcomeEmailStatus: 'Sent',
    location: 'Surat, Gujarat',
    monthlyCTC: 58400,
    joinDate: new Date('2025-04-07'),
    kPoints: 2840,
    badgesEarned: 4,
    leaveBalance: { casual: 12, casualUsed: 4, sick: 8, sickUsed: 2, earned: 15, earnedUsed: 10 }
  });

  await Task.insertMany([
    { user: user._id, title: 'Send IELTS batch schedule to trainer', done: true, dueLabel: 'Done' },
    { user: user._id, title: 'Follow up with Priya Mehta – visa docs', done: false, dueLabel: 'Overdue' },
    { user: user._id, title: 'Update Q2 lead report for Surat branch', done: false, dueLabel: 'Today' },
    { user: user._id, title: 'Review SOPs for K Apply agent guide', done: false, dueLabel: 'May 15' },
    { user: user._id, title: 'Prepare MOM for weekly sync meeting', done: false, dueLabel: 'May 16' }
  ]);

  await Announcement.insertMany([
    { title: 'Q2 All-Hands Meeting — May 20, 2025', category: 'Company', color: 'blue' },
    { title: 'New IELTS Batch Starting June 1 — Enroll Now', category: 'Coaching', color: 'green' },
    { title: 'WFH Policy Revised — Effective June 2025', category: 'HR Policy', color: 'gold' }
  ]);

  await AuditLog.create({ employee: user._id, action: 'Employee Created', performedBy: 'System (seed)' });
  await AuditLog.create({ employee: user._id, action: 'Account Activated', performedBy: 'System (seed)' });

  console.log('Seed complete.');
  console.log(`Login with: ${email} / password123  (role: Admin)`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
