// Sends email through the Mailjet HTTPS API (works on hosts that block SMTP ports).
// SMTP_USER = Mailjet API Key, SMTP_PASS = Mailjet Secret Key.
const enabled = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

async function send({ to, subject, html, text }) {
  if (!enabled()) {
    console.warn(`[mail] not configured, skipped: "${subject}" -> ${to}`);
    return false;
  }
  const m = /^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/.exec(process.env.MAIL_FROM || '');
  const from = m
    ? { Email: m[2].trim(), Name: (m[1] || '').trim() }
    : { Email: (process.env.MAIL_FROM || '').trim() };
  try {
    const res = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${process.env.SMTP_USER}:${process.env.SMTP_PASS}`).toString('base64'),
      },
      body: JSON.stringify({ Messages: [{ From: from, To: [{ Email: to }], Subject: subject, TextPart: text, HTMLPart: html }] }),
    });
    if (!res.ok) {
      console.error('[mail] failed:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[mail] failed:', err.message);
    return false;
  }
}

module.exports = { send, enabled };