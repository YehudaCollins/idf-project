/**
 * permissions.js — ניהול הרשאות סביבה
 *
 * מנהל על: יכול להעניק/לשלול הרשאת 'manager' לכל משתמש
 * מנהל סביבה: יכול להוסיף/להסיר 'viewer' (מפקדים) לסביבה שלו
 */
const router = require('express').Router({ mergeParams: true });
const EnvPerm = require('../models/EnvironmentPermission');
const User = require('../models/User');
const Environment = require('../models/Environment');
const { protect, adminOnly, requireEnvPermission } = require('../middleware/auth');
const notify = require('../lib/notify');

const USER_SELECT = 'name username jobTitle role tagId rank militaryRole email phone profileImageUrl sourceSystem registeredVia sourceSystems level1 level2 level3 level4 level5';

// GET /api/environments/:environmentId/permissions
// החזר את כל בעלי ההרשאה לסביבה + פרטי משתמש
router.get('/', protect, requireEnvPermission('viewer'), async (req, res) => {
  try {
    const perms = await EnvPerm.find({ environmentId: req.params.environmentId })
      .populate('userId', USER_SELECT)
      .populate('grantedBy', 'name')
      .sort({ type: 1, createdAt: 1 });
    res.json(perms);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// POST /api/environments/:environmentId/permissions
// הענקת הרשאה — מנהל על יכול להעניק 'manager', מנהל סביבה יכול להעניק 'viewer'
router.post('/', protect, async (req, res) => {
  try {
    const { userId, type } = req.body;
    const { environmentId } = req.params;

    if (!userId || !type) return res.status(400).json({ message: 'חסרים שדות' });
    if (!['manager', 'viewer'].includes(type)) return res.status(400).json({ message: 'סוג הרשאה לא חוקי' });

    // מנהל על יכול להעניק כל סוג הרשאה
    // מנהל סביבה יכול להעניק רק 'viewer'
    const isSuperAdmin = req.user.role === 'admin';
    if (!isSuperAdmin) {
      if (type === 'manager') return res.status(403).json({ message: 'רק מנהל על יכול להעניק הרשאת מנהל' });
      // בדוק שהמשתמש הוא מנהל הסביבה
      const myPerm = await EnvPerm.findOne({ userId: req.user._id, environmentId, type: 'manager' });
      if (!myPerm) return res.status(403).json({ message: 'אין לך הרשאת מנהל לסביבה זו' });
    }

    // ודא שהמשתמש המוזמן קיים
    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ message: 'משתמש לא נמצא' });

    // ודא שהסביבה קיימת
    const env = await Environment.findById(environmentId);
    if (!env) return res.status(404).json({ message: 'סביבה לא נמצאה' });

    // upsert — אם כבר יש הרשאה, עדכן את הסוג
    const perm = await EnvPerm.findOneAndUpdate(
      { userId, environmentId },
      { type, grantedBy: req.user._id },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    const populated = await perm.populate([
      { path: 'userId', select: USER_SELECT },
      { path: 'grantedBy', select: 'name' },
    ]);

    Promise.resolve()
      .then(() => notify.notifyPermissionGranted(targetUser._id, environmentId, env.name, type))
      .catch(e => console.error('notify permission:', e.message));

    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'למשתמש כבר יש הרשאה לסביבה זו' });
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// DELETE /api/environments/:environmentId/permissions/:userId
// שלילת הרשאה — אותן הגבלות כמו POST
router.delete('/:userId', protect, async (req, res) => {
  try {
    const { environmentId, userId } = req.params;
    const isSuperAdmin = req.user.role === 'admin';

    if (!isSuperAdmin) {
      const myPerm = await EnvPerm.findOne({ userId: req.user._id, environmentId, type: 'manager' });
      if (!myPerm) return res.status(403).json({ message: 'אין לך הרשאת מנהל לסביבה זו' });
      // מנהל סביבה לא יכול להסיר מנהל אחר
      const targetPerm = await EnvPerm.findOne({ userId, environmentId });
      if (targetPerm?.type === 'manager') return res.status(403).json({ message: 'רק מנהל על יכול להסיר מנהל סביבה' });
    }

    await EnvPerm.findOneAndDelete({ userId, environmentId });
    res.json({ message: 'הרשאה הוסרה' });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// GET /api/environments/:environmentId/permissions/users-without
// כל המשתמשים שאין להם עדיין הרשאה לסביבה — לשימוש ב-dropdown הוספה
router.get('/users-without', protect, requireEnvPermission('manager'), async (req, res) => {
  try {
    const { environmentId } = req.params;
    const existing = await EnvPerm.find({ environmentId }).select('userId');
    const existingIds = existing.map(p => p.userId.toString());
    const users = await User.find({ _id: { $nin: existingIds } }).select(USER_SELECT).sort({ name: 1 });
    res.json(users);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
