// Usage: npm run db:setup  (creates the database, tables, and sample content if the events table is empty)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const name = process.env.DB_NAME || 'event_rsvp';
  if (!/^\w+$/.test(name)) throw new Error('DB_NAME may only contain letters, digits and underscores.');
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: +process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });
  await c.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8').replace(/event_rsvp/g, name));
  await c.query(`USE \`${name}\``);
  const [[{ n }]] = await c.query('SELECT COUNT(*) AS n FROM events');
  if (!n) {
    await c.query(fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8'));
    console.log('Sample event content loaded.');
  }
  console.log(`Database "${name}" is ready.`);
  await c.end();
})().catch((e) => { console.error('Setup failed:', e.message); process.exit(1); });
