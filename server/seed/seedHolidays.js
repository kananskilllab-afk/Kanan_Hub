import 'dotenv/config';
import { connectDB } from '../config/db.js';
import Holiday from '../models/Holiday.js';
import mongoose from 'mongoose';

const HOLIDAYS = [
  { name: 'Ganesh Chaturthi', date: new Date('2026-09-14'), type: 'Public' },
  { name: 'Gandhi Jayanti', date: new Date('2026-10-02'), type: 'Public' },
  { name: 'Diwali', date: new Date('2026-11-08'), type: 'Public' },
  { name: 'Bhai Dooj', date: new Date('2026-11-10'), type: 'Public' },
  { name: 'Christmas', date: new Date('2026-12-25'), type: 'Public' }
];

async function run() {
  await connectDB();
  await Holiday.deleteMany({});
  await Holiday.insertMany(HOLIDAYS);
  console.log(`Seeded ${HOLIDAYS.length} holidays.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
