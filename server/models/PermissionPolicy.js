import mongoose from 'mongoose';

// One document per (type, version). HR/Admin-editable — values must never be hard-coded elsewhere
// (see Permission Management spec §4/§16: "These values should not be hard-coded"). `type` is
// deliberately NOT unique any more — see effectiveFrom below (HR Policy Management spec §16-17).
const permissionPolicySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['SHORT', 'LATE', 'EARLY_EXIT'], required: true, index: true },
    maxDurationMinutes: { type: Number, required: true },
    monthlyRequestLimit: { type: Number, required: true },
    // Whether approved time under this permission counts toward the required working hours
    // (spec §12-§15 "Permission Counts As Working Time?"). Default false — a permission is an
    // authorized absence, not automatic credit, unless HR opts in per type.
    countsAsWorkingTime: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    // Policy Versioning (HR Policy Management spec §16-17/§31): saving a policy creates a new
    // version rather than overwriting in place, so a permission request is always validated (and
    // its attendance credit resolved) against whichever version was effective on its own date —
    // not "whatever HR has saved most recently." Documents with no effectiveFrom predate this
    // feature and are treated as always-applicable (epoch).
    effectiveFrom: { type: Date, default: () => new Date(0), index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changeSummary: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.model('PermissionPolicy', permissionPolicySchema);
