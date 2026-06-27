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
    from:        `"No Reply | EEMAgine" <${config.email.user}>`,
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

module.exports = { sendEmail };
