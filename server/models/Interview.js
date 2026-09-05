import mongoose from 'mongoose';

// Kanan Recruit spec §7-8. Candidate data lives only here and on Offer — there is deliberately no
// separate candidate/employee record until an offer is accepted (spec §2/§15: "Candidate Database
// is NOT included in this module").
const interviewSchema = new mongoose.Schema(
  {
    requisition: { type: mongoose.Schema.Types.ObjectId, ref: 'JobRequisition', default: null },
    candidateName: { type: String, required: true },
    mobile: { type: String, default: '' },
    email: { type: String, default: '' },
    position: { type: String, default: '' },
    interviewType: { type: String, enum: ['Online', 'Offline', 'Phone'], default: 'Online' },
    round: { type: String, enum: ['HR', 'Technical', 'Manager', 'Final'], default: 'HR' },
    interviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    scheduledAt: { type: Date, required: true },
    status: { type: String, enum: ['Scheduled', 'Completed', 'No Show', 'Rescheduled'], default: 'Scheduled' },
    feedback: {
      communication: { type: Number, min: 1, max: 5, default: null },
      technicalKnowledge: { type: Number, min: 1, max: 5, default: null },
      confidence: { type: Number, min: 1, max: 5, default: null },
      experienceMatch: { type: Number, min: 1, max: 5, default: null },
      culturalFit: { type: Number, min: 1, max: 5, default: null },
      recommendation: { type: String, enum: ['Strong Hire', 'Hire', 'Hold', 'Reject'], default: null },
      remarks: { type: String, default: '' },
      submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      submittedAt: { type: Date, default: null }
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export default mongoose.model('Interview', interviewSchema);
