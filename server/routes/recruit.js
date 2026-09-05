import { Router } from 'express';
import User from '../models/User.js';
import JobRequisition from '../models/JobRequisition.js';
import Interview from '../models/Interview.js';
import Offer from '../models/Offer.js';
import JoiningRecord from '../models/JoiningRecord.js';
import { requireAuth, requireModuleAccess, requireModuleAdmin } from '../middleware/auth.js';
import { notifyMany } from '../services/notifyService.js';
import { sendOfferEmail } from '../services/emailService.js';

const router = Router();
// Kanan Recruit spec §1/§15: hidden from everyone except whoever Tech Admin has explicitly mapped
// onto the 'recruit' module (User or Admin) — SuperAdmin/TechAdmin still pass via blanket access.
router.use(requireAuth, requireModuleAccess('recruit'));

async function nextId(Model, field, prefix) {
  const year = new Date().getFullYear();
  const count = await Model.countDocuments();
  return `${prefix}${year}-${String(count + 1).padStart(4, '0')}`;
}

// ---- Dashboard ----
router.get('/dashboard', async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [openPositions, interviewsToday, offersSent, joiningThisWeek, todaysInterviews, pendingOffers] = await Promise.all([
    JobRequisition.countDocuments({ status: 'Open' }),
    Interview.countDocuments({ scheduledAt: { $gte: todayStart, $lt: todayEnd } }),
    Offer.countDocuments({ status: 'Sent' }),
    JoiningRecord.countDocuments({ joiningDate: { $gte: todayStart, $lt: weekEnd } }),
    Interview.find({ scheduledAt: { $gte: todayStart, $lt: todayEnd } }).sort({ scheduledAt: 1 }).populate('interviewer', 'name'),
    Offer.find({ status: 'Sent' }).sort({ createdAt: -1 }).limit(10)
  ]);

  res.json({
    openPositions,
    interviewsToday,
    offersSent,
    joiningThisWeek,
    todaysInterviews,
    pendingOffers
  });
});

// ---- Job Requisitions ----
router.get('/requisitions', async (req, res) => {
  const requisitions = await JobRequisition.find()
    .sort({ createdAt: -1 })
    .populate('hiringManager', 'name')
    .populate('assignedRecruiter', 'name');
  res.json({ requisitions });
});

router.post('/requisitions', requireModuleAdmin('recruit'), async (req, res) => {
  const { department, designation, branch, hiringManager, assignedRecruiter, openings, salaryRange, employmentType } = req.body;
  if (!department || !designation) return res.status(400).json({ message: 'department and designation are required.' });

  const jobId = await nextId(JobRequisition, 'jobId', 'REQ-');
  const requisition = await JobRequisition.create({
    jobId, department, designation, branch: branch || '',
    hiringManager: hiringManager || null, assignedRecruiter: assignedRecruiter || null,
    openings: openings || 1, salaryRange: salaryRange || '', employmentType: employmentType || 'Full-time',
    createdBy: req.userId
  });
  res.status(201).json({ requisition });
});

router.patch('/requisitions/:id', requireModuleAdmin('recruit'), async (req, res) => {
  const requisition = await JobRequisition.findById(req.params.id);
  if (!requisition) return res.status(404).json({ message: 'Requisition not found' });

  const { status, assignedRecruiter, openings, salaryRange } = req.body;
  if (status !== undefined) requisition.status = status;
  if (assignedRecruiter !== undefined) requisition.assignedRecruiter = assignedRecruiter || null;
  if (openings !== undefined) requisition.openings = openings;
  if (salaryRange !== undefined) requisition.salaryRange = salaryRange;
  await requisition.save();
  res.json({ requisition });
});

// ---- Interviews ----
router.get('/interviews', async (req, res) => {
  const interviews = await Interview.find()
    .sort({ scheduledAt: -1 })
    .populate('interviewer', 'name')
    .populate('requisition', 'jobId department designation');
  res.json({ interviews });
});

// Any Recruit member can schedule interviews — this is "the core working module for Recruit Users" (spec §7)
router.post('/interviews', async (req, res) => {
  const { requisition, candidateName, mobile, email, position, interviewType, round, interviewer, scheduledAt } = req.body;
  if (!candidateName || !scheduledAt) return res.status(400).json({ message: 'candidateName and scheduledAt are required.' });

  const interview = await Interview.create({
    requisition: requisition || null, candidateName, mobile: mobile || '', email: email || '',
    position: position || '', interviewType: interviewType || 'Online', round: round || 'HR',
    interviewer: interviewer || null, scheduledAt, createdBy: req.userId
  });
  res.status(201).json({ interview });
});

router.patch('/interviews/:id', async (req, res) => {
  const interview = await Interview.findById(req.params.id);
  if (!interview) return res.status(404).json({ message: 'Interview not found' });

  const { status, scheduledAt, interviewer, round, interviewType } = req.body;
  if (status !== undefined) interview.status = status;
  if (scheduledAt !== undefined) interview.scheduledAt = scheduledAt;
  if (interviewer !== undefined) interview.interviewer = interviewer || null;
  if (round !== undefined) interview.round = round;
  if (interviewType !== undefined) interview.interviewType = interviewType;
  await interview.save();
  res.json({ interview });
});

