const router = require('express').Router();
const User = require('../models/User');
const EnvPerm = require('../models/EnvironmentPermission');
const { protect, adminOnly } = require('../middleware/auth');
const unitree = require('../lib/unitreeClient');
const { safeProfileImageUrl } = require('../lib/safeProfileImage');

const PROFILE_FIELDS = [
  'name',
  'tagId',
  'username',
  'jobTitle',
  'rank',
  'militaryRole',
  'email',
  'phone',
  'profileImageUrl',
  'sourceSystem',
  'registeredVia',
  'sourceSystems',
  'managerTagId',
  'unitreeOrgPathText',
  'unitreeOrgPathIds',
  'knownNames',
  'rawOrgPaths',
  'level1',
  'level2',
  'level3',
  'level4',
  'level5',
  'isActive',
  'meta',
];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function pickProfileFields(input = {}) {
  const output = {};
  for (const field of PROFILE_FIELDS) {
    if (input[field] === undefined) continue;
    if (Array.isArray(input[field])) {
      output[field] = input[field].map(item => cleanText(item)).filter(Boolean);
    } else if (field === 'profileImageUrl') {
      output[field] = safeProfileImageUrl(input[field]);
    } else {
      output[field] = cleanText(input[field]);
    }
  }
  return output;
}

function mergeUserPayload(localInput = {}, unitreePayload = {}) {
  const merged = { ...unitreePayload, ...localInput };
  for (const field of ['name', 'tagId']) {
    if (!merged[field] && unitreePayload[field]) merged[field] = unitreePayload[field];
  }
  merged.username = merged.username || merged.email || merged.tagId;

  const sources = new Set([
    ...(Array.isArray(unitreePayload.sourceSystems) ? unitreePayload.sourceSystems : []),
    ...(Array.isArray(localInput.sourceSystems) ? localInput.sourceSystems : []),
    unitreePayload.sourceSystem,
    localInput.sourceSystem,
    unitreePayload.registeredVia,
    localInput.registeredVia,
  ].filter(Boolean).map(String));
  merged.sourceSystems = [...sources];

  return pickProfileFields(merged);
}

function decorateUser(user, envPermType = null) {
  const plain = user?.toObject ? user.toObject() : user;
  if (!plain) return plain;
  return {
    ...plain,
    profileImageUrl: safeProfileImageUrl(plain.profileImageUrl),
    envPermType,
    permissions: plain.role === 'admin' ? 'admin' : (envPermType || 'viewer'),
  };
}

async function fetchUnitreePayload(tagId) {
  if (!tagId || !unitree.configured()) return null;
  const result = await unitree.lookupOrIngestPersonalNumber(tagId);
  if (!result?.user) return null;
  return {
    source: result.source,
    directory: result.directory,
    payload: unitree.userPayloadFromUnitree(result.user, tagId),
  };
}

async function assertCanCreateOrGrant(req, environmentId, permissions) {
  if (req.user.role === 'admin') return;

  if (!environmentId) {
    const err = new Error('נדרשת הרשאת מנהל על ליצירת משתמש ללא סביבה');
    err.status = 403;
    throw err;
  }

  const myPerm = await EnvPerm.findOne({ userId: req.user._id, environmentId, type: 'manager' });
  if (!myPerm) {
    const err = new Error('נדרשת הרשאת מנהל סביבה');
    err.status = 403;
    throw err;
  }
  if (permissions === 'admin' || permissions === 'manager') {
    const err = new Error('רק מנהל על יכול להעניק הרשאת מנהל');
    err.status = 403;
    throw err;
  }
}

