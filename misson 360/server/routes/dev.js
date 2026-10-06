/**
 * dev.js — routes זמינים רק כש DEV_MODE=true
 * כדי להשבית: שנה DEV_MODE=false ב-.env והפעל מחדש את השרת
 */
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const EnvPerm = require('../models/EnvironmentPermission');

const isDevMode = () => process.env.DEV_MODE === 'true';

// GET /api/dev/mode
router.get('/mode', (req, res) => {
  res.json({ devMode: isDevMode() });
});

// GET /api/dev/auto-login — כניסה אוטומטית כמנהל ראשי (DEV בלבד, ללא טוקן)
router.get('/auto-login', async (req, res) => {
  if (!isDevMode()) return res.status(403).json({ message: 'DEV_MODE=false' });
  try {
    const User = require('../models/User');
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) return res.status(404).json({ message: 'לא נמצא מנהל — הרץ npm run seed' });
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: admin.toObject() });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// GET /api/dev/users?environmentId=xxx
// מחזיר את כל המשתמשים + ההרשאה שלהם לסביבה (אם נשלחה)
router.get('/users', async (req, res) => {
  if (!isDevMode()) return res.status(403).json({ message: 'DEV_MODE=false' });
  try {
    const { environmentId } = req.query;

    let users = await User.find().select('-password').sort({ role: -1, name: 1 });

    if (environmentId) {
      // צרף לכל משתמש את סוג ההרשאה בסביבה (אם יש)
      const perms = await EnvPerm.find({ environmentId });
      const permMap = {};
      perms.forEach(p => { permMap[p.userId.toString()] = p.type; });

      users = users.map(u => ({
        ...u.toObject(),
        envPermType: permMap[u._id.toString()] || null,
      }));
    } else {
      users = users.map(u => u.toObject());
    }

    res.json(users);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// POST /api/dev/login/:userId — התחבר כמשתמש ללא סיסמה
router.post('/login/:userId', async (req, res) => {
  if (!isDevMode()) return res.status(403).json({ message: 'DEV_MODE=false' });
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/**
 * GET /api/dev/sp-current-user
 * מדמה קריאה ל-SharePoint currentUser ב-DEV.
 * בייצור: האפליקציה קוראת ישירות ל-/_api/web/currentUser
 *
 * ב-DEV: מחזיר את המשתמש הראשון שמצאנו לפי email/tagId מה-session,
 * או "לא נמצא" אם אין session.
 */
router.get('/sp-current-user', async (req, res) => {
  if (!isDevMode()) return res.status(403).json({ message: 'DEV_MODE=false' });
  try {
    // ב-DEV: נסה למצוא משתמש לפי טוקן קיים
    const auth = req.headers.authorization;
    if (!auth) {
      return res.json({ found: false, name: 'לא מחובר ל-SharePoint', tagId: null });
    }
    const jwt    = require('jsonwebtoken');
    const User   = require('../models/User');
    const token  = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id);
    if (!user) return res.json({ found: false, name: 'לא נמצא', tagId: null });
    return res.json({ found: true, _id: user._id, name: user.name, tagId: user.tagId });
  } catch {
    return res.json({ found: false, name: 'שגיאה בקריאת משתמש SP', tagId: null });
  }
});

/**
 * GET /api/dev/sp-mock?tagId=xxx
 * מדמה תגובת SharePoint כשאין גישה אמיתית (DEV בלבד)
 * חוגר 1119 — תמיד מחזיר משתמש דמה
 */
router.get('/sp-mock', async (req, res) => {
  if (!isDevMode()) return res.status(403).json({ message: 'DEV_MODE=false' });
  const { tagId } = req.query;
  if (!tagId) return res.json({ found: false });

  // בדוק קודם אם קיים במסד
  const existing = await User.findOne({ tagId });
  if (existing) return res.json({ found: true, fromDB: true, user: existing.toObject() });

  // ── מאגר משתמשי דמה ──
  const DEV_USERS = {
    '1119': { name: 'אבי כהן',      jobTitle: 'תוכניתן',       level1: 'חטיבת ההפעלה', level2: 'מטה פיקוד', level3: 'מקשא"פ', level4: 'צוות אלפא' },
    '2233': { name: 'דנה לוי',      jobTitle: 'קשרח',          level1: 'חטיבת ההפעלה', level2: 'יהלם',      level3: 'מטה',    level4: '---'        },
    '3344': { name: 'יוסי ברקוביץ', jobTitle: 'מפקד צוות',    level1: 'חטיבת ההפעלה', level2: 'גולס',      level3: 'מקשא"פ', level4: '---'        },
    '4455': { name: 'מיכל שמעון',   jobTitle: 'רמ"ד אג"מ',     level1: 'חטיבת ההפעלה', level2: '460',       level3: 'מטה',    level4: 'סגל'        },
  };

  const mock = DEV_USERS[tagId];
  if (mock) return res.json({ found: true, fromDB: false, user: { ...mock, tagId } });

  // לא נמצא
  res.json({ found: false });
});

/**
 * POST /api/dev/fill-users
 * מעדכן משתמשים קיימים שחסרים להם שדות + מאכלס level5 לכולם
 */
router.post('/fill-users', async (req, res) => {
  if (!isDevMode()) return res.status(403).json({ message: 'DEV_MODE=false' });
  try {
    const users = await User.find({});
    let updated = 0;

    /* מיפוי level5 לפי level3 + level4 */
    function guessLevel5(u) {
      if (u.level5 && u.level5 !== '---' && u.level5.trim()) return null; // כבר יש
      const l3 = u.level3 || '';
      const l4 = u.level4 || '';
      if (l4 && l4 !== '---') {
        const map = {
          'צוות אלפא': 'יחידה א',
          'סגל':       'מחלקת סגל',
        };
        return map[l4] || `${l4} - קבוצה א`;
      }
      const l3map = {
        'מקשא"פ': 'צוות מבצעי',
        'מטה':    'מחלקת מטה',
        'כללי':   'קבוצה כללית',
      };
      return l3map[l3] || 'קבוצה א';
    }

    for (const u of users) {
      const updates = {};
      if (!u.level1)   updates.level1   = 'חטיבת ההפעלה';
      if (!u.level2)   updates.level2   = 'כללי';
      if (!u.level3)   updates.level3   = 'כללי';
      if (!u.level4)   updates.level4   = '---';
      if (!u.jobTitle) updates.jobTitle = 'לא הוגדר';
      const newL5 = guessLevel5(u);
      if (newL5) updates.level5 = newL5;
      if (Object.keys(updates).length) {
        await User.findByIdAndUpdate(u._id, { $set: updates });
        updated++;
      }
    }
    res.json({ message: `עודכנו ${updated} משתמשים`, updated });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
