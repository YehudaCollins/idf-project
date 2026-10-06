const router = require('express').Router({ mergeParams: true });
const TaskMessage = require('../models/TaskMessage');
const Task        = require('../models/Task');
const EnvPerm     = require('../models/EnvironmentPermission');
const { protect } = require('../middleware/auth');

/** בדיקת גישה להנחיה: מנהל/מנהל-על, או האחראי עצמו */
async function canAccessTask(user, task) {
  if (!task) return false;
  if (user.role === 'admin') return true;
  const assignedId = task.assignedTo?._id ? task.assignedTo._id.toString() : String(task.assignedTo || '');
  if (assignedId && assignedId === user._id.toString()) return true;
  const perm = await EnvPerm.findOne({ userId: user._id, environmentId: task.environmentId });
  return !!perm;
}

/* GET /api/tasks/:taskId/messages?since=<ISO> */
router.get('/', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task || !(await canAccessTask(req.user, task)))
      return res.status(403).json({ message: 'אין הרשאה' });

    const filter = { taskId: task._id };
    if (req.query.since) {
      const d = new Date(req.query.since);
      if (!isNaN(d)) filter.createdAt = { $gt: d };
    }

    const messages = await TaskMessage.find(filter).sort({ createdAt: 1 }).limit(200).lean();

    const unreadCount = await TaskMessage.countDocuments({
      taskId: task._id,
      sender: { $ne: req.user._id },
      readBy: { $nin: [req.user._id] },
    });

    res.json({ messages, unreadCount });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/* GET /api/tasks/:taskId/messages/unread-count */
router.get('/unread-count', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId).select('environmentId assignedTo');
    if (!task || !(await canAccessTask(req.user, task)))
      return res.json({ unreadCount: 0 });

    const unreadCount = await TaskMessage.countDocuments({
      taskId: task._id,
      sender: { $ne: req.user._id },
      readBy: { $nin: [req.user._id] },
    });

    res.json({ unreadCount });
  } catch {
    res.status(500).json({ unreadCount: 0 });
  }
});

/* POST /api/tasks/:taskId/messages */
router.post('/', protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'טקסט ריק' });

    const task = await Task.findById(req.params.taskId);
    if (!task || !(await canAccessTask(req.user, task)))
      return res.status(403).json({ message: 'אין הרשאה' });

    const msg = await TaskMessage.create({
      taskId: task._id,
      sender: req.user._id,
      senderName: req.user.name,
      text: text.trim(),
      readBy: [],
    });

    res.status(201).json(msg);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/* PATCH /api/tasks/:taskId/messages/mark-read */
router.patch('/mark-read', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId).select('environmentId assignedTo');
    if (!task || !(await canAccessTask(req.user, task)))
      return res.status(403).json({ message: 'אין הרשאה' });

    await TaskMessage.updateMany(
      {
        taskId: task._id,
        sender: { $ne: req.user._id },
        readBy: { $nin: [req.user._id] },
      },
      { $addToSet: { readBy: req.user._id } },
    );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
