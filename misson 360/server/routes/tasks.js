const router  = require('express').Router();
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const mongoose = require('mongoose');
const Task    = require('../models/Task');
const Project = require('../models/Project');
const TaskMessage = require('../models/TaskMessage');
const EnvPerm = require('../models/EnvironmentPermission');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');
const notify = require('../lib/notify');
const {
  isUserInsideTaskScope,
  doesUserCommandTask,
  scoreUserForTask,
} = require('../lib/commandHierarchy');

const UPLOAD_DIR = path.join(__dirname, '../uploads/attachments');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename:    (_, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20 MB

/**
 * autoAssign — מחפש את המשתמש הכי מתאים לרמות + תפקיד בסביבה
 * מחזיר userId או null אם אין התאמה
 */
async function autoAssign({ environmentId, level1, level2, level3, level4, level5, targetRole }) {
  // שלוף את כל החברים בסביבה (כולל מנהלים ומפקדים)
  const perms = await EnvPerm.find({ environmentId });
  if (!perms.length) return null;

  const userIds = perms.map(p => p.userId);
  const users   = await User.find({ _id: { $in: userIds }, isActive: true });
  const taskLike = { level1, level2, level3, level4, level5, targetRole };
  const scored = users
    .map(user => ({ user, score: scoreUserForTask(user, taskLike) }))
    .filter(row => row.score >= 0)
    .sort((a, b) => b.score - a.score || String(a.user.name || '').localeCompare(String(b.user.name || ''), 'he'));

  return scored[0]?.user?._id || null;
}

async function canManage(user, task) {
  if (user.role === 'admin') return true;
  const p = await EnvPerm.findOne({ userId: user._id, environmentId: task.environmentId, type: 'manager' });
  return !!p;
}

const populate = [
  { path: 'assignedTo', select: 'name username jobTitle tagId rank militaryRole profileImageUrl sourceSystem level1 level2 level3 level4 level5' },
  { path: 'createdBy', select: 'name username' },
  { path: 'environmentId', select: 'name' },
  { path: 'projectId', select: 'name givenDate status' },
  { path: 'approvedBy', select: 'name' },
  { path: 'history.by', select: 'name' },
];

/* GET /api/tasks/mine — ההנחיות שלי (מפקד) */
router.get('/mine', protect, async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user._id })
      .populate(populate).sort({ createdAt: -1 });
    res.json(tasks);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
});

