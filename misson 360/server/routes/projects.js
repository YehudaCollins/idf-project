const router  = require('express').Router();
const Project = require('../models/Project');
const Task    = require('../models/Task');
const EnvPerm = require('../models/EnvironmentPermission');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');

async function canManageEnv(user, environmentId) {
  if (user.role === 'admin') return true;
  const p = await EnvPerm.findOne({ userId: user._id, environmentId, type: 'manager' });
  return !!p;
}

async function canViewEnv(user, environmentId) {
  if (user.role === 'admin') return true;
  const p = await EnvPerm.findOne({ userId: user._id, environmentId });
  return !!p;
}

const populate = [
  { path: 'environmentId', select: 'name' },
  { path: 'createdBy', select: 'name username' },
];

/* GET /api/projects/mine — פרויקטים שיש בהם משימות שמוקצות אליי */
router.get('/mine', protect, async (req, res) => {
  try {
    const taskProjectIds = await Task.distinct('projectId', { assignedTo: req.user._id });
    const projects = await Project.find({ _id: { $in: taskProjectIds } })
      .populate(populate)
      .sort({ createdAt: -1 });
    res.json(projects);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/* GET /api/projects?environmentId=xxx — פרויקטים בסביבה (לפי הרשאה) */
router.get('/', protect, async (req, res) => {
  try {
    const { environmentId } = req.query;
    if (!environmentId) return res.status(400).json({ message: 'חסר environmentId' });

    if (!(await canViewEnv(req.user, environmentId))) {
      return res.status(403).json({ message: 'אין הרשאה' });
    }

    const isManager = await canManageEnv(req.user, environmentId);
    let projects = await Project.find({ environmentId })
      .populate(populate)
      .sort({ projectNumber: 1 });

    // viewer: רק פרויקטים שיש בהם משימות שמוקצות אליו
    if (!isManager) {
      const taskProjectIds = await Task.distinct('projectId', {
        environmentId,
        assignedTo: req.user._id,
      });
      const allowed = new Set(taskProjectIds.map(String));
      projects = projects.filter(p => allowed.has(String(p._id)));
    }

    res.json(projects);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/* GET /api/projects/:id */
router.get('/:id', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate(populate);
    if (!project) return res.status(404).json({ message: 'פרויקט לא נמצא' });

    if (!(await canViewEnv(req.user, project.environmentId._id || project.environmentId))) {
      return res.status(403).json({ message: 'אין הרשאה' });
    }
    res.json(project);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/* GET /api/projects/:id/stats — סטטיסטיקות הפרויקט */
router.get('/:id/stats', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'פרויקט לא נמצא' });
    if (!(await canViewEnv(req.user, project.environmentId))) {
      return res.status(403).json({ message: 'אין הרשאה' });
    }

    const tasks = await Task.find({ projectId: project._id }).select(
      'status assignedTo dueDate submittedAt resolvedAt createdAt',
    );

    const byStatus = { pending: 0, in_progress: 0, waiting_approval: 0, completed: 0, overdue: 0, rejected: 0 };
    const peopleIds = new Set();
    const peopleStats = new Map(); // userId -> { total, completed, waiting, rejected, pending }
    const now = Date.now();
    let overdueCount = 0;
    let dueSoonCount = 0;

    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;

      if (t.dueDate && t.status !== 'completed') {
        const due = new Date(t.dueDate).getTime();
        if (due < now) overdueCount++;
        else if (due - now < 1000 * 60 * 60 * 24 * 3) dueSoonCount++;
      }

      if (t.assignedTo) {
        const uid = String(t.assignedTo);
        peopleIds.add(uid);
        const cur = peopleStats.get(uid) || { total: 0, completed: 0, waiting: 0, rejected: 0, pending: 0 };
        cur.total++;
        if (t.status === 'completed') cur.completed++;
        else if (t.status === 'waiting_approval') cur.waiting++;
        else if (t.status === 'rejected') cur.rejected++;
        else cur.pending++;
        peopleStats.set(uid, cur);
      }
    }

    const total = tasks.length;
    const completed = byStatus.completed || 0;
    const progressPct = total ? Math.round((completed / total) * 100) : 0;

    const userDocs = peopleIds.size
      ? await User.find({ _id: { $in: [...peopleIds] } }).select('name jobTitle level1 level2 level3 level4 level5')
      : [];
    const userMap = new Map(userDocs.map(u => [String(u._id), u]));

    const team = [...peopleStats.entries()].map(([uid, s]) => {
      const u = userMap.get(uid);
      return {
        userId: uid,
        name: u?.name || '—',
        jobTitle: u?.jobTitle || '',
        total: s.total,
        completed: s.completed,
        waiting: s.waiting,
        rejected: s.rejected,
        pending: s.pending,
        completionPct: s.total ? Math.round((s.completed / s.total) * 100) : 0,
      };
    }).sort((a, b) => b.total - a.total);

    res.json({
      total,
      completed,
      progressPct,
      byStatus,
      peopleCount: peopleIds.size,
      overdueCount,
      dueSoonCount,
      team,
      project: {
        _id: project._id,
        name: project.name,
        description: project.description,
        givenDate: project.givenDate,
        status: project.status,
      },
    });
  } catch (err) {
    console.error('project stats:', err.message);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/* POST /api/projects — יצירת פרויקט (מנהל סביבה / מנהל על) */
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, environmentId, givenDate } = req.body;
    if (!name || !environmentId) return res.status(400).json({ message: 'שם פרויקט וסביבה חובה' });

    if (!(await canManageEnv(req.user, environmentId))) {
      return res.status(403).json({ message: 'נדרשת הרשאת מנהל' });
    }

    const project = await Project.create({
      name: String(name).trim(),
      description: String(description || '').trim(),
      environmentId,
      givenDate: givenDate ? new Date(givenDate) : new Date(),
      createdBy: req.user._id,
    });
    const populated = await project.populate(populate);
    res.status(201).json(populated);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/* PUT /api/projects/:id */
router.put('/:id', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'פרויקט לא נמצא' });
    if (!(await canManageEnv(req.user, project.environmentId))) {
      return res.status(403).json({ message: 'נדרשת הרשאת מנהל' });
    }

    const { name, description, givenDate, status } = req.body;
    if (name !== undefined) project.name = String(name || '').trim();
    if (description !== undefined) project.description = String(description ?? '');
    let givenDateChanged = false;
    if (givenDate !== undefined) {
      const next = givenDate ? new Date(givenDate) : new Date();
      if (!project.givenDate || +project.givenDate !== +next) givenDateChanged = true;
      project.givenDate = next;
    }
    if (status !== undefined && ['active', 'archived'].includes(status)) project.status = status;

    if (!project.name) return res.status(400).json({ message: 'שם פרויקט חובה' });

    await project.save();

    // סנכרן תאריך מתן לכל משימות הפרויקט (כי תאריך מתן משותף)
    if (givenDateChanged) {
      await Task.updateMany({ projectId: project._id }, { $set: { givenDate: project.givenDate } });
    }

    await project.populate(populate);
    res.json(project);
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

/* DELETE /api/projects/:id — מוחק פרויקט וכל המשימות בו */
router.delete('/:id', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'פרויקט לא נמצא' });
    if (!(await canManageEnv(req.user, project.environmentId))) {
      return res.status(403).json({ message: 'נדרשת הרשאת מנהל' });
    }

    await Task.deleteMany({ projectId: project._id });
    await Project.findByIdAndDelete(project._id);
    res.json({ message: 'הפרויקט נמחק' });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

module.exports = router;
