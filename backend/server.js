require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const rateLimit = require('express-rate-limit');
const db = require('./config/db');

const prod = process.env.NODE_ENV === 'production';
if ((process.env.SESSION_SECRET || '').length < 32) {
  console.error('SESSION_SECRET must be set in .env (32+ characters).');
  process.exit(1);
}
const ROOT = path.join(__dirname, '..');
fs.mkdirSync(path.join(ROOT, 'uploads'), { recursive: true });

const app = express();
if (prod) app.set('trust proxy', 1); // behind a hosting proxy (Render, Railway, Nginx...)

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      frameSrc: ['https://www.youtube-nocookie.com', 'https://www.youtube.com', 'https://player.vimeo.com', 'https://www.google.com', 'https://maps.google.com'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: prod ? [] : null,
    },
  },
}));
app.use(express.json({ limit: '100kb' }));
app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new MySQLStore({}, db),
  cookie: { httpOnly: true, sameSite: 'lax', secure: prod, maxAge: 4 * 60 * 60 * 1000 },
}));
app.use('/api', rateLimit({ windowMs: 60e3, max: 150, standardHeaders: true, legacyHeaders: false }));

app.use('/uploads', express.static(path.join(ROOT, 'uploads'), { index: false, setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff') }));
app.use('/api', require('./routes/public'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(express.static(path.join(ROOT, 'frontend'), { extensions: ['html'] })); // /admin -> admin.html, /manage -> manage.html

const BAD_INPUT = new Set(['ER_BAD_NULL_ERROR', 'ER_TRUNCATED_WRONG_VALUE', 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 'ER_WRONG_VALUE_FOR_TYPE',
  'ER_NO_REFERENCED_ROW_2', 'WARN_DATA_TRUNCATED', 'ER_DATA_TOO_LONG', 'ER_CHECK_CONSTRAINT_VIOLATED']);
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'That file is larger than 5 MB.' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  if (BAD_INPUT.has(err.code)) return res.status(400).json({ error: 'One of the values is not valid. Check the fields and try again.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

const port = +process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Event site running at http://localhost:${port}`);
  require('./utils/reminders').start();
});
