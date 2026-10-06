/**
 * seed.js — אתחול נתונים במסד (פעם אחת / אחרי איפוס DB)
 * node seed.js
 */
/**
 * seed.js — נתוני DEV לפיתוח ובדיקות בלבד.
 * בייצור: הנתונים מגיעים ממיגרציה (migrate.js).
 * אימות: לפי tagId (חוגר) — ללא סיסמה.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Environment = require('./models/Environment');
const EnvPerm = require('./models/EnvironmentPermission');
const Task = require('./models/Task');
const Project = require('./models/Project');
const { createInitialsAvatarDataUri, safeProfileImageUrl } = require('./lib/safeProfileImage');

function demoProfileImage(name, tagId) {
  return createInitialsAvatarDataUri(name, tagId);
}

function missingProfileUpdates(user, data) {
  const updates = {};
  [
    'rank',
    'militaryRole',
    'email',
    'phone',
    'profileImageUrl',
    'sourceSystem',
    'registeredVia',
    'level1',
    'level2',
    'level3',
    'level4',
    'level5',
  ].forEach((field) => {
    if (field === 'profileImageUrl') {
      if (!safeProfileImageUrl(user[field]) && data[field]) updates[field] = data[field];
      return;
    }
    if (!user[field] && data[field]) updates[field] = data[field];
  });
  if (!user.sourceSystems?.length && data.sourceSystem) updates.sourceSystems = [data.sourceSystem];
  return updates;
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');

  // ---- מנהל על ----
  // tagId = מספר חוגר דמה לפיתוח
  let admin = await User.findOne({ tagId: '8001119' });
  if (!admin) {
    admin = await User.create({
      tagId:    '8001119',
      name:     'יהודה ד קולינס',
      username: 'admin',
      role:     'admin',
      jobTitle: 'מנהל מערכת',
      rank:     'רס"ן',
      militaryRole: 'מנהל מערכת',
      email:    '8001119@mission360.local',
      phone:    '050-8001119',
      profileImageUrl: demoProfileImage('יהודה ד קולינס', '8001119'),
      sourceSystem: 'Mission360 Seed',
      registeredVia: 'Mission360 Seed',
      sourceSystems: ['Mission360 Seed'],
      level1:   'חטיבת ההפעלה',
      level2:   'מטה',
      level3:   'מקשא"פ',
      level4:   '---',
      level5:   '',
    });
    console.log('✅ Admin created (tagId: 8001119)');
  } else {
    const updates = missingProfileUpdates(admin, {
      rank: 'רס"ן',
      militaryRole: 'מנהל מערכת',
      email: '8001119@mission360.local',
      phone: '050-8001119',
      profileImageUrl: demoProfileImage('יהודה ד קולינס', '8001119'),
      sourceSystem: 'Mission360 Seed',
      registeredVia: 'Mission360 Seed',
      level1: 'חטיבת ההפעלה',
      level2: 'מטה',
      level3: 'מקשא"פ',
      level4: '---',
      level5: '',
    });
    if (Object.keys(updates).length) await User.findByIdAndUpdate(admin._id, { $set: updates });
    console.log('ℹ️  Admin already exists');
  }

  // ---- סביבה ----
  let env = await Environment.findOne({ name: 'השתלמות דיגיטל תפעולי' });
  if (!env) {
    env = await Environment.create({
      name: 'השתלמות דיגיטל תפעולי',
      description: 'סביבת עבודה להשתלמות',
      adminId: admin._id,
      isActive: true,
    });
    console.log('✅ Environment created');
  } else {
    console.log('ℹ️  Environment already exists');
  }

  // ---- מפקדים + הרשאות ----
  // tagId = מספרי חוגר דמה לפיתוח
  const commandersData = [
    { tagId: '8002233', name: 'ליהי אורטוב',   username: 'lihi',    rank: 'רס"ן', militaryRole: 'מ"פ הפעלה',        jobTitle: 'רס"ן מ"פ הפעלה',        email: '8002233@mission360.local', phone: '050-8002233', level1: 'חטיבת ההפעלה', level2: 'גולס',       level3: 'מקשא"פ', level4: 'צוות בטא',  level5: 'יחידה ב',    envType: 'manager' },
    { tagId: '8003344', name: 'עורן בשארי',    username: 'oren',    rank: 'סרן',  militaryRole: 'מפקד צוות בטא',    jobTitle: 'סרן מפקד צוות בטא',    email: '8003344@mission360.local', phone: '050-8003344', level1: 'חטיבת ההפעלה', level2: 'גולס',       level3: 'מקשא"פ', level4: 'צוות בטא',  level5: 'יחידה א',    envType: 'viewer' },
    { tagId: '8004455', name: 'שירה אסולין',   username: 'shira',   rank: 'סרן',  militaryRole: 'קשר"ח',             jobTitle: 'סרן קשר"ח',             email: '8004455@mission360.local', phone: '050-8004455', level1: 'חטיבת ההפעלה', level2: 'יהלם',       level3: 'מטה',    level4: 'סגל',       level5: 'מחלקת קשרח', envType: 'viewer' },
    { tagId: '8005566', name: 'נהוראי',        username: 'nehorai', rank: 'סמל',  militaryRole: 'מתכנת נגד מקצועי', jobTitle: 'סמל מתכנת נגד מקצועי', email: '8005566@mission360.local', phone: '050-8005566', level1: 'חטיבת ההפעלה', level2: 'מטה פיקוד',  level3: 'מקשא"פ', level4: 'צוות אלפא', level5: 'יחידה א',    envType: 'viewer' },
    // משתמש DEV לסימולציה של חוגר (לא שמור במסד — מגיע מ-SP mock)
    // tagId 1119/2233/3344/4455 הם mock-only ב-DEV_SP_MOCKS בclient
  ];

  const commanders = {};
  for (const data of commandersData) {
    let u = await User.findOne({ tagId: data.tagId });
    if (!u) {
      u = await User.create({
        tagId: data.tagId, name: data.name, username: data.username,
        role: 'commander', jobTitle: data.jobTitle,
        rank: data.rank,
        militaryRole: data.militaryRole,
        email: data.email,
        phone: data.phone,
        profileImageUrl: demoProfileImage(data.name, data.tagId),
        sourceSystem: 'Mission360 Seed',
        registeredVia: 'Mission360 Seed',
        sourceSystems: ['Mission360 Seed'],
        level1: data.level1, level2: data.level2, level3: data.level3,
        level4: data.level4, level5: data.level5 || '',
      });
      console.log(`✅ Commander created: ${data.name}`);
    } else {
      // עדכן level5 אם חסר
      const updates = missingProfileUpdates(u, {
        ...data,
        profileImageUrl: demoProfileImage(data.name, data.tagId),
        sourceSystem: 'Mission360 Seed',
        registeredVia: 'Mission360 Seed',
      });
      if (Object.keys(updates).length) {
        await User.findByIdAndUpdate(u._id, { $set: updates });
        console.log(`🔄 Updated profile fields for: ${data.name}`);
      }
      console.log(`ℹ️  Commander exists: ${data.name}`);
    }
    commanders[data.username] = u;

    // הרשאת סביבה
    await EnvPerm.findOneAndUpdate(
      { userId: u._id, environmentId: env._id },
      { type: data.envType, grantedBy: admin._id },
      { upsert: true, setDefaultsOnInsert: true }
    );
    console.log(`   → הרשאה: ${data.envType} לסביבה "${env.name}"`);
  }

  // ---- פרויקט ברירת מחדל ----
  let defaultProject = await Project.findOne({ environmentId: env._id, name: 'הנחיות כלליות' });
  if (!defaultProject) {
    defaultProject = await Project.create({
      name: 'הנחיות כלליות',
      description: 'פרויקט ברירת מחדל להנחיות כלליות',
      environmentId: env._id,
      givenDate: new Date('2026-01-01'),
      createdBy: admin._id,
    });
    console.log('✅ Default project created');
  }

  // ---- משימות ----
  const taskCount = await Task.countDocuments({ environmentId: env._id });
  if (taskCount === 0) {
    const tasksData = [
      {
        title: 'טסט השתלמות',
        description: 'טסט השתלמות - פירוט מלא של ההנחיה',
        assignedTo: commanders['oren']._id,
        responsibility: 'קמ"ד דיגיטל תפעולי / מבצעי',
        status: 'overdue',
        givenDate: new Date('2025-12-10'),
        dueDate: new Date('2025-12-19'),
        level1: 'חטיבת ההפעלה', level2: 'מטה פיקוד', level3: 'מקשא"פ', level4: 'צוות אלפא',
      },
      {
        title: 'פ.ע קרן',
        description: 'בדיקה של תהליכי עבודה',
        assignedTo: commanders['shira']._id,
        responsibility: 'קשרח',
        status: 'overdue',
        givenDate: new Date('2026-02-18'),
        dueDate: new Date('2026-02-18'),
        level1: 'חטיבת ההפעלה', level2: '460', level3: 'מטה', level4: 'סגל',
      },
      {
        title: 'שידרוג מערכת',
        description: 'פיתוח ואיפיון מערכת מחדש',
        assignedTo: commanders['nehorai']._id,
        responsibility: 'מתכנת - נגד מקצועי',
        status: 'in_progress',
        givenDate: new Date('2026-05-03'),
        dueDate: new Date('2026-05-16'),
        level1: 'חטיבת ההפעלה', level2: 'מטה פיקוד', level3: 'מקשא"פ', level4: 'צוות אלפא',
      },
      {
        title: 'עדכון נהלים',
        description: 'לעדכן את נהלי העבודה בהתאם להנחיות החדשות',
        assignedTo: commanders['shira']._id,
        responsibility: 'קשרח',
        status: 'waiting_approval',
        givenDate: new Date('2026-04-01'),
        dueDate: new Date('2026-04-15'),
        level1: 'חטיבת ההפעלה', level2: 'יהלם', level3: 'מטה', level4: '---',
        submissionNote: 'הושלם בהצלחה',
        submittedAt: new Date('2026-04-14'),
      },
      {
        title: 'דיווח חודשי',
        description: 'להגיש דיווח חודשי על פעילות הצוות',
        assignedTo: commanders['oren']._id,
        responsibility: 'מפ הפעלה',
        status: 'completed',
        givenDate: new Date('2026-03-01'),
        dueDate: new Date('2026-03-31'),
        level1: 'חטיבת ההפעלה', level2: 'גולס', level3: 'מקשא"פ', level4: '---',
        submittedAt: new Date('2026-03-28'),
        resolvedAt: new Date('2026-03-29'),
      },
    ];

    for (let i = 0; i < tasksData.length; i++) {
      await Task.create({
        ...tasksData[i],
        environmentId: env._id,
        projectId: defaultProject._id,
        taskNumber: i + 1,
        createdBy: admin._id,
      });
      console.log(`✅ Task created: ${tasksData[i].title}`);
    }
  } else {
    console.log(`ℹ️  Tasks already exist (${taskCount})`);
  }

  console.log('\n🎉 Seed complete! (DEV נתוני פיתוח)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('אימות: חוגר בלבד — אין סיסמאות');
  console.log('');
  console.log('tagId DEV לבדיקה (דמה חוגר):');
  console.log('  מנהל על:       DEV-ADMIN-001  (יהודה ד קולינס)');
  console.log('  מנהל סביבה:    DEV-002        (ליהי אורטוב)');
  console.log('  מפקד:          DEV-003        (עורן בשארי)');
  console.log('  מפקד:          DEV-004        (שירה אסולין)');
  console.log('  מפקד:          DEV-005        (נהוראי)');
  console.log('');
  console.log('  בסביבת DEV: השתמש ב-DevUserSwitcher בתפריט');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
