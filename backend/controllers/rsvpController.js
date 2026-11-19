const crypto = require('crypto');
const validator = require('validator');
const db = require('../config/db');
const { getEvent, str } = require('../utils/helpers');
const { sendRsvpEmail } = require('../utils/emailTemplates');

const PUBLIC_STATUSES = ['attending', 'not_attending', 'maybe'];
const newRef = () => 'RSVP-' + crypto.randomBytes(5).toString('hex').toUpperCase();

function validate(b, { creating = false, admin = false } = {}) {
  const d = {
    full_name: str(b.full_name),
    email: str(b.email).toLowerCase(),
    phone: str(b.phone),
    organization: str(b.organization) || null,
    guests: parseInt(b.guests, 10),
    status: b.status,
    message: str(b.message) || null,
  };
  const e = {};
  if (d.full_name.length < 2 || d.full_name.length > 120) e.full_name = 'Enter your full name.';
  if (creating && (!validator.isEmail(d.email) || d.email.length > 190)) e.email = 'Enter a valid email address.';
  if (!/^[0-9+()\-.\s]{7,25}$/.test(d.phone)) e.phone = 'Enter a valid contact number.';
  if (!(admin ? [...PUBLIC_STATUSES, 'cancelled'] : PUBLIC_STATUSES).includes(d.status)) e.status = 'Choose your attendance status.';
  if (d.status === 'not_attending') d.guests = 0;
  else if (!(d.guests >= 1 && d.guests <= 10)) e.guests = 'Guests must be between 1 and 10.';
  if (d.organization && d.organization.length > 160) e.organization = 'Keep this under 160 characters.';
  if (d.message && d.message.length > 1000) e.message = 'Keep your message under 1000 characters.';
  return { d, e };
}

async function seatsLeft(ev, excludeId = 0) {
  if (!ev.capacity) return Infinity;
  const [[r]] = await db.execute("SELECT COALESCE(SUM(guests),0) AS n FROM rsvps WHERE event_id=? AND status='attending' AND id<>?", [ev.id, excludeId]);
  return ev.capacity - Number(r.n);
}

// Find an RSVP by secure token (email link) or by reference number + email.
async function find(b) {
  const token = str(b.token), reference = str(b.reference).toUpperCase(), email = str(b.email).toLowerCase();
  const sel = `SELECT r.id, r.event_id, r.reference_no, r.token, r.guests, r.status, r.message, r.created_at,
                      a.id AS attendee_id, a.full_name, a.email, a.phone, a.organization
                 FROM rsvps r JOIN attendees a ON a.id = r.attendee_id WHERE `;
  let rows;
  if (/^[a-f0-9]{48}$/.test(token)) [rows] = await db.execute(sel + 'r.token = ?', [token]);
  else if (reference && validator.isEmail(email)) [rows] = await db.execute(sel + 'r.reference_no = ? AND a.email = ?', [reference, email]);
  else return null;
  return rows[0] || null;
}
const publicView = ({ token, id, attendee_id, event_id, ...rest }) => rest;
const NOT_FOUND = { error: 'We could not find that RSVP. Check the reference number and email, or use the link in your confirmation email.' };

exports.validate = validate;

exports.create = async (req, res) => {
  const ev = await getEvent();
  if (!ev) return res.status(404).json({ error: 'No event has been set up yet.' });
  if (!ev.rsvp_open) return res.status(403).json({ error: 'Registration is closed.' });
  const { d, e } = validate(req.body, { creating: true });
  if (Object.keys(e).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', details: e });
  if (d.status === 'attending' && d.guests > (await seatsLeft(ev))) return res.status(409).json({ error: 'There are not enough seats left for that many guests.' });

  const token = crypto.randomBytes(24).toString('hex');
  const reference = newRef();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [found] = await conn.execute('SELECT id FROM attendees WHERE email = ?', [d.email]);
    let attendeeId;
    if (found.length) {
      attendeeId = found[0].id;
      const [dup] = await conn.execute('SELECT id FROM rsvps WHERE event_id = ? AND attendee_id = ?', [ev.id, attendeeId]);
      if (dup.length) {
        await conn.rollback();
        return res.status(409).json({ error: 'This email is already registered. Use the link in your confirmation email, or your reference number, to update your RSVP.' });
      }
      await conn.execute('UPDATE attendees SET full_name=?, phone=?, organization=? WHERE id=?', [d.full_name, d.phone, d.organization, attendeeId]);
    } else {
      const [r] = await conn.execute('INSERT INTO attendees (full_name,email,phone,organization) VALUES (?,?,?,?)', [d.full_name, d.email, d.phone, d.organization]);
      attendeeId = r.insertId;
    }
    await conn.execute(
      'INSERT INTO rsvps (event_id,attendee_id,reference_no,token,guests,status,message) VALUES (?,?,?,?,?,?,?)',
      [ev.id, attendeeId, reference, token, d.guests, d.status, d.message]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This email is already registered, or the request was sent twice. Please check your inbox.' });
    throw err;
  } finally {
    conn.release();
  }
  const emailSent = await sendRsvpEmail('confirmation', ev, { ...d, reference_no: reference, token });
  res.status(201).json({ ok: true, reference, status: d.status, emailSent });
};

exports.lookup = async (req, res) => {
  const r = await find(req.body);
  if (!r) return res.status(404).json(NOT_FOUND);
  res.json(publicView(r));
};

exports.update = async (req, res) => {
  const ev = await getEvent();
  const r = await find(req.body);
  if (!r) return res.status(404).json(NOT_FOUND);
  if (!ev.rsvp_open) return res.status(403).json({ error: 'Registration is closed, so RSVPs can no longer be changed. Contact the organizers.' });
  const { d, e } = validate({ ...req.body, email: r.email });
  if (Object.keys(e).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', details: e });
  if (d.status === 'attending' && d.guests > (await seatsLeft(ev, r.id))) return res.status(409).json({ error: 'There are not enough seats left for that many guests.' });

  await db.execute('UPDATE attendees SET full_name=?, phone=?, organization=? WHERE id=?', [d.full_name, d.phone, d.organization, r.attendee_id]);
  await db.execute('UPDATE rsvps SET guests=?, status=?, message=? WHERE id=?', [d.guests, d.status, d.message, r.id]);
  const emailSent = await sendRsvpEmail('updated', ev, { ...r, ...d, email: r.email });
  res.json({ ok: true, emailSent });
};

exports.cancel = async (req, res) => {
  const ev = await getEvent();
  const r = await find(req.body);
  if (!r) return res.status(404).json(NOT_FOUND);
  await db.execute("UPDATE rsvps SET status='cancelled' WHERE id=?", [r.id]);
  const emailSent = await sendRsvpEmail('cancelled', ev, { ...r, status: 'cancelled' });
  res.json({ ok: true, emailSent });
};
