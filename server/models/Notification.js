import mongoose from 'mongoose';

// In-app notification (Notification & Reminder Engine spec §27-28). Instant-only for now — no
// scheduler/reminder/escalation timestamps here; see the roadmap memory for what's deferred.
const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    event: { type: String, required: true }, // e.g. 'HALF_DAY_LEAVE_APPROVED' — spec §4's event names
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: null }, // in-app route to open on click
    sourceModule: { type: String, default: null },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    status: { type: String, enum: ['Unread', 'Read'], default: 'Unread' }
  },
  { timestamps: true }
);

export default mongoose.model('Notification', notificationSchema);
