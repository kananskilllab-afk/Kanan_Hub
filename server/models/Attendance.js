import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    // Cached snapshot of the attendance engine's last evaluation — always recomputed on read
    // against the live shift config, so this is a convenience cache, not the source of truth.
    status: {
      type: String,
      enum: ['PRESENT', 'HALF_DAY', 'ABSENT', 'LEAVE', 'HOLIDAY', 'WEEKLY_OFF', 'WFH', 'ON_DUTY', 'PENDING', 'IN_PROGRESS'],
      default: null
    },
    reason: {
      type: String,
      enum: [
        'NORMAL', 'FIRST_HALF_LEAVE', 'SECOND_HALF_LEAVE', 'NO_CHECK_IN', 'MISSING_CHECK_OUT',
        'INSUFFICIENT_WORKING_HOURS', 'INSUFFICIENT_HALF_DAY_HOURS', 'REGULARIZED'
      ],
      default: null
    },
    minutesWorked: { type: Number, default: null }
  },
  { timestamps: true }
);

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
