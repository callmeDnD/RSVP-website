const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const validator = require('validator');
const db = require('../config/db');
const { getEvent, str, isSafeUrl } = require('../utils/helpers');
const { validate } = require('./rsvpController');
const { sendRsvpEmail } = require('../utils/emailTemplates');
const reminders = require('../utils/reminders');

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12); // keeps login timing similar for unknown emails

exports.login = async (req, res) => {
  const email = str(req.body.email).toLowerCase();
  const [rows] = await db.execute('SELECT id, name, email, password_hash FROM admins WHERE email = ?', [email]);
  const admin = rows[0];
  const ok = await bcrypt.compare(String(req.body.password || ''), admin ? admin.password_hash : DUMMY_HASH);
  if (!admin || !ok) return res.status(401).json({ error: 'Incorrect email or password.' });
  await new Promise((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve()))); // prevents session fixation
  req.session.adminId = admin.id;
  req.session.adminName = admin.name;
  await db.execute('UPDATE admins SET last_login = NOW() WHERE id = ?', [admin.id]);
  res.json({ ok: true, name: admin.name, email: admin.email });
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.json({ ok: true });
  });
};

exports.me = async (req, res) => {
  const [rows] = await db.execute('SELECT name, email FROM admins WHERE id = ?', [req.session.adminId]);
  res.json(rows[0]);
};

exports.stats = async (req, res) => {
  const ev = await getEvent();
  const [by] = await db.execute('SELECT status, COUNT(*) AS regs, COALESCE(SUM(guests),0) AS guests FROM rsvps WHERE event_id=? GROUP BY status', [ev.id]);
  const [days] = await db.execute(
    'SELECT DATE(created_at) AS d, COUNT(*) AS n FROM rsvps WHERE event_id=? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) GROUP BY DATE(created_at) ORDER BY d',
    [ev.id]
  );
  const byStatus = { attending: 0, not_attending: 0, maybe: 0, cancelled: 0 };
  let attendingGuests = 0, total = 0;
  for (const r of by) {
    byStatus[r.status] = Number(r.regs);
    if (r.status !== 'cancelled') total += Number(r.regs);
    if (r.status === 'attending') attendingGuests = Number(r.guests);
  }
  const [[msgs]] = await db.execute('SELECT COUNT(*) AS n FROM contact_messages');
  res.json({ totalRegistrations: total, attendingGuests, capacity: ev.capacity, byStatus, byDay: days.map((x) => ({ d: x.d, n: Number(x.n) })), messages: Number(msgs.n) });
};

async function queryRsvps(q) {
  const where = ['r.event_id = (SELECT id FROM events ORDER BY id LIMIT 1)'];
  const params = [];
  const status = str(q.status);
  if (['attending', 'not_attending', 'maybe', 'cancelled'].includes(status)) { where.push('r.status = ?'); params.push(status); }
  const term = str(q.q);
  if (term) {
    const like = `%${term.replace(/[%_\\]/g, '\\$&')}%`;
    where.push('(a.full_name LIKE ? OR a.email LIKE ? OR a.organization LIKE ? OR r.reference_no LIKE ?)');
    params.push(like, like, like, like);
  }
  const [rows] = await db.execute(
    `SELECT r.id, r.reference_no, r.status, r.guests, r.message, r.created_at, r.updated_at,
            a.full_name, a.email, a.phone, a.organization
       FROM rsvps r JOIN attendees a ON a.id = r.attendee_id
      WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC LIMIT 1000`,
    params
  );
  return rows;
}

exports.listRsvps = async (req, res) => res.json(await queryRsvps(req.query));

