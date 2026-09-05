import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true }, // e.g. 'Employee Created', 'Email Sent', 'Employee Verified', 'Account Activated'
    performedBy: { type: String, required: true }, // user name/id or 'System'
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export default mongoose.model('AuditLog', auditLogSchema);
