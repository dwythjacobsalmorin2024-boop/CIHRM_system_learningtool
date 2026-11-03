function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: 'Please sign in.' });
  next();
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ message: 'Please sign in.' });
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ message: 'You do not have permission for this action.' });
    }
    next();
  };
}

module.exports = { requireAuth, allowRoles };
