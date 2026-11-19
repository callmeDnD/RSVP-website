const validator = require('validator');
const { send } = require('../config/mailer');

const esc = validator.escape;
const wall = (dt, opts) => new Date(String(dt).replace(' ', 'T') + 'Z').toLocaleString('en-PH', { timeZone: 'UTC', ...opts });
const STATUS = { attending: 'Attending', not_attending: 'Not attending', maybe: 'Maybe', cancelled: 'Cancelled' };

const COPY = {
  confirmation: {
    subject: (ev) => `You're registered: ${ev.title}`,
    head: 'Your RSVP is confirmed',
    intro: 'Thanks for registering. Keep this email: your reference number is how you find your RSVP later.',
  },
  updated: {
    subject: (ev) => `Your RSVP was updated: ${ev.title}`,
    head: 'Your RSVP was updated',
    intro: 'Your RSVP details were changed. If you did not make this change, contact the organizers.',
  },
  cancelled: {
    subject: (ev) => `Your RSVP was cancelled: ${ev.title}`,
    head: 'Your RSVP was cancelled',
    intro: 'We have cancelled your RSVP. You can change your mind any time before the event using the link below.',
  },
  reminder: {
    subject: (ev) => `Reminder: ${ev.title} is coming up`,
    head: 'See you soon',
    intro: 'The event starts within 24 hours. Here are your details.',
  },
};

function build(kind, ev, r) {
  const c = COPY[kind];
  const base = (process.env.APP_URL || '').replace(/\/$/, '' || process.env.BASE_URL || '').replace(/\/$/, '');
  const link = `${base}/manage?token=${encodeURIComponent(r.token)}`;
  const date = wall(ev.start_at, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const time = `${wall(ev.start_at, { hour: 'numeric', minute: '2-digit' })} to ${wall(ev.end_at, { hour: 'numeric', minute: '2-digit' })}`;
  const row = (k, v) => `<tr><td style="padding:8px 0;color:#4d6a70;width:38%;vertical-align:top">${k}</td><td style="padding:8px 0;color:#0c2229;font-weight:600">${v}</td></tr>`;
  const rows = [
    row('Reference number', esc(r.reference_no)),
    row('Event', esc(ev.title)),
    row('Date', esc(date)),
    row('Time', esc(time)),
    row('Venue', esc([ev.venue_name, ev.venue_address].filter(Boolean).join(', '))),
    row('Status', esc(STATUS[r.status] || r.status)),
    r.status !== 'not_attending' && r.status !== 'cancelled' ? row('Guests', esc(String(r.guests))) : '',
  ].join('');

  const html = `<!doctype html><html><body style="margin:0;background:#eaf3f2;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:#08303a;padding:28px 32px"><div style="color:#f4b223;font-size:14px">${esc(ev.title)}</div>
<div style="color:#ffffff;font-size:26px;font-weight:bold;padding-top:6px">${c.head}</div></td></tr>
<tr><td style="padding:28px 32px">
<p style="margin:0 0 16px;color:#0c2229;font-size:16px">Hi ${esc(r.full_name)},</p>
<p style="margin:0 0 20px;color:#4d6a70;font-size:15px;line-height:1.5">${c.intro}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #cfe0de;border-bottom:1px solid #cfe0de;font-size:15px">${rows}</table>
<p style="margin:28px 0 0"><a href="${esc(link)}" style="background:#f4b223;color:#08303a;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block">Update or cancel your RSVP</a></p>
<p style="margin:20px 0 0;color:#4d6a70;font-size:13px">Questions? Reply to ${esc(ev.contact_email || 'the organizers')}.</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [c.head, '', c.intro, '', `Reference: ${r.reference_no}`, `Event: ${ev.title}`, `Date: ${date}`, `Time: ${time}`,
    `Venue: ${[ev.venue_name, ev.venue_address].filter(Boolean).join(', ')}`, '', `Manage your RSVP: ${link}`].join('\n');
  return { subject: c.subject(ev), html, text };
}

exports.sendRsvpEmail = (kind, ev, r) => send({ to: r.email, ...build(kind, ev, r) });
exports.sendPlain = send;
