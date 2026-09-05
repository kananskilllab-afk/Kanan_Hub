import mongoose from 'mongoose';

// Kanan Recruit spec §10-13: "This list belongs to HRM, not Recruit." Created automatically when
// an Offer is accepted (see routes/recruit.js) — HR Admin picks it up from the Joining List widget
// (routes/hrm.js) and turns it into a real onboarding record via the EXISTING employee-onboarding
// flow (routes/employees.js POST /), rather than a parallel one. Once linkedEmployee is set, the
// detailed status (email sent / verification pending / active, ...) is read live from that
// employee's own employeeStatus — never duplicated here, so it can't drift out of sync.
const joiningRecordSchema = new mongoose.Schema(
  {
    offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    mobile: { type: String, default: '' },
    department: { type: String, required: true },
    designation: { type: String, required: true },
    branch: { type: String, default: '' },
    joiningDate: { type: Date, required: true },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['Joining Pending', 'Onboarding Started'], default: 'Joining Pending' },
    linkedEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

export default mongoose.model('JoiningRecord', joiningRecordSchema);
