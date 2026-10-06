const router = require('express').Router();
const EnvironmentRequest = require('../models/EnvironmentRequest');
const Environment = require('../models/Environment');
const EnvPerm = require('../models/EnvironmentPermission');
const { protect } = require('../middleware/auth');
const notify = require('../lib/notify');

const requestPopulate = [
  { path: 'userId', select: 'name username jobTitle role tagId' },
  { path: 'environmentId', select: 'name description visibility' },
  { path: 'decidedBy', select: 'name' },
];

async function canManageEnv(user, environmentId) {
  if (user.role === 'admin') return true;
  const p = await EnvPerm.findOne({ userId: user._id, environmentId, type: 'manager' });
  return !!p;
}

/**
 * POST /api/environment-requests
 * Body: { environmentId, requestType: 'manager'|'viewer', note? }
 * יוצר בקשה חדשה. נכשל אם:
 *   • הסביבה לא קיימת או לא פעילה
 *   • הסביבה private (לא ניתן לבקש; רק בהזמנה)
 *   • למשתמש כבר יש את ההרשאה המבוקשת או גבוהה יותר
 *   • כבר קיימת בקשה ממתינה זהה
 */
router.post('/', protect, async (req, res) => {
  try {
    const { environmentId, requestType, note } = req.body;
    if (!environmentId || !requestType) {
      return res.status(400).json({ message: 'חסרים שדות' });
    }
    if (!['manager', 'viewer'].includes(requestType)) {
      return res.status(400).json({ message: 'סוג בקשה לא חוקי' });
    }

    const env = await Environment.findById(environmentId);
    if (!env || !env.isActive) return res.status(404).json({ message: 'סביבה לא נמצאה' });
    if (env.visibility !== 'public') {
      return res.status(403).json({ message: 'הסביבה אינה פתוחה לבקשות גישה' });
    }

    // בדיקה אם יש כבר הרשאה זהה / גבוהה יותר
    const existingPerm = await EnvPerm.findOne({ userId: req.user._id, environmentId });
    if (existingPerm) {
      if (existingPerm.type === 'manager') {
        return res.status(400).json({ message: 'כבר יש לך גישת מנהל לסביבה' });
      }
      if (existingPerm.type === 'viewer' && requestType === 'viewer') {
        return res.status(400).json({ message: 'כבר יש לך גישה לסביבה' });
      }
    }

    const created = await EnvironmentRequest.create({
      userId: req.user._id,
      environmentId,
      requestType,
      note: (note || '').slice(0, 600),
      status: 'pending',
    });
    const populated = await created.populate(requestPopulate);

    Promise.resolve()
      .then(() => notify.notifyAccessRequestCreated({
        environmentId: env._id,
        envName: env.name,
        requesterName: req.user.name,
        requestType,
        note,
      }))
      .catch(e => console.error('notify request:', e.message));

    res.status(201).json(populated);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'יש לך כבר בקשה ממתינה לסביבה זו' });
    }
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/**
 * GET /api/environment-requests/mine
 * החזר את כל הבקשות של המשתמש (לכל הסטטוסים), חדשות-קודם.
 */