// Interview Feedback (spec §8)
router.post('/interviews/:id/feedback', async (req, res) => {
  const interview = await Interview.findById(req.params.id);
  if (!interview) return res.status(404).json({ message: 'Interview not found' });

  const { communication, technicalKnowledge, confidence, experienceMatch, culturalFit, recommendation, remarks } = req.body;
  if (!recommendation) return res.status(400).json({ message: 'recommendation is required.' });

  interview.feedback = {
    communication: communication || null, technicalKnowledge: technicalKnowledge || null,
    confidence: confidence || null, experienceMatch: experienceMatch || null, culturalFit: culturalFit || null,
    recommendation, remarks: remarks || '', submittedBy: req.userId, submittedAt: new Date()
  };
  interview.status = 'Completed';
  await interview.save();
  res.json({ interview });
});

// ---- Offers ----
router.get('/offers', async (req, res) => {
  const offers = await Offer.find().sort({ createdAt: -1 }).populate('requisition', 'jobId').populate('reportingManager', 'name');
  res.json({ offers });
});

router.post('/offers', requireModuleAdmin('recruit'), async (req, res) => {
  const { requisition, candidateName, email, mobile, department, designation, branch, joiningDate, ctc, offerExpiryDate, reportingManager } = req.body;
  if (!candidateName || !email || !department || !designation || !joiningDate) {
    return res.status(400).json({ message: 'candidateName, email, department, designation and joiningDate are required.' });
  }

  const offerId = await nextId(Offer, 'offerId', 'OFF');
  const offer = await Offer.create({
    offerId, requisition: requisition || null, candidateName, email, mobile: mobile || '',
    department, designation, branch: branch || '', joiningDate, ctc: ctc || '',
    offerExpiryDate: offerExpiryDate || null, reportingManager: reportingManager || null,
    createdBy: req.userId
  });
  res.status(201).json({ offer });
});

// Actually emails the candidate their offer (real SMTP if configured, logged to the server
// console as a stub otherwise — same honesty convention as the employee-verification email in
// routes/verify.js). Only meaningful before the offer is settled; once the candidate has
// responded there's nothing left to send. Re-sending a 'Sent' offer is allowed (e.g. resending
// after a bounce) — each send overwrites emailChannel/lastSentAt with what actually just happened.
router.post('/offers/:id/send', requireModuleAdmin('recruit'), async (req, res) => {
  const offer = await Offer.findById(req.params.id);
  if (!offer) return res.status(404).json({ message: 'Offer not found' });
  if (!['Draft', 'Sent'].includes(offer.status)) {
    return res.status(400).json({ message: `This offer is already ${offer.status.toLowerCase()} — nothing to send.` });
  }

  const result = await sendOfferEmail({
    to: offer.email,
    name: offer.candidateName,
    designation: offer.designation,
    department: offer.department,
    branch: offer.branch,
    joiningDate: offer.joiningDate,
    ctc: offer.ctc,
    offerExpiryDate: offer.offerExpiryDate
  });

  offer.emailChannel = result.channel;
  offer.lastSentAt = new Date();
  if (result.status === 'Sent') offer.status = 'Sent';
  await offer.save();

  res.json({ offer, emailStatus: result.status, channel: result.channel });
});

// Offer status flow — Accepted is the "Most Important Logic" (spec §10): auto-creates a real
// JoiningRecord that shows up on the HR Admin dashboard's Joining List (routes/hrm.js).
router.patch('/offers/:id', requireModuleAdmin('recruit'), async (req, res) => {
  const offer = await Offer.findById(req.params.id);
  if (!offer) return res.status(404).json({ message: 'Offer not found' });

  const { status } = req.body;
  if (!['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }
  const wasAlreadyAccepted = offer.status === 'Accepted';
  offer.status = status;
  await offer.save();

  if (status === 'Accepted' && !wasAlreadyAccepted) {
    const existing = await JoiningRecord.findOne({ offer: offer._id });
    if (!existing) {
      await JoiningRecord.create({
        offer: offer._id, name: offer.candidateName, email: offer.email, mobile: offer.mobile,
        department: offer.department, designation: offer.designation, branch: offer.branch,
        joiningDate: offer.joiningDate, reportingManager: offer.reportingManager
      });
      const hrAdmins = await User.find({
        $or: [
          { role: { $in: ['SuperAdmin', 'TechAdmin'] } },
          { moduleAccess: { $elemMatch: { module: 'mykanan', accessRole: 'Admin' } } }
        ]
      }, '_id');
      await notifyMany(hrAdmins.map((u) => u._id), {
        event: 'OFFER_ACCEPTED',
        title: `${offer.candidateName} — Offer Accepted`,
        body: `${offer.designation}, ${offer.department} — joining ${new Date(offer.joiningDate).toLocaleDateString()}`,
        link: '/hr-admin',
        sourceModule: 'JoiningRecord',
        sourceId: offer._id
      });
    }
  }

  res.json({ offer });
});

export default router;
