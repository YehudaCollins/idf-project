const router = require('express').Router();
const Environment = require('../models/Environment');
const EnvPerm = require('../models/EnvironmentPermission');
const EnvironmentRequest = require('../models/EnvironmentRequest');
const { protect, adminOnly, requireEnvPermission } = require('../middleware/auth');

// GET /api/environments
// מנהל על: כל הסביבות
// משתמש רגיל: רק סביבות שיש לו הרשאה
router.get('/', protect, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const envs = await Environment.find().sort({ createdAt: -1 });
      return res.json(envs);
    }
    // סנן לפי הרשאות
    const perms = await EnvPerm.find({ userId: req.user._id }).select('environmentId');
    const envIds = perms.map(p => p.environmentId);
    const envs = await Environment.find({ _id: { $in: envIds } }).sort({ createdAt: -1 });
    res.json(envs);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/**
 * GET /api/environments/search?q=...
 * חיפוש סביבות פתוחות לבקשת גישה — רק סביבות עם visibility='public'.
 * זמין לכל משתמש מחובר. מצורף לכל סביבה הסטטוס הנוכחי של המשתמש:
 *   - myPermission: 'manager' | 'viewer' | null
 *   - myRequestStatus: 'pending' | null  (האם יש לו בקשה ממתינה)
 */
router.get('/search', protect, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const filter = { isActive: true, visibility: 'public' };
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      filter.$or = [{ name: rx }, { description: rx }];
    }

    const envs = await Environment.find(filter)
      .select('name description visibility createdAt')
      .sort({ createdAt: -1 })
      .limit(40);

    const envIds = envs.map(e => e._id);
    const [perms, pendingReqs] = await Promise.all([
      EnvPerm.find({ userId: req.user._id, environmentId: { $in: envIds } }).select('environmentId type'),
      EnvironmentRequest.find({ userId: req.user._id, environmentId: { $in: envIds }, status: 'pending' }).select('environmentId'),
    ]);
    const permsByEnv = new Map(perms.map(p => [String(p.environmentId), p.type]));
    const pendingSet = new Set(pendingReqs.map(r => String(r.environmentId)));

    const enriched = envs.map(e => ({
      _id: e._id,
      name: e.name,
      description: e.description,
      visibility: e.visibility,
      createdAt: e.createdAt,
      myPermission: permsByEnv.get(String(e._id)) || null,
      myRequestStatus: pendingSet.has(String(e._id)) ? 'pending' : null,
    }));

    res.json(enriched);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// POST /api/environments — מנהל על בלבד
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'שם סביבה חובה' });
    const env = await Environment.create({ name, description, adminId: req.user._id });
    res.status(201).json(env);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// PUT /api/environments/:id — מנהל על או מנהל הסביבה
router.put('/:id', protect, requireEnvPermission('manager'), async (req, res) => {
  try {
    const env = await Environment.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!env) return res.status(404).json({ message: 'סביבה לא נמצאה' });
    res.json(env);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

// DELETE /api/environments/:id — מנהל על בלבד
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const env = await Environment.findByIdAndDelete(req.params.id);
    if (!env) return res.status(404).json({ message: 'סביבה לא נמצאה' });
    // מחק את כל ההרשאות לסביבה זו
    await EnvPerm.deleteMany({ environmentId: req.params.id });
    res.json({ message: 'סביבה נמחקה' });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
