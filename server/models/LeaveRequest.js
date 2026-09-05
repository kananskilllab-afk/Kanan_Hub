import mongoose from 'mongoose';

const leaveRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['Casual', 'Sick', 'Earned', 'WFH'], required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    days: { type: Number, required: true },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' }
  },
  { timestamps: true }
);

export default mongoose.model('LeaveRequest', leaveRequestSchema);
