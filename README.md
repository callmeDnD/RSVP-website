# Event Website with RSVP and Admin Dashboard

Node.js + Express + MySQL backend, vanilla HTML/CSS/JS frontend, Nodemailer for email.
The sample event ("Laguna Youth Innovation Summit 2027") is placeholder content. Change everything in the admin dashboard.

## Folder layout
```
backend/    server.js, config/ (db, mailer), routes/, controllers/, middleware/, utils/ (email templates, reminders)
database/   schema.sql, seed.sql, setup.js, seedAdmin.js
frontend/   index.html, manage.html, admin.html, css/, js/
uploads/    images uploaded from the dashboard
```

## Run locally
1. Install Node 18+ and MySQL 8 (MySQL 8.0.16+ is needed for CHECK constraints).
2. `npm install`
3. `cp .env.example .env` and fill in: `SESSION_SECRET`, the `DB_*` values, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (10+ characters), and SMTP settings.
4. `npm run db:setup` creates the database, all tables and sample content.
   (Or run `database/schema.sql` then `database/seed.sql` yourself with the mysql client.)
5. `npm run seed-admin` creates the admin account from `.env`. Run it again to reset that admin's password.
6. `npm start`, then open http://localhost:3000 (site) and http://localhost:3000/admin (dashboard).

## Email (Nodemailer / SMTP)
Fill `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Gmail needs an App Password (2-step verification on), host `smtp.gmail.com`, port 587, `SMTP_SECURE=false`.
If SMTP is not set, RSVPs are still saved and the success screen still shows the reference number. Emails are skipped and logged to the console.
Emails sent: confirmation, update, cancellation, and a reminder. The reminder job runs hourly and emails attending and maybe RSVPs once when the event is less than 24 hours away. In the dashboard, "Send reminders now" runs the same job.
`APP_URL` must be your public address so the links in emails work.

## Deploy
Any Node host with MySQL works (Render, Railway, a VPS, cPanel Node apps).
- Set the same environment variables, plus `NODE_ENV=production` and `APP_URL=https://your-domain`.
- Serve over HTTPS (session cookies are `secure` in production). The app trusts one proxy hop in production.
- Run `npm run db:setup` and `npm run seed-admin` once against the production database (use your host's shell, or run them locally with the production `DB_*` values).
- Uploaded images live in `uploads/`. On hosts with ephemeral disks, attach a persistent volume or paste image links instead of uploading.

## Security notes
Passwords are hashed with bcrypt (cost 12). All SQL uses bound parameters and a column whitelist. Input is trimmed and validated on the server, and all text is HTML-escaped where it is displayed (pages and emails). Admin routes require a session; state-changing admin requests also need an `X-Requested-With` header. Login, RSVP, lookup and contact endpoints are rate limited. Uploads are limited to JPG/PNG/WebP/GIF, 5 MB. Helmet sets security headers and a content security policy.

## Behavior to know
- One RSVP per email address. A repeat attempt is refused and points the person to their manage link.
- Attendees update or cancel at `/manage` using the secure link in their email, or reference number plus email. Cancelling keeps the record with status Cancelled and can be undone.
- The site runs one event: the first row in `events`.
- Event times are saved as local wall-clock time plus a UTC offset (default +08:00).
