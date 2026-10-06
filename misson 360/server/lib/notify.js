const Notification = require('../models/Notification');
const EnvPerm = require('../models/EnvironmentPermission');
const User = require('../models/User');

function envIdOf(task) {
  if (!task?.environmentId) return null;
  return task.environmentId._id ? task.environmentId._id : task.environmentId;
}

function projectIdOf(task) {
  if (!task?.projectId) return null;
  return task.projectId._id ? task.projectId._id : task.projectId;
}

function hrefTasksManager(taskId, environmentId, projectId) {
  if (projectId) return `/admin/projects/${projectId}?task=${taskId}&env=${environmentId}`;
  return `/admin/projects?task=${taskId}&env=${environmentId}`;
}

function hrefMyTasks(taskId, projectId) {
  if (projectId) return `/admin/my-tasks/${projectId}?task=${taskId}`;
  return `/admin/my-tasks?task=${taskId}`;
}

async function createForUser(userId, payload) {
  if (!userId) return;
  await Notification.create({
    userId,
    environmentId: payload.environmentId || null,
    taskId: payload.taskId || null,
    type: payload.type,
    title: payload.title,
    body: payload.body || '',
    href: payload.href,
  });
}

/** מנהלי סביבה + מנהלי על */
async function notifyEnvManagersAndAdmins(environmentId, payload, { skipUserId } = {}) {
  const perms = await EnvPerm.find({ environmentId, type: 'manager' }).select('userId');
  const adminUsers = await User.find({ role: 'admin', isActive: true }).select('_id');

  const ids = new Set();
  perms.forEach(p => ids.add(String(p.userId)));
  adminUsers.forEach(u => ids.add(String(u._id)));
  if (skipUserId) ids.delete(String(skipUserId));

  await Promise.all([...ids].map(id => createForUser(id, payload)));
}

async function notifyTaskSubmitted(task, submitterUserId) {
  const eid = envIdOf(task);
  const pid = projectIdOf(task);
  const tid = task._id;
  const submitterName = task.history?.length
    ? task.history[task.history.length - 1]?.byName || ''
    : '';

  await notifyEnvManagersAndAdmins(
    eid,
    {
      type: 'task_submitted',
      title: 'הוגשה הנחיה לאישור',
      body: `"${task.title?.slice(0, 120) || ''}"${submitterName ? ` · ${submitterName}` : ''}`,
      environmentId: eid,
      taskId: tid,
      href: hrefTasksManager(tid, eid, pid),
    },
    { skipUserId: submitterUserId },
  );
}

async function notifyTaskApproved(task) {
  const assignee = task.assignedTo?._id || task.assignedTo;
  if (!assignee) return;

  const approver = task.approvedBy?.name || task.history?.[task.history.length - 1]?.byName || '';
  await createForUser(assignee, {
    type: 'task_approved',
    title: 'הנחיה אושרה',
    body: `"${task.title?.slice(0, 120) || ''}"${approver ? ` · אושר על ידי ${approver}` : ''}`,
    environmentId: envIdOf(task),
    taskId: task._id,
    href: hrefMyTasks(task._id, projectIdOf(task)),
  });
}

async function notifyTaskRejected(task, rejectionNote) {
  const assignee = task.assignedTo?._id || task.assignedTo;
  if (!assignee) return;

  const snippet = (rejectionNote || '').slice(0, 160);
  await createForUser(assignee, {
    type: 'task_rejected',
    title: 'הנחיה נדחתה',
    body: `"${task.title?.slice(0, 100) || ''}"${snippet ? ` — ${snippet}` : ''}`,
    environmentId: envIdOf(task),
    taskId: task._id,
    href: hrefMyTasks(task._id, projectIdOf(task)),
  });
}

async function notifyTaskReminder(task) {
  const assignee = task.assignedTo?._id || task.assignedTo;
  if (!assignee) return;

  await createForUser(assignee, {
    type: 'task_reminder',
    title: 'תזכורת על הנחיה',
    body: `"${task.title?.slice(0, 120) || ''}"`,
    environmentId: envIdOf(task),
    taskId: task._id,
    href: hrefMyTasks(task._id, projectIdOf(task)),
  });
}

async function notifyTaskAssigned(task) {
  const assignee = task.assignedTo?._id || task.assignedTo;
  if (!assignee) return;

  await createForUser(assignee, {
    type: 'task_assigned',
    title: 'הוקצתה לך הנחיה חדשה',
    body: task.title?.slice(0, 160) || '',
    environmentId: envIdOf(task),
    taskId: task._id,
    href: hrefMyTasks(task._id, projectIdOf(task)),
  });
}

async function notifyPermissionGranted(userId, environmentId, envName, type) {
  const roleLabel = type === 'manager' ? 'מנהל סביבה' : 'מפקד';
  const href = type === 'manager'
    ? `/admin/projects?env=${environmentId}`
    : `/admin/my-tasks?env=${environmentId}`;

  await createForUser(userId, {
    type: 'permission_granted',
    title: 'קיבלת גישה לסביבה',
    body: `${envName || 'סביבה'} — תפקיד: ${roleLabel}`,
    environmentId,
    taskId: null,
    href,
  });
}

/** התראה למנהלי סביבה (וגם למנהלי על) על בקשת גישה חדשה */
async function notifyAccessRequestCreated({ environmentId, envName, requesterName, requestType, note }) {
  const roleLabel = requestType === 'manager' ? 'מנהל סביבה' : 'מפקד';
  const noteSnippet = (note || '').trim().slice(0, 140);
  await notifyEnvManagersAndAdmins(environmentId, {
    type: 'permission_request',
    title: 'בקשת גישה חדשה',
    body: `${requesterName || 'משתמש'} ביקש ${roleLabel} ל-${envName || 'הסביבה'}${noteSnippet ? ` · "${noteSnippet}"` : ''}`,
    environmentId,
    taskId: null,
    href: `/admin/env-settings?env=${environmentId}#requests`,
  });
}

/** התראה למבקש שהבקשה אושרה */
async function notifyAccessRequestApproved({ userId, environmentId, envName, requestType }) {
  const roleLabel = requestType === 'manager' ? 'מנהל סביבה' : 'מפקד';
  const href = requestType === 'manager'
    ? `/admin/projects?env=${environmentId}`
    : `/admin/my-tasks?env=${environmentId}`;
  await createForUser(userId, {
    type: 'permission_request_approved',
    title: 'בקשת הגישה אושרה',
    body: `${envName || 'הסביבה'} — תפקיד: ${roleLabel}`,
    environmentId,
    taskId: null,
    href,
  });
}

/** התראה למבקש שהבקשה נדחתה */
async function notifyAccessRequestRejected({ userId, environmentId, envName, decisionNote }) {
  const snippet = (decisionNote || '').trim().slice(0, 160);
  await createForUser(userId, {
    type: 'permission_request_rejected',
    title: 'בקשת הגישה נדחתה',
    body: `${envName || 'הסביבה'}${snippet ? ` — ${snippet}` : ''}`,
    environmentId,
    taskId: null,
    href: `/admin`,
  });
}

module.exports = {
  notifyTaskSubmitted,
  notifyTaskApproved,
  notifyTaskRejected,
  notifyTaskReminder,
  notifyTaskAssigned,
  notifyPermissionGranted,
  notifyAccessRequestCreated,
  notifyAccessRequestApproved,
  notifyAccessRequestRejected,
};
