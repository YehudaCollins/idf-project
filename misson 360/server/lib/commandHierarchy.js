const EMPTY_VALUES = new Set(['', '---', '-', 'כללי', 'לא הוגדר']);

function normalizeLevel(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text || EMPTY_VALUES.has(text)) return '';
  return text;
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function levelPathFrom(value = {}) {
  return [1, 2, 3, 4, 5].map(index => normalizeLevel(value[`level${index}`]));
}

function pathDepth(value = {}) {
  const path = Array.isArray(value) ? value : levelPathFrom(value);
  for (let index = path.length - 1; index >= 0; index -= 1) {
    if (normalizeLevel(path[index])) return index + 1;
  }
  return 0;
}

function effectiveCommandDepth(user = {}) {
  const physicalDepth = pathDepth(user);
  const title = normalizeText([user.jobTitle, user.militaryRole, user.rank].filter(Boolean).join(' '));
  if (!physicalDepth) return 0;

  const roleDepths = [
    { pattern: /(מנהל מערכת|מפקד חטיבה|מח"ט|מחט)/, depth: 1 },
    { pattern: /(רע"ן|רען|ראש ענף|מפקד ענף|ענף|מ"פ|מפ\b|פלוגה)/, depth: 2 },
    { pattern: /(רת"ח|רתח|ראש תחום|תחום)/, depth: 3 },
    { pattern: /(רמ"ד|רמד|קמ"ד|קמד|מפקד מדור|מדור|מפקד צוות|צוות)/, depth: 4 },
  ];
  const match = roleDepths.find(row => row.pattern.test(title));
  if (!match) return physicalDepth;
  return Math.min(match.depth, physicalDepth);
}

function taskLevels(taskLike = {}) {
  return levelPathFrom(taskLike);
}

function matchesPrefix(prefix, fullPath) {
  return prefix.every((level, index) => !normalizeLevel(level) || normalizeLevel(fullPath[index]) === normalizeLevel(level));
}

function isUserInsideTaskScope(user, taskLike) {
  const selectedTaskPath = taskLevels(taskLike);
  const userPath = levelPathFrom(user);
  return matchesPrefix(selectedTaskPath, userPath);
}

function doesUserCommandTask(user, taskLike) {
  const userPath = levelPathFrom(user);
  const selectedTaskPath = taskLevels(taskLike);
  const userDepth = effectiveCommandDepth(user);
  const taskDepth = pathDepth(selectedTaskPath);
  if (!userDepth || !taskDepth || userDepth > taskDepth) return false;

  for (let index = 0; index < userDepth; index += 1) {
    if (normalizeLevel(userPath[index]) !== normalizeLevel(selectedTaskPath[index])) return false;
  }
  return true;
}

function roleScore(user, targetRole) {
  const wanted = normalizeText(targetRole);
  if (!wanted) return 0;
  const candidates = [
    user.jobTitle,
    user.militaryRole,
    user.rank,
  ].map(normalizeText).filter(Boolean);

  if (candidates.some(value => value === wanted)) return 35;
  if (candidates.some(value => value.includes(wanted) || wanted.includes(value))) return 20;
  return 0;
}

function scoreUserForTask(user, taskLike = {}) {
  if (!doesUserCommandTask(user, taskLike)) return -1;
  const userDepth = effectiveCommandDepth(user);
  const taskDepth = pathDepth(taskLike);
  const depthScore = userDepth * 10;
  const closenessScore = Math.max(0, 5 - (taskDepth - userDepth));
  return depthScore + closenessScore + roleScore(user, taskLike.targetRole);
}

function filterUsersInsideScope(users, taskLike = {}) {
  return users.filter(user => isUserInsideTaskScope(user, taskLike));
}

module.exports = {
  normalizeLevel,
  levelPathFrom,
  pathDepth,
  effectiveCommandDepth,
  taskLevels,
  isUserInsideTaskScope,
  doesUserCommandTask,
  scoreUserForTask,
  filterUsersInsideScope,
};
