const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const { protect } = require('../middleware/auth');
const unitree = require('../lib/unitreeClient');
const { safeProfileImageUrl } = require('../lib/safeProfileImage');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '12h' });

function authUser(user) {
  return {
    _id:      user._id,
    tagId:    user.tagId,
    name:     user.name,
    username: user.username,
    role:     user.role,
    jobTitle: user.jobTitle,
    rank: user.rank,
    militaryRole: user.militaryRole,
    email: user.email,
    phone: user.phone,
    profileImageUrl: safeProfileImageUrl(user.profileImageUrl),
    sourceSystem: user.sourceSystem,
    registeredVia: user.registeredVia,
    level1: user.level1,
    level2: user.level2,
    level3: user.level3,
    level4: user.level4,
    level5: user.level5,
  };
}

async function refreshUnitreeProfile(user) {
  if (!unitree.configured() || !user?.tagId) return;
  const result = await unitree.lookupOrIngestPersonalNumber(user.tagId);
  if (!result?.user) return;
  const payload = unitree.userPayloadFromUnitree(result.user, user.tagId);
  user.set({
    ...payload,
    role: user.role,
    isActive: user.isActive,
  });
  await user.save();
}

function looksLikeProfile(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function personalNumberFromText(value) {
  const text = String(value || '');
  const matches = [...text.matchAll(/(?:^|[^a-zA-Z0-9])([a-zA-Z]\d{6,10}|[a-zA-Z]{2,10}-\d{3,10}|\d{6,10})(?=$|[^a-zA-Z0-9])/g)];
  return matches.at(-1)?.[1] || '';
}

function personalNumberFromProfile(profile = {}) {
  return String(profile.personalNumber || profile.PersonalNumber || '').trim()
    || personalNumberFromText([
      profile.UserName,
      profile.AccountName,
      profile['SPS-UserPrincipalName'],
      profile['SPS-ClaimID'],
      profile['SPS-ResourceAccountName'],
      profile['SPS-MasterAccountName'],
      profile.WorkEmail,
      profile['SPS-SipAddress'],
    ].filter(Boolean).join(' '));
}

async function loginFromUnitreeResult(res, result, fallbackTagId = '') {
  if (!result?.user) {
    return res.status(404).json({ message: 'לא נמצא פרופיל משתמש ביוניטרי' });
  }

  const payload = unitree.userPayloadFromUnitree(result.user, fallbackTagId);
  if (!payload.tagId) {
    return res.status(422).json({ message: 'יוניטרי לא החזיר מספר אישי תקין' });
  }

  let user = await User.findOne({ tagId: payload.tagId, isActive: true });
  if (!user) {
    if (process.env.UNITREE_AUTO_CREATE_USERS === 'true') {
      user = await User.create({
        ...payload,
        username: payload.username || payload.tagId,
        role: 'commander',
        isActive: true,
      });
    } else {
      return res.status(401).json({
        message: 'נמצא ביוניטרי אבל לא רשום ב-Mission 360',
        unitreeFound: true,
        user: payload,
      });
    }
  } else {
    user.set({
      ...payload,
      role: user.role,
      isActive: user.isActive,
    });
    await user.save();
  }

  return res.json({
    token: signToken(user._id),
    user: authUser(user),
  });
}

/**
 * POST /api/auth/tag
 * גוף: { tagId: "..." }
 *
 * אימות לפי חוגר — אין סיסמה.
 * אם המשתמש רשום במערכת → מחזיר JWT.
 * אם לא → 401.
 */
router.post('/tag', async (req, res) => {
  try {
    const { tagId } = req.body;
    if (!tagId) return res.status(400).json({ message: 'חסר מזהה חוגר' });

    const cleanTagId = String(tagId).trim();
    let user = await User.findOne({ tagId: cleanTagId, isActive: true });
    if (!user && unitree.configured()) {
      const result = await unitree.lookupOrIngestPersonalNumber(cleanTagId).catch(err => {
        if (err.status === 404 || err.code === 'UNITREE_NOT_CONFIGURED') return null;
        throw err;
      });
      if (result?.user) {
        if (process.env.UNITREE_AUTO_CREATE_USERS === 'true') {
          const payload = unitree.userPayloadFromUnitree(result.user, cleanTagId);
          user = await User.create({
            ...payload,
            username: payload.username || cleanTagId,
            role: 'commander',
            isActive: true,
          });
        } else {
          return res.status(401).json({
            message: 'נמצא ביוניטרי אבל לא רשום ב-Mission 360',
            unitreeFound: true,
            user: unitree.userPayloadFromUnitree(result.user, cleanTagId),
          });
        }
      }
    }

    if (!user) return res.status(401).json({ message: 'לא רשום במערכת' });

    Promise.resolve()
      .then(() => refreshUnitreeProfile(user))
      .catch(e => console.error('unitree refresh:', e.message));

    res.json({
      token: signToken(user._id),
      user: authUser(user),
    });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/**
 * POST /api/auth/microsoft-profile
 * גוף: { sharePointProfile: { ... } }
 *
 * הלקוח קורא את פרופיל Microsoft/SharePoint של המשתמש המחובר,
 * השרת שולח אותו ליוניטרי, ואז מחבר את המשתמש אם הוא קיים ב-Mission 360.
 */
router.post('/microsoft-profile', async (req, res) => {
  try {
    const profile = req.body?.sharePointProfile || req.body?.profile || req.body;
    if (!looksLikeProfile(profile)) return res.status(400).json({ message: 'חסר פרופיל Microsoft' });
    if (!unitree.configured()) return res.status(503).json({ message: 'Unitree API לא מוגדר' });

    const fallbackTagId = personalNumberFromProfile(profile);
    const result = await unitree.ingestSharePointProfile(profile).catch(async (err) => {
      if (fallbackTagId && [400, 422].includes(err.status)) {
        return unitree.lookupOrIngestPersonalNumber(fallbackTagId);
      }
      throw err;
    });
    return loginFromUnitreeResult(res, result, fallbackTagId);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'שגיאת חיבור לפרופיל Microsoft' });
  }
});

/**
 * GET /api/auth/me
 * מחזיר את פרטי המשתמש לפי הטוקן
 */
router.get('/me', protect, (req, res) => {
  res.json(req.user);
});

/**
 * POST /api/auth/login  ← נשמר לצרכי DEV בלבד (מצב DEV_MODE)
 * גוף: { tagId: "..." }  — ללא סיסמה
 */
router.post('/login', async (req, res) => {
  if (process.env.DEV_MODE !== 'true') {
    return res.status(403).json({ message: 'לא זמין בסביבת ייצור' });
  }
  return router.handle({ ...req, url: '/tag', method: 'POST' }, res, () => {});
});

module.exports = router;
