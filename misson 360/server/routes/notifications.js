const router = require('express').Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

/** GET /api/notifications */
router.get('/', protect, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 40, 80);
    const [items, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId: req.user._id, read: false }),
    ]);
    res.json({ items, unreadCount });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/** PATCH /api/notifications/read-all — חייב לפני /:id */
router.patch('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    res.json({ unreadCount: 0 });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/** PATCH /api/notifications/:id/read */
router.patch('/:id/read', protect, async (req, res) => {
  try {
    const doc = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { read: true, readAt: new Date() } },
      { new: true },
    ).lean();
    if (!doc) return res.status(404).json({ message: 'לא נמצא' });
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ notification: doc, unreadCount });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