/* GET /api/tasks?environmentId=xxx&projectId=xxx */
router.get('/', protect, async (req, res) => {
  try {
    const { environmentId, projectId } = req.query;

    // בדוק הרשאה לסביבה
    if (req.user.role !== 'admin' && environmentId) {
      const p = await EnvPerm.findOne({ userId: req.user._id, environmentId });
      if (!p) return res.status(403).json({ message: 'אין הרשאה' });

      // מפקד (viewer) — רק הנחיות שהוא האחראי עליהן
      if (p.type === 'viewer') {
        const filter = { environmentId, assignedTo: req.user._id };
        if (projectId) filter.projectId = projectId;
        const directTasks = await Task.find(filter).populate(populate).sort({ taskNumber: 1 });
        const widerFilter = { environmentId };
        if (projectId) widerFilter.projectId = projectId;
        const scopedTasks = await Task.find(widerFilter).populate(populate).sort({ taskNumber: 1 });
        const allById = new Map();
        for (const task of [...directTasks, ...scopedTasks.filter(t => doesUserCommandTask(req.user, t))]) {
          allById.set(String(task._id), task);
        }
        return res.json([...allById.values()].sort((a, b) => (a.taskNumber || 0) - (b.taskNumber || 0)));
      }
    }

    // מנהל סביבה / מנהל על — כל הנחיות הסביבה / פרויקט
    const filter = {};
    if (environmentId) filter.environmentId = environmentId;
    if (projectId) filter.projectId = projectId;
    const tasks = await Task.find(filter).populate(populate).sort({ taskNumber: 1 });
    res.json(tasks);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
});

/* POST /api/tasks */
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, projectId, responsibility, dueDate,
            level1, level2, level3, level4, level5, targetRole, customFields,
            assignedToIds } = req.body;

    if (!title || !projectId) return res.status(400).json({ message: 'כותרת ופרויקט חובה' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'פרויקט לא נמצא' });

    const environmentId = project.environmentId;
    if (req.user.role !== 'admin') {
      const p = await EnvPerm.findOne({ userId: req.user._id, environmentId, type: 'manager' });
      if (!p) return res.status(403).json({ message: 'נדרשת הרשאת מנהל' });
    }

    // בנייה של רשימת ה-assignees:
    // אם ניתנה רשימה מפורשת (assignedToIds) — נשתמש בה לאחר ולידציה שהמשתמשים שייכים לסביבה.
    // אחרת — auto-assign של משתמש בודד לפי הרמות + תפקיד (התנהגות קיימת).
    let assignees = [];

    if (Array.isArray(assignedToIds) && assignedToIds.length) {
      // הסר כפילויות וערכים לא תקינים
      const uniqIds = [...new Set(assignedToIds.map(String))].filter(id =>
        mongoose.Types.ObjectId.isValid(id),
      );
      if (uniqIds.length) {
        // ודא שכל המשתמשים שייכים לסביבה
        const allowed = await EnvPerm.find({
          environmentId,
          userId: { $in: uniqIds },
        }).populate('userId');
        const taskLike = { level1, level2, level3, level4, level5 };
        const allowedSet = new Set(
          allowed
            .filter(p => p.userId && isUserInsideTaskScope(p.userId, taskLike))
            .map(p => String(p.userId._id)),
        );
        assignees = uniqIds.filter(id => allowedSet.has(String(id)));
      }
    }

    if (assignees.length === 0) {
      // ברירת מחדל: שיוך אוטומטי בודד
      const auto = await autoAssign({ environmentId, level1, level2, level3, level4, level5, targetRole });
      assignees = auto ? [auto] : [null];
    }

    const isGroup = assignees.length > 1;
    const taskGroupId = isGroup ? new mongoose.Types.ObjectId() : null;
    const baseFields = {
      title, description,
      environmentId,
      projectId: project._id,
      responsibility,
      givenDate: project.givenDate,
      dueDate,
      level1, level2, level3, level4, level5, targetRole,
      customFields: customFields && typeof customFields === 'object' ? customFields : {},
      createdBy: req.user._id,
    };

    const created = [];
    for (const userId of assignees) {
      const task = await Task.create({
        ...baseFields,
        assignedTo: userId || null,
        taskGroupId,
        history: [{
          action: 'created',
          by: req.user._id,
          byName: req.user.name,
          note: userId
            ? (isGroup ? 'נוצרה כחלק מהקצאה למספר אנשים' : '')
            : 'לא נמצא משתמש מתאים לרמות שנבחרו',
        }],
      });
      const populated = await task.populate(populate);
      created.push(populated);
    }

    // התראות לכל מי שמשויך אליו
    for (const t of created) {
      Promise.resolve()
        .then(() => t.assignedTo && notify.notifyTaskAssigned(t))
        .catch(e => console.error('notify assign:', e.message));
    }

    // תאימות לאחור: אם נוצרה הנחיה אחת — נחזיר אובייקט בודד כקודם.
    // אחרת — נחזיר אובייקט עם tasks ו-groupId כך שהלקוח יוכל להעלות קבצים לכולן.
    if (created.length === 1) {
      return res.status(201).json(created[0]);
    }
    return res.status(201).json({
      _id: created[0]._id, // לתאימות עם קוד קיים שמשתמש ב-res.data._id
      taskGroupId,
      tasks: created,
    });
  } catch (err) {
    console.error('create task:', err.message);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/* PUT /api/tasks/:id — עריכה כללית (מנהל) */
router.put('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'הנחיה לא נמצאה' });
    if (!(await canManage(req.user, task))) return res.status(403).json({ message: 'נדרשת הרשאת מנהל' });

    const prevAssigned = task.assignedTo ? task.assignedTo.toString() : null;

    const {
      title, description, dueDate,
      level1, level2, level3, level4, level5, targetRole, customFields,
    } = req.body;

    if (title !== undefined) task.title = String(title || '').trim();
    if (description !== undefined) task.description = String(description ?? '');
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (level1 !== undefined) task.level1 = String(level1 ?? '').trim();
    if (level2 !== undefined) task.level2 = String(level2 ?? '').trim();
    if (level3 !== undefined) task.level3 = String(level3 ?? '').trim();
    if (level4 !== undefined) task.level4 = String(level4 ?? '').trim();
    if (level5 !== undefined) task.level5 = String(level5 ?? '').trim();
    if (targetRole !== undefined) task.targetRole = String(targetRole ?? '').trim();
    if (customFields !== undefined && typeof customFields === 'object' && !Array.isArray(customFields)) {
      task.customFields = customFields;
    }

    if (!task.title) return res.status(400).json({ message: 'כותרת חובה' });

    const assignedTo = await autoAssign({
      environmentId: task.environmentId,
      level1: task.level1,
      level2: task.level2,
      level3: task.level3,
      level4: task.level4,
      level5: task.level5,
      targetRole: task.targetRole,
    });
    task.assignedTo = assignedTo;

    task.history.push({
      action: 'edited',
      by: req.user._id,
      byName: req.user.name,
      note: 'עודכנו פרטי ההנחיה',
    });

    await task.save();
    await task.populate(populate);
    const nextAssigned = task.assignedTo?._id
      ? task.assignedTo._id.toString()
      : (task.assignedTo ? task.assignedTo.toString() : null);
    if (nextAssigned && nextAssigned !== prevAssigned) {
      Promise.resolve()
        .then(() => notify.notifyTaskAssigned(task))
        .catch(e => console.error('notify reassign:', e.message));
    }
    res.json(task);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/* POST /api/tasks/:id/submit — הגשת הנחיה על ידי מפקד */
router.post('/:id/submit', protect, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, assignedTo: req.user._id });
    if (!task) return res.status(404).json({ message: 'הנחיה לא נמצאה' });
    if (!['pending', 'in_progress', 'rejected'].includes(task.status))
      return res.status(400).json({ message: 'לא ניתן להגיש כעת' });

    const note = req.body?.note || '';
    task.status        = 'waiting_approval';
    task.submissionNote = note;
    task.submittedAt   = new Date();
    task.rejectionNote = ''; // נקה סירוב קודם
    task.history.push({ action: 'submitted', by: req.user._id, byName: req.user.name, note });
    await task.save();
    await task.populate(populate);
    if (note.trim()) {
      await TaskMessage.create({
        taskId: task._id,
        sender: req.user._id,
        senderName: req.user.name,
        text: `בקשת אישור:\n${note.trim()}`,
        readBy: [],
      });
    }
    Promise.resolve()
      .then(() => notify.notifyTaskSubmitted(task, req.user._id))
      .catch(e => console.error('notify submitted:', e.message));
    res.json(task);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
});

