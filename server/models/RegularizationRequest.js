import mongoose from 'mongoose';

const regularizationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    originalCheckIn: { type: Date, default: null }, // snapshot at request time — audit trail
    originalCheckOut: { type: Date, default: null },
    requestedCheckIn: { type: Date, default: null }, // null = don't change this punch
    requestedCheckOut: { type: Date, default: null },
    reason: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

export default mongoose.model('RegularizationRequest', regularizationSchema);
