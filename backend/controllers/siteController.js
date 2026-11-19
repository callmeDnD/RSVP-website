const db = require('../config/db');
const validator = require('validator');
const { getEvent, str } = require('../utils/helpers');
const { sendPlain } = require('../utils/emailTemplates');

// One call returns everything the public page needs.
exports.site = async (req, res) => {
  const event = await getEvent();
  if (!event) return res.status(404).json({ error: 'No event has been set up yet.' });
  const [[speakers], [schedule], [gallery], [announcements]] = await Promise.all([
    db.execute('SELECT id,name,role_title,type,bio,photo_url FROM speakers ORDER BY sort_order, id'),
    db.execute(`SELECT s.id,s.day_date,s.start_time,s.end_time,s.title,s.description,s.location,s.is_highlight,sp.name AS speaker_name
                  FROM schedules s LEFT JOIN speakers sp ON sp.id = s.speaker_id ORDER BY s.day_date, s.start_time`),
    db.execute('SELECT id,media_type,url,caption FROM gallery ORDER BY sort_order, id'),
    db.execute('SELECT id,title,body,is_pinned,created_at FROM announcements ORDER BY is_pinned DESC, created_at DESC LIMIT 10'),
  ]);
  const [[seat]] = await db.execute("SELECT COALESCE(SUM(guests),0) AS n FROM rsvps WHERE event_id=? AND status='attending'", [event.id]);
  res.json({ event, speakers, schedule, gallery, announcements, seatsTaken: Number(seat.n) });
};

exports.contact = async (req, res) => {
  const name = str(req.body.name), email = str(req.body.email).toLowerCase();
  const subject = str(req.body.subject).slice(0, 200) || null, message = str(req.body.message);
  const errors = {};
  if (name.length < 2 || name.length > 120) errors.name = 'Enter your name.';
  if (!validator.isEmail(email)) errors.email = 'Enter a valid email address.';
  if (message.length < 5 || message.length > 3000) errors.message = 'Write a message (5 to 3000 characters).';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', details: errors });

  await db.execute('INSERT INTO contact_messages (name,email,subject,message) VALUES (?,?,?,?)', [name, email, subject, message]);
  const ev = await getEvent();
  if (ev?.contact_email) {
    const e = validator.escape;
    sendPlain({
      to: ev.contact_email,
      subject: `New inquiry: ${subject || 'Website contact form'}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p><strong>${e(name)}</strong> (${e(email)}) wrote:</p><p style="white-space:pre-wrap">${e(message)}</p>`,
    });
  }
  res.status(201).json({ ok: true });
};
