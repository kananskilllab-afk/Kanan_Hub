import mongoose from 'mongoose';

// Covers all 3 permission types from the spec (Short / Late Check-In / Early Check-Out).
// Field usage differs by type:
//   SHORT      -> outTime + returnTime set; duration = returnTime - outTime
//   LATE       -> requestedTime = expected arrival; duration = requestedTime - shift start
//   EARLY_EXIT -> requestedTime = expected exit; duration = shift end - requestedTime
const permissionRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['SHORT', 'LATE', 'EARLY_EXIT'], required: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    outTime: { type: Date, default: null },
    returnTime: { type: Date, default: null },
    requestedTime: { type: Date, default: null },
    durationMinutes: { type: Number, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

export default mongoose.model('PermissionRequest', permissionRequestSchema);
