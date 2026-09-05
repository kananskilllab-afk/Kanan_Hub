import mongoose from 'mongoose';

// 'workhub' remains a catch-all bucket for the Work Hub pages NOT individually split out below
// (News & Announcements, Knowledgebase, MOM, Reports) — granting e.g. 'crm' does not also grant
// those. kapply/coaching/crm/vas/events/tasks are independently grantable per-page modules
// (Module Mapping spec, 2026-08-25) — see client/src/moduleData.js's ASSIGNABLE_MODULES.
const MODULE_KEYS = ['mykanan', 'workhub', 'kapply', 'coaching', 'crm', 'vas', 'events', 'tasks', 'growthhub', 'helpdesk', 'recruit'];

const userSchema = new mongoose.Schema(
  {
    // ── Identity / login ──
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true }, // = company email
    passwordHash: { type: String }, // not set until verification (Option A: set password during verification)
    initials: { type: String, default: 'U' },
    avatarUrl: { type: String, default: '' },
    // Revised HRM Role Hierarchy (2026-08-24): TechAdmin (system/technical authority) sits above
    // SuperAdmin (business/application authority — this app's former 'Admin' role, renamed).
    // TechAdmin gets everything SuperAdmin has, plus exclusive access to the technical-config
    // surfaces that exist in this app (HR Settings' Shift/Permission Policy, Module Access grants).
    // "Manager"/"HOD" from the spec are deliberately NOT separate stored roles — that authority
    // stays derived from reportingManager, exactly as it already works (see resolveApprovers,
    // canActOnUserRequest). See server/utils/roles.js for the shared role-tier helpers.
    role: { type: String, enum: ['Employee', 'HR', 'SuperAdmin', 'TechAdmin'], default: 'Employee' },

    // ── HRM onboarding fields (spec section 18: employees table) ──
    employeeId: { type: String, unique: true, sparse: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    mobile: { type: String, default: '' },
    personalEmail: { type: String, default: '' },
    department: { type: String, default: '' },
    designation: { type: String, default: '' },
    branch: { type: String, default: '' },
    joinDate: { type: Date, default: Date.now }, // = joining date
    dateOfBirth: { type: Date, default: null },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    employmentType: { type: String, enum: ['Full-time', 'Part-time', 'Contract', 'Intern'], default: 'Full-time' },

    // ── Status machine (spec section 5) ──
    employeeStatus: {
      type: String,
      enum: ['ONBOARDING_PENDING', 'EMAIL_SENT', 'VERIFICATION_PENDING', 'EMAIL_VERIFIED', 'ACTIVE', 'EXPIRED', 'CANCELLED'],
      default: 'ONBOARDING_PENDING'
    },
    accountStatus: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'INACTIVE' },
    emailVerified: { type: Boolean, default: false },
    emailCreationStatus: { type: String, enum: ['Pending', 'Created', 'Failed'], default: 'Pending' },
    welcomeEmailStatus: { type: String, enum: ['NotSent', 'Sent', 'Failed'], default: 'NotSent' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // ── Basic module access (hub-group level — see moduleData HUB_GROUPS keys) ──
    moduleAccess: [
      {
        module: { type: String, enum: MODULE_KEYS },
        accessRole: { type: String, enum: ['User', 'Admin'], default: 'User' }
      }
    ],

    // ── Existing app data (Growth Hub / My Kanan widgets) ──
    location: { type: String, default: '' },
    monthlyCTC: { type: Number, default: 0 },
    kPoints: { type: Number, default: 0 },
    badgesEarned: { type: Number, default: 0 },
    leaveBalance: {
      casual: { type: Number, default: 12 },
      casualUsed: { type: Number, default: 0 },
      sick: { type: Number, default: 8 },
      sickUsed: { type: Number, default: 0 },
      earned: { type: Number, default: 15 },
      earnedUsed: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

export const MODULE_ACCESS_KEYS = MODULE_KEYS;
export default mongoose.model('User', userSchema);
