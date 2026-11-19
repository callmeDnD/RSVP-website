// Usage: set ADMIN_EMAIL and ADMIN_PASSWORD in .env, then: npm run seed-admin
// Re-running with the same email resets that admin's password.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const validator = require('validator');
const db = require('../backend/config/db');

(async () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const pw = process.env.ADMIN_PASSWORD || '';
  if (!validator.isEmail(email)) throw new Error('Set a valid ADMIN_EMAIL in .env');
  if (pw.length < 10) throw new Error('ADMIN_PASSWORD must be at least 10 characters');
  const hash = await bcrypt.hash(pw, 12);
  await db.execute(
    'INSERT INTO admins (name, email, password_hash) VALUES (?,?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), name=VALUES(name)',
    [process.env.ADMIN_NAME || 'Event Admin', email, hash]
  );
  console.log(`Admin ready: ${email}`);
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