router.get('/mine', protect, async (req, res) => {
  try {
    const items = await EnvironmentRequest.find({ userId: req.user._id })
      .populate(requestPopulate)
      .sort({ createdAt: -1 });
    res.json(items);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/**
 * GET /api/environment-requests/inbox
 * תיבת נכנסות של מנהל — כל הבקשות הממתינות בסביבות שבהן הוא מנהל.
 */
router.get('/inbox', protect, async (req, res) => {
  try {
    let envIds;
    if (req.user.role === 'admin') {
      const envs = await Environment.find().select('_id');
      envIds = envs.map(e => e._id);
    } else {
      const perms = await EnvPerm.find({ userId: req.user._id, type: 'manager' }).select('environmentId');
      envIds = perms.map(p => p.environmentId);
    }
    if (!envIds.length) return res.json([]);

    const items = await EnvironmentRequest.find({
      environmentId: { $in: envIds },
      status: 'pending',
    })
      .populate(requestPopulate)
      .sort({ createdAt: -1 });
    res.json(items);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/**
 * GET /api/environment-requests?environmentId=X&status=...
 * בקשות עבור סביבה ספציפית — מותר רק למנהל הסביבה.
 */
router.get('/', protect, async (req, res) => {
  try {
    const { environmentId, status } = req.query;
    if (!environmentId) return res.status(400).json({ message: 'חסר environmentId' });
    if (!(await canManageEnv(req.user, environmentId))) {
      return res.status(403).json({ message: 'נדרשת הרשאת מנהל' });
    }
    const filter = { environmentId };
    if (status) filter.status = status;
    const items = await EnvironmentRequest.find(filter)
      .populate(requestPopulate)
      .sort({ createdAt: -1 });
    res.json(items);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/**
 * POST /api/environment-requests/:id/approve
 * Body: { note? }
 * מנהל מאשר את הבקשה — נוצרת/מתעדכנת EnvPerm לפי requestType, נשלחת התראה.
 */
router.post('/:id/approve', protect, async (req, res) => {
  try {
    const reqDoc = await EnvironmentRequest.findById(req.params.id);
    if (!reqDoc) return res.status(404).json({ message: 'בקשה לא נמצאה' });
    if (reqDoc.status !== 'pending') return res.status(400).json({ message: 'הבקשה כבר טופלה' });

    const env = await Environment.findById(reqDoc.environmentId);
    if (!env) return res.status(404).json({ message: 'סביבה לא נמצאה' });

    if (!(await canManageEnv(req.user, env._id))) {
      return res.status(403).json({ message: 'נדרשת הרשאת מנהל' });
    }
    // מנהל סביבה רגיל לא יכול לאשר בקשת 'manager' (רק admin)
    if (reqDoc.requestType === 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'רק מנהל על יכול לאשר בקשת מנהל סביבה' });
    }

    // יצירת/עדכון EnvPerm
    await EnvPerm.findOneAndUpdate(
      { userId: reqDoc.userId, environmentId: env._id },
      { type: reqDoc.requestType, grantedBy: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    reqDoc.status = 'approved';
    reqDoc.decidedBy = req.user._id;
    reqDoc.decidedAt = new Date();
    reqDoc.decisionNote = (req.body?.note || '').slice(0, 600);
    await reqDoc.save();
    await reqDoc.populate(requestPopulate);

    Promise.resolve()
      .then(() => notify.notifyAccessRequestApproved({
        userId: reqDoc.userId,
        environmentId: env._id,
        envName: env.name,
        requestType: reqDoc.requestType,
      }))
      .catch(e => console.error('notify request approved:', e.message));

    res.json(reqDoc);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/**
 * POST /api/environment-requests/:id/reject
 * Body: { note? } — סיבת דחייה
 */
router.post('/:id/reject', protect, async (req, res) => {
  try {
    const reqDoc = await EnvironmentRequest.findById(req.params.id);
    if (!reqDoc) return res.status(404).json({ message: 'בקשה לא נמצאה' });
    if (reqDoc.status !== 'pending') return res.status(400).json({ message: 'הבקשה כבר טופלה' });

    if (!(await canManageEnv(req.user, reqDoc.environmentId))) {
      return res.status(403).json({ message: 'נדרשת הרשאת מנהל' });
    }

    const note = (req.body?.note || '').slice(0, 600);
    reqDoc.status = 'rejected';
    reqDoc.decidedBy = req.user._id;
    reqDoc.decidedAt = new Date();
    reqDoc.decisionNote = note;
    await reqDoc.save();
    await reqDoc.populate(requestPopulate);

    const env = await Environment.findById(reqDoc.environmentId).select('name');
    Promise.resolve()
      .then(() => notify.notifyAccessRequestRejected({
        userId: reqDoc.userId,
        environmentId: reqDoc.environmentId,
        envName: env?.name,
        decisionNote: note,
      }))
      .catch(e => console.error('notify request rejected:', e.message));

    res.json(reqDoc);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/**
 * DELETE /api/environment-requests/:id
 * המבקש יכול לבטל את הבקשה שלו אם היא עוד ממתינה.
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const reqDoc = await EnvironmentRequest.findById(req.params.id);
    if (!reqDoc) return res.status(404).json({ message: 'בקשה לא נמצאה' });
    if (String(reqDoc.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'אין הרשאה לבטל בקשה זו' });
    }
    if (reqDoc.status !== 'pending') {
      return res.status(400).json({ message: 'ניתן לבטל רק בקשה ממתינה' });
    }
    await reqDoc.deleteOne();
    res.json({ message: 'הבקשה בוטלה' });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