/* POST /api/tasks/:id/approve — אישור על ידי מנהל */
router.post('/:id/approve', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'הנחיה לא נמצאה' });
    if (!(await canManage(req.user, task))) return res.status(403).json({ message: 'נדרשת הרשאת מנהל' });
    if (task.status !== 'waiting_approval') return res.status(400).json({ message: 'אין הגשה לאישור' });

    const note = req.body?.note || '';
    task.status    = 'completed';
    task.resolvedAt = new Date();
    task.approvedBy = req.user._id;
    task.history.push({ action: 'approved', by: req.user._id, byName: req.user.name, note });
    await task.save();
    await task.populate(populate);
    Promise.resolve()
      .then(() => notify.notifyTaskApproved(task))
      .catch(e => console.error('notify approved:', e.message));
    res.json(task);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
});

/* POST /api/tasks/:id/reject — סירוב + סיבה */
router.post('/:id/reject', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'הנחיה לא נמצאה' });
    if (!(await canManage(req.user, task))) return res.status(403).json({ message: 'נדרשת הרשאת מנהל' });
    if (task.status !== 'waiting_approval') return res.status(400).json({ message: 'אין הגשה לסירוב' });

    const note = req.body?.note || '';
    task.status        = 'rejected';
    task.rejectionNote = note;
    task.history.push({ action: 'rejected', by: req.user._id, byName: req.user.name, note });
    if (note.trim()) {
      await TaskMessage.create({
        taskId: task._id,
        sender: req.user._id,
        senderName: req.user.name,
        text: `סיבת סירוב מהמנהל:\n${note.trim()}`,
        readBy: [],
      });
    }
    await task.save();
    await task.populate(populate);
    Promise.resolve()
      .then(() => notify.notifyTaskRejected(task, note))
      .catch(e => console.error('notify rejected:', e.message));
    res.json(task);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
});

