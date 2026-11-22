const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes – verify JWT
exports.protect = async (req, res, next) => {
  let token;

  // Parse the signed session cookie without requiring a second cookie parser dependency.
  if (!req.cookies) {
    req.cookies = {};
    (req.headers.cookie || '').split(';').filter(Boolean).forEach(part => {
      const index = part.indexOf('=');
      if (index < 0) return;
      try { req.cookies[decodeURIComponent(part.slice(0,index).trim())] = decodeURIComponent(part.slice(index+1).trim()); } catch (_) {}
    });
  }

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && (req.cookies.lexassist_session || req.cookies.token)) {
    token = req.cookies.lexassist_session || req.cookies.token;
  }

  if (!token) return res.status(401).json({ success: false, message: 'Not authorized – no token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ success: false, message: 'User no longer exists' });
    if (!req.user.isActive) return res.status(401).json({ success: false, message: 'Account deactivated' });
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Role-based access
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: `Role '${req.user.role}' is not authorized` });
  }
  next();
};
