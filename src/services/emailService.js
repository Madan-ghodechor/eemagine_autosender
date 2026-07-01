const nodemailer = require('nodemailer');
const path   = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host:   config.email.host,
    port:   config.email.port,
    secure: config.email.secure,
    auth:   { user: config.email.user, pass: config.email.pass },
  });
  return transporter;
}

// attachments: string (file path) or nodemailer attachment object
async function sendEmail({ to, subject, text, html, attachments = [] }) {
  if (!config.email.user || !config.email.pass) {
    throw new Error('Email credentials not configured. Set EMAIL_USER and EMAIL_PASS in .env');
  }

  const builtAttachments = attachments.map((a) =>
    typeof a === 'string' ? { filename: path.basename(a), path: a } : a
  );

  const info = await getTransporter().sendMail({
    from:        `${process.env.EMAIL_FROM_NAME} <${config.email.user}>`,
    to:          Array.isArray(to) ? to.join(', ') : to,
    bcc:         'madan.ghodechor@cotrav.co',
    subject,
    text,
    html,
    attachments: builtAttachments,
  });

  logger.success(`Email sent to ${Array.isArray(to) ? to.join(', ') : to} | ${info.messageId}`);
  return info;
}

// ── Inconvenience notice — standalone, no voucher attachment ──
async function sendInconvenienceEmail({ to, guestName }) {
  const contactNumber = process.env.CONTACT_NUMBER || '';
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a202c;line-height:1.8;font-size:15px;">
      <p>Dear ${guestName},</p>
      <p>We sincerely apologise for the confusion caused.</p>
      <p>You may have received a hotel booking confirmation email &amp; message from us earlier. Unfortunately, this communication was sent in error.</p>
      <p>Please note that your hotel booking is <strong>currently pending confirmation</strong>, as we are awaiting receipt of your payment. We kindly request that you disregard the previous confirmation email and voucher.</p>
      <p>As soon as the payment is received and your booking is successfully confirmed, we will promptly send you the updated confirmation and hotel voucher.</p>
      <p>We truly regret any inconvenience this may have caused and greatly appreciate your patience and understanding. If you have any questions or need any assistance, please feel free to contact us at <strong>${contactNumber}</strong>. We are here to help.</p>
      <br/>
      <p style="margin:0">Warm regards,</p>
      <p style="margin:4px 0 0;font-weight:600;">Team CoTrav</p>
    </div>
  `;

  return sendEmail({
    to,
    subject: 'Update Regarding Your Hotel Booking Status',
    html,
  });
}

module.exports = { sendEmail, sendInconvenienceEmail };