exports.exportCsv = async (req, res) => {
  const rows = await queryRsvps(req.query);
  // Prefix risky leading characters so spreadsheets do not run attendee text as a formula
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ['Reference', 'Name', 'Email', 'Phone', 'Organization', 'Status', 'Guests', 'Message', 'Registered at', 'Last updated'];
  const lines = [head.map(cell).join(',')];
  for (const r of rows) lines.push([r.reference_no, r.full_name, r.email, r.phone, r.organization, r.status, r.guests, r.message, r.created_at, r.updated_at].map(cell).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="attendees.csv"');
  res.send('\ufeff' + lines.join('\r\n'));
};

exports.updateRsvp = async (req, res) => {
  const id = +req.params.id;
  const [rows] = await db.execute(
    'SELECT r.id, r.attendee_id, r.reference_no, r.token, a.email FROM rsvps r JOIN attendees a ON a.id=r.attendee_id WHERE r.id=?', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Registration not found.' });
  const { d, e } = validate({ ...req.body, email: rows[0].email }, { admin: true });
  if (Object.keys(e).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', details: e });
  await db.execute('UPDATE attendees SET full_name=?, phone=?, organization=? WHERE id=?', [d.full_name, d.phone, d.organization, rows[0].attendee_id]);
  await db.execute('UPDATE rsvps SET guests=?, status=?, message=? WHERE id=?', [d.guests, d.status, d.message, id]);
  let emailSent = false;
  if (req.body.notify) emailSent = await sendRsvpEmail(d.status === 'cancelled' ? 'cancelled' : 'updated', await getEvent(), { ...rows[0], ...d });
  res.json({ ok: true, emailSent });
};

exports.deleteRsvp = async (req, res) => {
  const [rows] = await db.execute('SELECT attendee_id FROM rsvps WHERE id=?', [+req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Registration not found.' });
  await db.execute('DELETE FROM rsvps WHERE id=?', [+req.params.id]);
  await db.execute('DELETE FROM attendees WHERE id=? AND NOT EXISTS (SELECT 1 FROM rsvps WHERE attendee_id=?)', [rows[0].attendee_id, rows[0].attendee_id]);
  res.json({ ok: true });
};

const EVENT_TEXT = ['title', 'tagline', 'short_intro', 'description', 'purpose', 'objectives', 'organizer_info', 'venue_name', 'venue_address',
  'transport_info', 'landmarks', 'venue_notes', 'live_stream_note', 'contact_phone'];
const EVENT_URLS = ['map_embed_url', 'hero_image', 'venue_image', 'promo_video_url', 'live_stream_url', 'facebook_url', 'instagram_url', 'x_url', 'youtube_url'];
const dt = (v) => (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(v) ? v.replace('T', ' ').padEnd(19, ':00') : null);

exports.getEventAdmin = async (req, res) => res.json(await getEvent());

exports.updateEvent = async (req, res) => {
  const b = req.body, d = {}, errors = {};
  for (const k of EVENT_TEXT) if (k in b) d[k] = str(b[k]) || null;
  for (const k of EVENT_URLS) if (k in b) {
    const v = str(b[k]) || null;
    if (v && !isSafeUrl(v)) errors[k] = 'Use a full http(s) link.';
    d[k] = v;
  }
  if (!d.title) errors.title = 'Event name is required.';
  d.start_at = dt(str(b.start_at)); d.end_at = dt(str(b.end_at));
  if (!d.start_at) errors.start_at = 'Enter a valid start date and time.';
  if (!d.end_at) errors.end_at = 'Enter a valid end date and time.';
  if (d.start_at && d.end_at && d.end_at < d.start_at) errors.end_at = 'End must be after the start.';
  d.tz_offset = str(b.tz_offset) || '+08:00';
  if (!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(d.tz_offset)) errors.tz_offset = 'Use the format +08:00.';
  const email = str(b.contact_email);
  if (email && !validator.isEmail(email)) errors.contact_email = 'Enter a valid email address.';
  d.contact_email = email || null;
  d.capacity = b.capacity === '' || b.capacity == null ? null : parseInt(b.capacity, 10);
  if (d.capacity !== null && !(d.capacity >= 0)) errors.capacity = 'Enter a number or leave blank.';
  d.rsvp_open = b.rsvp_open ? 1 : 0;
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fix the highlighted fields.', details: errors });
  const ev = await getEvent();
  const keys = Object.keys(d);
  await db.execute(`UPDATE events SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`, [...keys.map((k) => d[k]), ev.id]);
  res.json({ ok: true });
};

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
exports.uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', '..', 'uploads'),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + EXT[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(Object.assign(new Error('Upload a JPG, PNG, WebP or GIF image.'), { status: 400 }))),
}).single('file');

exports.upload = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
  res.status(201).json({ url: '/uploads/' + req.file.filename });
};

exports.runReminders = async (req, res) => res.json(await reminders.run());
