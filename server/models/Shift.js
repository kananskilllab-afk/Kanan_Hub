import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'General' },
    startTime: { type: String, default: '10:00' }, // 'HH:MM', 24h
    endTime: { type: String, default: '19:00' },
    requiredMinutes: { type: Number, default: 540 }, // 9:00 — half-day is always derived as requiredMinutes / 2, never stored
    breakMinutes: { type: Number, default: 60 },
    // INCLUDE_IN_SHIFT (default) matches the spec's worked examples exactly: raw checkout-checkin IS the
    // working duration. Switch to EXCLUDE_FROM_WORK if your org's required hours exclude a paid break.
    breakPolicy: { type: String, enum: ['EXCLUDE_FROM_WORK', 'INCLUDE_IN_SHIFT'], default: 'INCLUDE_IN_SHIFT' },
    lateGraceMinutes: { type: Number, default: 0 },
    earlyCheckoutGraceMinutes: { type: Number, default: 0 },
    halfDayLeaveEnabled: { type: Boolean, default: true },
    firstHalfEnabled: { type: Boolean, default: true },
    secondHalfEnabled: { type: Boolean, default: true },
    // Policy Versioning (HR Policy Management spec §16-17/§31): saving settings creates a new
    // version rather than overwriting in place. Attendance for a given date always resolves the
    // version whose effectiveFrom is the latest one on or before that date — so editing today's
    // settings never silently changes how past days were calculated. Documents with no
    // effectiveFrom predate this feature and are treated as always-applicable (epoch).
    effectiveFrom: { type: Date, default: () => new Date(0), index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changeSummary: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.model('Shift', shiftSchema);
