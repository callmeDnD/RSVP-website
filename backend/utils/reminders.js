const cron = require('node-cron');
const db = require('../config/db');
const { getEvent } = require('./helpers');
const { sendRsvpEmail } = require('./emailTemplates');
const { enabled } = require('../config/mailer');

// Sends one reminder per RSVP (attending or maybe) once the event is less than 24 hours away.
async function run() {
  const ev = await getEvent();
  if (!ev) return { sent: 0, note: 'No event found.' };
  const ms = new Date(ev.start_at.replace(' ', 'T') + ev.tz_offset) - Date.now();
  if (ms <= 0 || ms > 24 * 3600e3) return { sent: 0, note: 'The event is not starting within the next 24 hours.' };
  if (!enabled()) return { sent: 0, note: 'SMTP is not configured.' };

  const [rows] = await db.execute(
    `SELECT r.id, r.reference_no, r.token, r.guests, r.status, a.full_name, a.email
       FROM rsvps r JOIN attendees a ON a.id = r.attendee_id
      WHERE r.event_id = ? AND r.status IN ('attending','maybe') AND r.reminder_sent = 0`,
    [ev.id]
  );
  let sent = 0;
  for (const r of rows) {
    if (await sendRsvpEmail('reminder', ev, r)) {
      await db.execute('UPDATE rsvps SET reminder_sent = 1 WHERE id = ?', [r.id]);
      sent++;
    }
  }
  return { sent, note: `${sent} of ${rows.length} reminders sent.` };
}

exports.run = run;
exports.start = () => cron.schedule('0 * * * *', () => run().catch((e) => console.error('[reminders]', e.message)));
