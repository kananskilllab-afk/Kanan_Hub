import mongoose from 'mongoose';

// Kanan Recruit spec §9. Offer creation/status changes are Recruit-Admin-only (routes/recruit.js).
// When status flips to 'Accepted', a JoiningRecord is created automatically (spec §10 — "Most
// Important Logic") — the bridge into HRM. Never overwritten after acceptance; JoiningRecord owns
// what happens next.
const offerSchema = new mongoose.Schema(
  {
    offerId: { type: String, required: true, unique: true }, // auto-generated, e.g. OFF2026-0001
    requisition: { type: mongoose.Schema.Types.ObjectId, ref: 'JobRequisition', default: null },
    candidateName: { type: String, required: true },
    email: { type: String, required: true },
    mobile: { type: String, default: '' },
    department: { type: String, required: true },
    designation: { type: String, required: true },
    branch: { type: String, default: '' },
    joiningDate: { type: Date, required: true },
    ctc: { type: String, default: '' },
    offerExpiryDate: { type: Date, default: null },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'], default: 'Draft' },
    emailChannel: { type: String, enum: ['smtp', 'stub', null], default: null }, // how the offer email was actually delivered, last time it was sent
    lastSentAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export default mongoose.model('Offer', offerSchema);
