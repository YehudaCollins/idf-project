/**
 * template.js — ניהול תבנית הסביבה (טבלה + רמות אחריות)
 * מנהל סביבה + מנהל על יכולים לשנות
 */
const router = require('express').Router({ mergeParams: true });
const Environment = require('../models/Environment');
const EnvPerm     = require('../models/EnvironmentPermission');
const { protect } = require('../middleware/auth');
const crypto      = require('crypto');

// GET /api/environments/:id/template
router.get('/', protect, async (req, res) => {
  try {
    const env = await Environment.findById(req.params.id);
    if (!env) return res.status(404).json({ message: 'סביבה לא נמצאה' });
    res.json(env.template || { responsibilityLevels: 4, customColumns: [] });
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
});

// PUT /api/environments/:id/template
router.put('/', protect, async (req, res) => {
  try {
    const { responsibilityLevels, customColumns, defaultDueDays, overdueThresholdDays, autoReminderDays } = req.body;

    // בדוק הרשאה
    if (req.user.role !== 'admin') {
      const perm = await EnvPerm.findOne({ userId: req.user._id, environmentId: req.params.id, type: 'manager' });
      if (!perm) return res.status(403).json({ message: 'נדרשת הרשאת מנהל' });
    }

    const env = await Environment.findByIdAndUpdate(
      req.params.id,
      { $set: {
        'template.responsibilityLevels': Math.min(5, Math.max(1, responsibilityLevels || 4)),
        ...(defaultDueDays != null       ? { 'template.defaultDueDays':       Math.max(1, Number(defaultDueDays)) }       : {}),
        ...(overdueThresholdDays != null ? { 'template.overdueThresholdDays': Math.max(0, Number(overdueThresholdDays)) } : {}),
        ...(autoReminderDays != null     ? { 'template.autoReminderDays':     Math.max(0, Number(autoReminderDays)) }     : {}),
        'template.customColumns': (customColumns || []).map(col => ({
          id:    col.id || crypto.randomUUID(),
          label: col.label,
        })),
      }},
      { new: true }
    );
    if (!env) return res.status(404).json({ message: 'סביבה לא נמצאה' });
    res.json(env.template);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
});

module.exports = router;
