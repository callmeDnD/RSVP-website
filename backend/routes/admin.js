const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { wrap } = require('../utils/helpers');
const { requireAdmin, requireXhr } = require('../middleware/auth');
const a = require('../controllers/adminController');
const crud = require('../controllers/crud');

const loginLimiter = rateLimit({ windowMs: 15 * 60e3, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' } });
router.post('/login', requireXhr, loginLimiter, wrap(a.login));

router.use(requireAdmin, requireXhr);
router.post('/logout', a.logout);
router.get('/me', wrap(a.me));
router.get('/stats', wrap(a.stats));

router.get('/rsvps', wrap(a.listRsvps));
router.get('/rsvps/export.csv', wrap(a.exportCsv));
router.put('/rsvps/:id', wrap(a.updateRsvp));
router.delete('/rsvps/:id', wrap(a.deleteRsvp));
router.post('/reminders/run', wrap(a.runReminders));

router.get('/event', wrap(a.getEventAdmin));
router.put('/event', wrap(a.updateEvent));
router.post('/upload', a.uploadMiddleware, a.upload);

const resources = {
  schedules: crud('schedules', { cols: ['day_date', 'start_time', 'end_time', 'title', 'description', 'location', 'speaker_id', 'is_highlight'], required: ['day_date', 'start_time', 'title'], order: 'day_date, start_time' }),
  speakers: crud('speakers', { cols: ['name', 'role_title', 'type', 'bio', 'photo_url', 'sort_order'], required: ['name'], order: 'sort_order, id', urls: ['photo_url'] }),
  announcements: crud('announcements', { cols: ['title', 'body', 'is_pinned'], required: ['title', 'body'], order: 'is_pinned DESC, created_at DESC' }),
  gallery: crud('gallery', { cols: ['media_type', 'url', 'caption', 'sort_order'], required: ['media_type', 'url'], order: 'sort_order, id', urls: ['url'] }),
};
for (const [name, c] of Object.entries(resources)) {
  router.get(`/${name}`, wrap(c.list));
  router.post(`/${name}`, wrap(c.create));
  router.put(`/${name}/:id`, wrap(c.update));
  router.delete(`/${name}/:id`, wrap(c.remove));
}
const messages = crud('contact_messages', { cols: [], order: 'created_at DESC', perEvent: false });
router.get('/messages', wrap(messages.list));
router.delete('/messages/:id', wrap(messages.remove));

module.exports = router;
