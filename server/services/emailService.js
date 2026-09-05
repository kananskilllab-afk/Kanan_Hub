import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // false = STARTTLS on 587, true = SSL on 465
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transporter;
}

function buildEmail({ to, name, verificationUrl }) {
  const subject = 'Welcome to Kanan – Verify Your Employee Account';
  const text = `Dear ${name},\n\nWelcome to Kanan!\n\nYour employee account has been created successfully.\nPlease verify your official email address using the link below.\n\n${verificationUrl}\n\nYour account will become active after successful verification.\nThis link expires in 48 hours.\n\nRegards,\nHR Team\nKanan`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1A3A8F">Welcome to Kanan!</h2>
      <p>Dear ${name},</p>
      <p>Your employee account has been created successfully. Please verify your official email address by clicking the button below.</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${verificationUrl}" style="background:#2B52AE;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Verify My Account</a>
      </p>
      <p style="color:#7886A8;font-size:12px">Your account will become active after successful verification. This link expires in 48 hours.</p>
      <p>Regards,<br/>HR Team<br/>Kanan</p>
    </div>`;
  return { subject, text, html };
}

export async function sendWelcomeEmail({ to, name, verificationUrl }) {
  const { subject, text, html } = buildEmail({ to, name, verificationUrl });
  const t = getTransporter();

  if (!t) {
    console.log('\n──────── [STUB EMAIL — no SMTP configured] ────────');
    console.log(`To: ${to}\nSubject: ${subject}\n\n${text}`);
    console.log('─────────────────────────────────────────────────\n');
    return { status: 'Sent', channel: 'stub', verificationUrl };
  }

  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || `"Kanan HR" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html
    });
    console.log(`Welcome email to ${to} — messageId: ${info.messageId}, response: ${info.response}, accepted: ${JSON.stringify(info.accepted)}, rejected: ${JSON.stringify(info.rejected)}`);
    if (info.rejected?.length) {
      return { status: 'Failed', channel: 'smtp', verificationUrl };
    }
    return { status: 'Sent', channel: 'smtp', verificationUrl };
  } catch (err) {
    console.error('Failed to send welcome email:', err.message);
    return { status: 'Failed', channel: 'smtp', verificationUrl };
  }
}

function buildOfferEmail({ name, designation, department, branch, joiningDate, ctc, offerExpiryDate }) {
  const dateOpts = { day: '2-digit', month: 'long', year: 'numeric' };
  const joinStr = new Date(joiningDate).toLocaleDateString('en-GB', dateOpts);
  const expiryStr = offerExpiryDate ? new Date(offerExpiryDate).toLocaleDateString('en-GB', dateOpts) : null;
  const subject = `Your Offer of Employment — ${designation} at Kanan`;
  const text = `Dear ${name},\n\nCongratulations! We are pleased to offer you the position of ${designation}${department ? ` in ${department}` : ''}${branch ? ` (${branch})` : ''} at Kanan.\n\nProposed Joining Date: ${joinStr}${ctc ? `\nCTC: ${ctc}` : ''}${expiryStr ? `\n\nPlease confirm your acceptance by ${expiryStr}.` : ''}\n\nWe look forward to welcoming you to the team.\n\nRegards,\nHR Team\nKanan`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#1A3A8F">Offer of Employment</h2>
      <p>Dear ${name},</p>
      <p>Congratulations! We are pleased to offer you the position of <strong>${designation}</strong>${department ? ` in ${department}` : ''}${branch ? ` (${branch})` : ''} at Kanan.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr><td style="padding:6px 0;color:#7886A8;font-size:13px">Joining Date</td><td style="padding:6px 0;font-weight:600">${joinStr}</td></tr>
        ${ctc ? `<tr><td style="padding:6px 0;color:#7886A8;font-size:13px">CTC</td><td style="padding:6px 0;font-weight:600">${ctc}</td></tr>` : ''}
      </table>
      ${expiryStr ? `<p style="color:#7886A8;font-size:12px">Please confirm your acceptance by <strong>${expiryStr}</strong>.</p>` : ''}
      <p>We look forward to welcoming you to the team.</p>
      <p>Regards,<br/>HR Team<br/>Kanan</p>
    </div>`;
  return { subject, text, html };
}

export async function sendOfferEmail({ to, name, designation, department, branch, joiningDate, ctc, offerExpiryDate }) {
  const { subject, text, html } = buildOfferEmail({ name, designation, department, branch, joiningDate, ctc, offerExpiryDate });
  const t = getTransporter();

  if (!t) {
    console.log('\n──────── [STUB EMAIL — no SMTP configured] ────────');
    console.log(`To: ${to}\nSubject: ${subject}\n\n${text}`);
    console.log('─────────────────────────────────────────────────\n');
    return { status: 'Sent', channel: 'stub' };
  }

  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || `"Kanan HR" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html
    });
    console.log(`Offer email to ${to} — messageId: ${info.messageId}, response: ${info.response}, accepted: ${JSON.stringify(info.accepted)}, rejected: ${JSON.stringify(info.rejected)}`);
    if (info.rejected?.length) {
      return { status: 'Failed', channel: 'smtp' };
    }
    return { status: 'Sent', channel: 'smtp' };
  } catch (err) {
    console.error('Failed to send offer email:', err.message);
    return { status: 'Failed', channel: 'smtp' };
  }
}
