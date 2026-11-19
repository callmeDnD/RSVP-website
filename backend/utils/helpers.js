const db = require('../config/db');

// Wrap async route handlers so rejected promises reach the error handler (Express 4)
exports.wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Strip control characters and trim. Output is escaped where it is rendered (frontend + emails), not here.
exports.clean = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() : v);
exports.str = (v) => exports.clean(String(v ?? ''));

// This app runs one event; it is the first row of `events`.
exports.getEvent = async () => {
  const [rows] = await db.execute('SELECT * FROM events ORDER BY id LIMIT 1');
  return rows[0] || null;
};

exports.isSafeUrl = (u) => /^https?:\/\/[^\s]+$/i.test(u) || /^\/uploads\/[\w.-]+$/.test(u);
