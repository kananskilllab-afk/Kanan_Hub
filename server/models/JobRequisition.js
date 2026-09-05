import mongoose from 'mongoose';

// Kanan Recruit spec §6. Requisition creation is Recruit-Admin-only (see routes/recruit.js);
// any Recruit member (User or Admin) can read the list to pick up interviews/offers against it.
const jobRequisitionSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true }, // auto-generated, e.g. REQ-2026-0001
    department: { type: String, required: true },
    designation: { type: String, required: true },
    branch: { type: String, default: '' },
    hiringManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedRecruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    openings: { type: Number, default: 1 },
    salaryRange: { type: String, default: '' },
    employmentType: { type: String, enum: ['Full-time', 'Part-time', 'Contract', 'Intern'], default: 'Full-time' },
    status: { type: String, enum: ['Open', 'Hold', 'Closed'], default: 'Open' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export default mongoose.model('JobRequisition', jobRequisitionSchema);
