import mongoose from 'mongoose';

const halfDayLeaveSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    half: { type: String, enum: ['FIRST_HALF', 'SECOND_HALF'], required: true },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

halfDayLeaveSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model('HalfDayLeaveRequest', halfDayLeaveSchema);
