import mongoose from 'mongoose';

const verificationSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    verifiedAt: { type: Date, default: null },
    status: { type: String, enum: ['Pending', 'Verified', 'Expired', 'Invalidated'], default: 'Pending' },
    attemptCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export default mongoose.model('EmployeeVerification', verificationSchema);
