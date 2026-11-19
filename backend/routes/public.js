const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { wrap } = require('../utils/helpers');
const site = require('../controllers/siteController');
const rsvp = require('../controllers/rsvpController');

const limit = (windowMin, max, msg) =>
  rateLimit({ windowMs: windowMin * 60e3, max, standardHeaders: true, legacyHeaders: false, message: { error: msg } });

router.get('/site', wrap(site.site));
router.post('/rsvp', limit(60, 15, 'Too many registrations from this connection. Try again later.'), wrap(rsvp.create));
router.post('/rsvp/lookup', limit(15, 30, 'Too many lookups. Try again in a few minutes.'), wrap(rsvp.lookup));
router.put('/rsvp/manage', limit(15, 30, 'Too many attempts. Try again in a few minutes.'), wrap(rsvp.update));
router.post('/rsvp/cancel', limit(15, 30, 'Too many attempts. Try again in a few minutes.'), wrap(rsvp.cancel));
router.post('/contact', limit(60, 8, 'Too many messages. Try again later.'), wrap(site.contact));

module.exports = router;
