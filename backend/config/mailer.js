const nodemailer = require('nodemailer');

let transporter;
const enabled = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

async function send({ to, subject, html, text }) {
  if (!enabled()) {
    console.warn(`[mail] SMTP not configured, skipped: "${subject}" -> ${to}`);
    return false;
  }
  try {
    transporter ||= nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: +process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, html, text });
    return true;
  } catch (err) {
    console.error('[mail] failed:', err.message);
    return false;
  }
}

module.exports = { send, enabled };