/* POST /api/tasks/:id/reminder — שליחת תזכורת */
router.post('/:id/reminder', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'הנחיה לא נמצאה' });
    if (!(await canManage(req.user, task))) return res.status(403).json({ message: 'נדרשת הרשאת מנהל' });

    task.lastReminderAt = new Date();
    task.history.push({ action: 'reminder', by: req.user._id, byName: req.user.name });
    await task.save();
    await task.populate(populate);
    Promise.resolve()
      .then(() => notify.notifyTaskReminder(task))
      .catch(e => console.error('notify reminder:', e.message));
    res.json(task);
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
});

/* DELETE /api/tasks/:id */
router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'הנחיה לא נמצאה' });
    if (!(await canManage(req.user, task))) return res.status(403).json({ message: 'נדרשת הרשאת מנהל' });
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'הנחיה נמחקה' });
  } catch { res.status(500).json({ message: 'שגיאת שרת' }); }
});

/* POST /api/tasks/:id/attachments — העלאת קבצים */
router.post('/:id/attachments', protect, upload.array('files', 10), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'הנחיה לא נמצאה' });

    const newFiles = (req.files || []).map(f => ({
      filename:     f.filename,
      originalName: f.originalname,
      size:         f.size,
      mimeType:     f.mimetype,
      uploadedAt:   new Date(),
    }));

    task.attachments = [...(task.attachments || []), ...newFiles];
    await task.save();

    // אם ההנחיה היא חלק מקבוצת הקצאה (נוצרה למספר אנשים) — סנכרן מטא-דאטה
    // של הקבצים גם לאחיות (הקבצים על הדיסק נשמרים פעם אחת בלבד).
    if (task.taskGroupId && newFiles.length) {
      await Task.updateMany(
        { taskGroupId: task.taskGroupId, _id: { $ne: task._id } },
        { $push: { attachments: { $each: newFiles } } },
      );
    }

    res.json({ attachments: task.attachments });
  } catch (err) {
    console.error('upload error:', err.message);
    res.status(500).json({ message: 'שגיאה בהעלאת קובץ' });
  }
});

/* DELETE /api/tasks/:id/attachments/:filename — מחיקת קובץ */
router.delete('/:id/attachments/:filename', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'הנחיה לא נמצאה' });
    if (!(await canManage(req.user, task))) return res.status(403).json({ message: 'נדרשת הרשאת מנהל' });

    const { filename } = req.params;
    task.attachments = task.attachments.filter(a => a.filename !== filename);
    await task.save();

    // נקה את אותו קובץ גם אצל אחים בקבוצת ההקצאה
    if (task.taskGroupId) {
      await Task.updateMany(
        { taskGroupId: task.taskGroupId, _id: { $ne: task._id } },
        { $pull: { attachments: { filename } } },
      );
    }

    // מחק מהדיסק רק אם אף הנחיה אחרת לא משתמשת בקובץ זה (כלומר אין siblings)
    const stillReferenced = await Task.exists({ 'attachments.filename': filename });
    if (!stillReferenced) {
      const filePath = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    res.json({ attachments: task.attachments });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