async function upsertEnvironmentPermission({ userId, environmentId, permissions, grantedBy }) {
  if (!environmentId || permissions === 'admin') return null;
  const type = permissions === 'manager' ? 'manager' : 'viewer';
  return EnvPerm.findOneAndUpdate(
    { userId, environmentId },
    { type, grantedBy },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

// GET /api/users?environmentId=xxx
// מחזיר משתמשים שיש להם הרשאה לסביבה (manager + viewer)
// מנהל על: יכול לראות כל המשתמשים (ללא environmentId) או לפי סביבה
// מנהל סביבה: רק משתמשי הסביבה שלו
// GET /api/users/lookup?tagId=xxx — חיפוש לפי מספר אישי
router.get('/lookup', protect, async (req, res) => {
  try {
    const { tagId } = req.query;
    if (!tagId) return res.status(400).json({ message: 'חסר מספר אישי' });
    const cleanTagId = String(tagId).trim();
    const user = await User.findOne({ tagId: cleanTagId });
    if (user) return res.json({ found: true, source: 'mission360', inSystem: true, user: decorateUser(user) });

    const unitreeResult = await fetchUnitreePayload(cleanTagId).catch(err => ({ error: err }));
    if (unitreeResult?.payload) {
      return res.json({
        found: true,
        source: unitreeResult.source,
        fromUnitree: true,
        inSystem: false,
        user: unitreeResult.payload,
      });
    }

    if (unitreeResult?.error && unitreeResult.error.code !== 'UNITREE_NOT_CONFIGURED') {
      return res.json({
        found: false,
        unitreeError: unitreeResult.error.message,
      });
    }

    res.json({ found: false });
  } catch (err) {
    res.status(500).json({ message: err.message || 'שגיאת שרת' });
  }
});

router.get('/unitree/status', protect, async (_req, res) => {
  try {
    res.json(await unitree.status());
  } catch (err) {
    res.status(err.status || 500).json({
      configured: unitree.configured(),
      message: err.message || 'שגיאת חיבור ליוניטרי',
    });
  }
});

router.post('/sync-unitree/:tagId', protect, adminOnly, async (req, res) => {
  try {
    const cleanTagId = String(req.params.tagId || '').trim();
    if (!cleanTagId) return res.status(400).json({ message: 'חסר מספר אישי' });

    const unitreeResult = await fetchUnitreePayload(cleanTagId);
    if (!unitreeResult?.payload) return res.status(404).json({ message: 'משתמש לא נמצא ביוניטרי' });

    const user = await User.findOneAndUpdate(
      { tagId: cleanTagId },
      { $set: mergeUserPayload(req.body || {}, unitreeResult.payload) },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    res.json({
      found: true,
      source: unitreeResult.source,
      user: decorateUser(user),
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'שגיאת סנכרון יוניטרי' });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const { environmentId } = req.query;

    if (!environmentId) {
      // רק מנהל על יכול לראות כל המשתמשים
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'נדרשת הרשאת מנהל על' });
      const users = await User.find().select('-password').sort({ name: 1 });
      return res.json(users.map(user => decorateUser(user, user.role === 'admin' ? 'admin' : null)));
    }

    // בדוק שיש הרשאה לסביבה
    if (req.user.role !== 'admin') {
      const myPerm = await EnvPerm.findOne({ userId: req.user._id, environmentId });
      if (!myPerm) return res.status(403).json({ message: 'אין לך הרשאה לסביבה זו' });
    }

    // מצא את כל המשתמשים עם הרשאה לסביבה
    const perms = await EnvPerm.find({ environmentId })
      .populate('userId', '-password')
      .sort({ type: 1, createdAt: 1 });

    const users = perms
      .filter(p => p.userId)
      .map(p => decorateUser(p.userId, p.type));
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message || 'שגיאת שרת' });
  }
});

// POST /api/users — יצירת משתמש (מנהל על או מנהל סביבה)
router.post('/', protect, async (req, res) => {
  try {
    const environmentId = req.body.environmentId || null;
    const permissions = req.body.permissions || (req.body.role === 'admin' ? 'admin' : 'viewer');
    await assertCanCreateOrGrant(req, environmentId, permissions);

    const localInput = pickProfileFields(req.body);
    const tagId = String(localInput.tagId || '').trim();
    if (!tagId) return res.status(400).json({ message: 'מספר אישי הוא שדה חובה' });

    const unitreeResult = await fetchUnitreePayload(tagId).catch(err => {
      if (err.code === 'UNITREE_NOT_CONFIGURED' || err.status === 404) return null;
      throw err;
    });
    const payload = mergeUserPayload(localInput, unitreeResult?.payload || {});
    if (!payload.name) return res.status(400).json({ message: 'שם ומספר אישי הם שדות חובה' });

    const role = permissions === 'admin' ? 'admin' : 'commander';
    let user = await User.findOne({ tagId });
    const statusCode = user ? 200 : 201;

    if (user) {
      user.set({ ...payload, role: user.role === 'admin' ? 'admin' : role });
      await user.save();
    } else {
      user = await User.create({
        ...payload,
        username: payload.username || tagId,
        role,
      });
    }

    const perm = await upsertEnvironmentPermission({
      userId: user._id,
      environmentId,
      permissions,
      grantedBy: req.user._id,
    });

    res.status(statusCode).json({
      ...decorateUser(user, perm?.type || null),
      fromUnitree: Boolean(unitreeResult?.payload),
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'שגיאת שרת' });
  }
});

// PUT /api/users/:id — עדכון משתמש (מנהל על בלבד)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const updates = pickProfileFields(req.body);
    if (req.body.role !== undefined) {
      updates.role = req.body.role === 'admin' ? 'admin' : 'commander';
    }
    if (req.body.permissions === 'admin') updates.role = 'admin';
    const user = await User.findByIdAndUpdate(req.params.id, { $set: updates }, { returnDocument: 'after' }).select('-password');
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });
    res.json(decorateUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message || 'שגיאת שרת' });
  }
});

// DELETE /api/users/:id — מחיקת משתמש (מנהל על בלבד)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'משתמש לא נמצא' });
    // מחק את כל הרשאות הסביבה שלו
    await EnvPerm.deleteMany({ userId: req.params.id });
    res.json({ message: 'משתמש נמחק' });
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
});

module.exports = router;
