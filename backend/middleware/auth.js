// Admin routes: must have a logged-in session. Mutating requests must also carry a custom header,
// which browsers will not send cross-site without a CORS preflight (CSRF defence on top of SameSite cookies).
exports.requireAdmin = (req, res, next) => {
  if (!req.session?.adminId) return res.status(401).json({ error: 'Please sign in.' });
  next();
};

exports.requireXhr = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') return res.status(403).json({ error: 'Blocked request.' });
  next();
};
