require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Environment = require('./models/Environment');
const EnvPerm = require('./models/EnvironmentPermission');
const Task = require('./models/Task');

const TOTAL_ENVS = 36;
const USERS_PER_ENV = 28;
const MANAGERS_PER_ENV = 4;
const TASKS_PER_ENV = 18;

const LEVEL1 = ['חטיבת ההפעלה', 'מטה', 'מפקדה'];
const LEVEL2 = ['גולס', 'יהלם', '460', 'מטה פיקוד', 'שלוחות'];
const LEVEL3 = ['מקשא"פ', 'מטה', 'קשרח', 'הפעלה'];
const LEVEL4 = ['צוות אלפא', 'צוות בטא', 'סגל', '---'];
const LEVEL5 = ['יחידה א', 'יחידה ב', 'מדור בקרה', 'מדור תפעול'];
const JOBS = ['מפקד צוות', 'תוכניתן', 'קשרח', 'רה"פ', 'קמב"צ', 'קמ"ד דיגיטל'];
const STATUSES = ['pending', 'in_progress', 'waiting_approval', 'completed', 'overdue'];

function pick(arr, i) {
  return arr[i % arr.length];
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Mongo connected');

  let admin = await User.findOne({ tagId: '8001119' });
  if (!admin) {
    admin = await User.create({
      tagId: '8001119',
      name: 'יהודה ד קולינס',
      username: 'admin',
      role: 'admin',
      jobTitle: 'מנהל מערכת',
      level1: 'חטיבת ההפעלה',
      level2: 'מטה',
      level3: 'מקשא"פ',
      level4: '---',
      level5: 'יחידת ניהול',
    });
    console.log('✅ Admin created');
  }

  // ניקוי דאטה ישן של load test בלבד כדי שהרצה חוזרת תישאר נקיה
  await Task.deleteMany({ title: /^LT-/ });
  const oldEnvs = await Environment.find({ name: /^LT-סביבה-/ }, { _id: 1 });
  if (oldEnvs.length) {
    const envIds = oldEnvs.map(e => e._id);
    await EnvPerm.deleteMany({ environmentId: { $in: envIds } });
    await Environment.deleteMany({ _id: { $in: envIds } });
  }
  await User.deleteMany({ tagId: /^LT-/ });
  console.log('🧹 Cleaned previous load-test data');

  let usersCreated = 0;
  let permsCreated = 0;
  let tasksCreated = 0;

  for (let e = 1; e <= TOTAL_ENVS; e++) {
    const env = await Environment.create({
      name: `LT-סביבה-${String(e).padStart(2, '0')}`,
      description: `סביבת עומס לבדיקות תצוגה ${e}`,
      adminId: admin._id,
      isActive: true,
      template: {
        responsibilityLevels: 5,
        customColumns: [
          { id: 'lt_col_1', label: 'מדד ביצוע' },
          { id: 'lt_col_2', label: 'הערת בקרה' },
        ],
        defaultDueDays: 14,
        overdueThresholdDays: 0,
        autoReminderDays: 3,
      },
    });

    const envUsers = [];
    for (let u = 1; u <= USERS_PER_ENV; u++) {
      const n = (e - 1) * USERS_PER_ENV + u;
      const tagId = `LT-${String(n).padStart(6, '0')}`;
      const user = await User.create({
        tagId,
        name: `LT משתמש ${n}`,
        username: `lt_user_${n}`,
        role: 'commander',
        jobTitle: pick(JOBS, n),
        level1: pick(LEVEL1, n),
        level2: pick(LEVEL2, n + 1),
        level3: pick(LEVEL3, n + 2),
        level4: pick(LEVEL4, n + 3),
        level5: pick(LEVEL5, n + 4),
        isActive: true,
      });
      envUsers.push(user);
      usersCreated++;
    }

    for (let i = 0; i < envUsers.length; i++) {
      const user = envUsers[i];
      const type = i < MANAGERS_PER_ENV ? 'manager' : 'viewer';
      await EnvPerm.create({
        userId: user._id,
        environmentId: env._id,
        type,
        grantedBy: admin._id,
      });
      permsCreated++;
    }

    for (let t = 1; t <= TASKS_PER_ENV; t++) {
      const assigned = envUsers[t % envUsers.length];
      const idx = e * 1000 + t;
      const givenDate = new Date();
      const dueDate = new Date(Date.now() + (t % 20) * 24 * 60 * 60 * 1000);
      await Task.create({
        title: `LT-${e}-${t} הנחיית עומס`,
        description: `נתון בדיקה להרצת עומס תצוגה עבור סביבה ${e}`,
        environmentId: env._id,
        assignedTo: assigned._id,
        responsibility: pick(JOBS, idx),
        status: pick(STATUSES, idx),
        givenDate,
        dueDate,
        level1: assigned.level1,
        level2: assigned.level2,
        level3: assigned.level3,
        level4: assigned.level4,
        level5: assigned.level5,
        createdBy: admin._id,
      });
      tasksCreated++;
    }
  }

  console.log('🎉 Load-test seed finished');
  console.log(`Environments: ${TOTAL_ENVS}`);
  console.log(`Users:        ${usersCreated}`);
  console.log(`Permissions:  ${permsCreated}`);
  console.log(`Tasks:        ${tasksCreated}`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
