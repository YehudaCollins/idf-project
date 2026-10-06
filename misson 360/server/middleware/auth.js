const jwt = require('jsonwebtoken');
const User = require('../models/User');
const EnvPerm = require('../models/EnvironmentPermission');

/** בודק JWT ומוסיף req.user */
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'לא מורשה - חסר טוקן' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'משתמש לא נמצא' });
    next();
  } catch {
    res.status(401).json({ message: 'טוקן לא תקין' });
  }
};

/** מנהל על בלבד (role=admin) */
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'גישה מותרת למנהל על בלבד' });
  }
  next();
};

/**
 * requireEnvPermission(requiredType)
 *
 * requiredType = 'manager' | 'viewer'
 *
 * מנהל על עובר תמיד.
 * שאר המשתמשים צריכים רשומה ב-EnvironmentPermission.
 *
 * ה-environmentId נלקח מ:
 *   req.params.environmentId  || req.params.id (בנתיב /environments/:id) ||
 *   req.body.environmentId    || req.query.environmentId
 */
const requireEnvPermission = (requiredType = 'viewer') => async (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'לא מורשה' });

  // מנהל על עובר תמיד
  if (req.user.role === 'admin') return next();

  const envId =
    req.params.environmentId ||
    req.params.id ||
    req.body?.environmentId ||
    req.query?.environmentId;

  if (!envId) return res.status(400).json({ message: 'חסר environmentId' });

  try {
    const perm = await EnvPerm.findOne({ userId: req.user._id, environmentId: envId });
    if (!perm) return res.status(403).json({ message: 'אין לך הרשאה לסביבה זו' });

    // viewer מספיק לקריאה; manager נדרש לניהול
    if (requiredType === 'manager' && perm.type !== 'manager') {
      return res.status(403).json({ message: 'נדרשת הרשאת מנהל סביבה' });
    }

    req.envPermission = perm; // זמין ל-routes
    next();
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

module.exports = { protect, adminOnly, requireEnvPermission };
