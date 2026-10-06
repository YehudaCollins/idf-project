/**
 * migrate.js — מיגרציה מהמערכת הישנה למערכת החדשה
 *
 * איך להריץ:
 *   node migrate.js --preview        ← רק תצוגה, לא כותב כלום
 *   node migrate.js --run            ← ביצוע מלא
 *   node migrate.js --run --clean    ← מוחק קודם (זהירות!)
 *
 * הגדר OLD_MONGO_URI ב-.env:
 *   OLD_MONGO_URI=mongodb://localhost:27017/[שם-מסד-ישן]
 *
 * ══════════════════════════════════════════════════════
 * מיפוי שדות ישנים → חדשים:
 *
 *  users (ישן)                → User (חדש)
 *  ───────────────────────────────────────
 *  id        (String)         → tagId
 *  username  (String)         → name  (שם תצוגה)
 *  userEmail (String)         → meta.userEmail  (שמור לגיבוי)
 *  role      ([String])       → role: 'admin'|'commander'
 *  access    ([String])       → meta.oldAccess  (לגיבוי)
 *  level_1   ([String])       → level1 (ערך ראשון)
 *  level_2   ([String])       → level2
 *  level_3   ([String])       → level3
 *  level_4   ([String])       → level4
 *  spaceWork_DB ([String])    → EnvironmentPermission rows
 *  newMissions  ([String])    → meta.oldNewMissions  (לא בשימוש)
 *
 *  missions / missionsArchive (ישן) → Task (חדש)
 *  ───────────────────────────────────────────────
 *  id           ([String])    → assignedTo (ראשון), meta.allAssignees (כולם)
 *  title                      → title
 *  details                    → description
 *  startedAt    (String)      → givenDate
 *  endedAt      (String)      → dueDate  (פעיל) / resolvedAt (ארכיון)
 *  daysLeft     (String)      → meta.oldDaysLeft (מחושב, לא נחוץ)
 *  status / statusMission     → status  (לפי mapStatus)
 *  missionId    (String)      → meta.oldMissionId
 *  chat         (Object)      → TaskMessage rows
 *  changeStatus (String)      → submissionNote
 *  noteCommander(String)      → meta.noteCommander
 *  responsibility([String])   → responsibility (join)
 *  levelOne     ([String])    → level1 (ערך ראשון)
 *  levelTwo     ([String])    → level2
 *  levelThree   ([String])    → level3
 *  levelFour    ([String])    → level4
 *  levelFive    ([String])    → level5  ← שדה שנוסף!
 *  spaceWork_DB (String)      → environmentId
 *  nameFiles    ([String])    → meta.nameFiles
 *
 *  s_w_names (ישן) → Environment (חדש)
 *  ───────────────────────────────────────
 *  name      → name
 *  userEmail → (adminId של הסביבה)
 * ══════════════════════════════════════════════════════
 */

require('dotenv').config();
const mongoose = require('mongoose');

/* ══════════════════════════════════════════════════════
   פרמטרים
══════════════════════════════════════════════════════ */
const args    = process.argv.slice(2);
const PREVIEW = args.includes('--preview') || !args.includes('--run');
const CLEAN   = args.includes('--clean');

const OLD_URI = process.env.OLD_MONGO_URI;
const NEW_URI = process.env.MONGO_URI;

if (!OLD_URI) {
  console.error('\n❌  חסר OLD_MONGO_URI ב-.env\n   הוסף: OLD_MONGO_URI=mongodb://localhost:27017/[שם-מסד-ישן]\n');
  process.exit(1);
}
if (!NEW_URI) {
  console.error('\n❌  חסר MONGO_URI ב-.env\n   הוסף: MONGO_URI=mongodb://localhost:27017/[שם-מסד-חדש]\n');
  process.exit(1);
}
if (OLD_URI === NEW_URI) {
  console.error('\n❌  OLD_MONGO_URI ו-MONGO_URI זהים! זה יכתוב על מסד הנתונים הישן!\n   ודא שמדובר בשני מסדות שונים.\n');
  process.exit(1);
}

/* ══════════════════════════════════════════════════════
   סכמות — מסד ישן (read-only, strict:false = קורא הכל)
══════════════════════════════════════════════════════ */
const OldUser = (conn) => conn.model('OldUser', new mongoose.Schema({
  username:    String,
  id:          String,      // מספר אישי / חוגר (= tagId החדש)
  userEmail:   String,
  role:        [String],
  access:      [String],
  level_1:     [String],
  level_2:     [String],
  level_3:     [String],
  level_4:     [String],
  newMissions: [String],
  spaceWork_DB:[String],
}, { strict: false }), 'users');

const OldSpaceWork = (conn) => conn.model('OldSpaceWork', new mongoose.Schema({
  name:      String,
  userEmail: String,
}, { strict: false }), 's_w_names');

const OldMission = (conn) => conn.model('OldMission', new mongoose.Schema({
  id:            [String],   // מערך טוקני / מזהי משתמשים
  title:         String,
  startedAt:     String,
  daysLeft:      String,
  details:       String,
  endedAt:       String,
  status:        String,
  missionId:     String,
  chat:          mongoose.Schema.Types.Mixed,  // אובייקט/מערך הודעות
  changeStatus:  String,
  noteCommander: String,
  levelOne:      [String],
  levelTwo:      [String],
  levelThree:    [String],
  levelFour:     [String],
  levelFive:     [String],
  spaceWork_DB:  String,
  statusMission: String,
  nameFiles:     [String],
  responsibility:[String],
}, { strict: false }), 'missions');

const OldArchive = (conn) => conn.model('OldArchive', new mongoose.Schema({
  id:            [String],
  title:         String,
  startedAt:     String,
  daysLeft:      String,
  details:       String,
  endedAt:       String,
  status:        String,
  missionId:     String,
  chat:          mongoose.Schema.Types.Mixed,
  changeStatus:  String,
  noteCommander: String,
  levelOne:      [String],
  levelTwo:      [String],
  levelThree:    [String],
  levelFour:     [String],
  levelFive:     [String],
  spaceWork_DB:  String,
  statusMission: String,
  nameFiles:     [String],
  responsibility:[String],
}, { strict: false }), 'missionsArchive');

const OldDaily = (conn) => conn.model('OldDaily', new mongoose.Schema({
  title:          String,
  startedAt:      String,
  details:        String,
  responsibility: [String],
  spaceWork_DB:   String,
  nameFiles:      [String],
}, { strict: false }), 'dailyMissions');

/* ══════════════════════════════════════════════════════
   מודלים — מסד חדש
══════════════════════════════════════════════════════ */
const NewUser    = require('./models/User');
const NewEnv     = require('./models/Environment');
const NewPerm    = require('./models/EnvironmentPermission');
const NewTask    = require('./models/Task');
const NewMsg     = require('./models/TaskMessage');

/* ══════════════════════════════════════════════════════
   עזרים
══════════════════════════════════════════════════════ */
function mapStatus(old) {
  if (!old) return 'pending';
  const s = old.toString().toLowerCase().trim();
  if (s.includes('הושלם') || s.includes('complet') || s.includes('done') || s.includes('approved')) return 'completed';
  if (s.includes('ממתין לאישור') || s.includes('waiting') || s.includes('submit'))                  return 'waiting_approval';
  if (s.includes('בתהליך') || s.includes('progress') || s.includes('active'))                       return 'in_progress';
  if (s.includes('חריג') || s.includes('overdue') || s.includes('late'))                            return 'overdue';
  return 'pending';
}

function safeDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function firstVal(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr[0] || '';
}

function joinVals(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.filter(Boolean).join(', ');
}

/**
 * מנסה לפרסר את שדה ה-chat הישן ולהחזיר מערך הודעות מנורמל.
 * המבנה הישן לא היה אחיד — מנסים כמה פורמטים.
 */
function parseChatMessages(chat) {
  if (!chat) return [];
  try {
    // מקרה 1: מערך ישיר
    if (Array.isArray(chat)) return chat;
    // מקרה 2: { messages: [...] }
    if (Array.isArray(chat.messages)) return chat.messages;
    // מקרה 3: { history: [...] }
    if (Array.isArray(chat.history)) return chat.history;
    // מקרה 4: אובייקט יחיד עם text
    if (chat.text) return [chat];
    return [];
  } catch {
    return [];
  }
}

/* ══════════════════════════════════════════════════════
   מיגרציית הודעות צ'אט ישנות → TaskMessage
══════════════════════════════════════════════════════ */
async function migrateChatMessages(nMsg, taskId, taskTitle, chat, senderFallbackId) {
  const msgs = parseChatMessages(chat);
  if (!msgs.length) return 0;

  let count = 0;
  for (const msg of msgs) {
    const text = msg.text || msg.message || msg.content || msg.body;
    if (!text) continue;

    const senderId   = senderFallbackId;
    const senderName = msg.senderName || msg.sender || msg.username || msg.name || 'משתמש';
    const createdAt  = safeDate(msg.date || msg.createdAt || msg.time) || new Date();

    const exists = await nMsg.findOne({ taskId, 'meta.oldText': text, createdAt });
    if (!exists) {
      await nMsg.create({
        taskId,
        sender:     senderId || new mongoose.Types.ObjectId(),
        senderName: typeof senderName === 'string' ? senderName : String(senderName),
        text:       String(text).slice(0, 2000),
        createdAt,
        meta:       { oldText: text, migratedFromChat: true },
      });
      count++;
    }
  }
  return count;
}

/* ══════════════════════════════════════════════════════
   פונקציית מיגרציה ראשית
══════════════════════════════════════════════════════ */
async function migrate() {
  console.log('\n══════════════════════════════════════');
  console.log(PREVIEW ? '👁  מצב PREVIEW — לא נכתב כלום' : '🚀  מצב RUN — מבצע מיגרציה');
  console.log('══════════════════════════════════════\n');

  // ── חיבורים ──
  const oldConn = await mongoose.createConnection(OLD_URI).asPromise();
  console.log('✅  מחובר למסד ישן:', OLD_URI);

  const newConn = mongoose.createConnection(NEW_URI);
  await newConn.asPromise();
  console.log('✅  מחובר למסד חדש:', NEW_URI, '\n');

  // ── מודלים ──
  const oUsers  = OldUser(oldConn);
  const oSpaces = OldSpaceWork(oldConn);
  const oMiss   = OldMission(oldConn);
  const oArch   = OldArchive(oldConn);
  const oDaily  = OldDaily(oldConn);

  const nUser = newConn.model('User',                  NewUser.schema);
  const nEnv  = newConn.model('Environment',           NewEnv.schema);
  const nPerm = newConn.model('EnvironmentPermission', NewPerm.schema);
  const nTask = newConn.model('Task',                  NewTask.schema);
  const nMsg  = newConn.model('TaskMessage',           NewMsg.schema);

  // ── נקה אם ביקשו ──
  if (!PREVIEW && CLEAN) {
    console.log('⚠️  מנקה קולקציות חדשות לפני מיגרציה...');
    await Promise.all([
      nUser.deleteMany({}),
      nEnv.deleteMany({}),
      nPerm.deleteMany({}),
      nTask.deleteMany({}),
      nMsg.deleteMany({}),
    ]);
    console.log('   ✓ ניקוי הושלם\n');
  }

  /* ────────────────────────────────────────────────────
     1. ENVIRONMENTS — מ-s_w_names
     ⚠️  adminId נקבע זמנית — יעודכן אחרי שלב 2 (users)
  ──────────────────────────────────────────────────── */
  console.log('─── שלב 1: סביבות (s_w_names) ───');
  const spaces = await oSpaces.find();
  console.log(`   נמצאו ${spaces.length} סביבות`);

  // מפה מאוחד: שם סביבה (s_w_names) → ObjectId בחדש
  const envMap        = {};   // name → new _id
  // מפה: userEmail של אחראי → שם סביבה (לשלב 2)
  const envOwnerEmail = {};   // envId.toString() → userEmail

  for (const sp of spaces) {
    console.log(`   • ${sp.name} (אחראי: ${sp.userEmail || '—'})`);
    if (!PREVIEW) {
      let env = await nEnv.findOne({ name: sp.name });
      if (!env) {
        // adminId זמני — יתעדכן אחרי שמשתמשים נוצרים
        env = await nEnv.create({
          name:        sp.name,
          description: '',
          adminId:     new mongoose.Types.ObjectId(),   // placeholder
          isActive:    true,
        });
      }
      envMap[sp.name]                   = env._id;
      if (sp.userEmail) envOwnerEmail[env._id.toString()] = sp.userEmail;
    }
  }

  /* ────────────────────────────────────────────────────
     2. USERS — מ-users
     מיפוי: id → tagId, username → name, role[] → role string
     userEmail נשמר ב-meta לגיבוי
  ──────────────────────────────────────────────────── */
  console.log('\n─── שלב 2: משתמשים ───');
  const oldUsers = await oUsers.find();
  console.log(`   נמצאו ${oldUsers.length} משתמשים`);

  const userMap    = {}; // מזהי ישן → new _id
  const emailToUid = {}; // userEmail  → new _id (לעדכון adminId בסביבות)

  for (const ou of oldUsers) {
    // זיהוי מנהל על: רק role שהוא בדיוק 'admin' או 'מנהל על'
    // (לא כולל 'manager' שהוא מנהל סביבה — לא מנהל על!)
    const isAdmin = ou.role?.some(r =>
      typeof r === 'string' && (
        r.trim() === 'admin' ||
        r.trim() === 'מנהל על' ||
        r.trim().toLowerCase() === 'superadmin'
      )
    );

    // tagId = השדה "id" הישן (מספר חוגר/אישי)
    const tagId   = (ou.id || '').trim() || ou.userEmail || ou.username || `migrate_${ou._id}`;
    const name    = (ou.username || '').trim() || tagId;

    // jobTitle — מהרכיב הראשון ב-role שאינו "admin"/"מנהל"
    const jobTitle = (ou.role || []).find(r =>
      typeof r === 'string' && !r.toLowerCase().includes('admin') && !r.includes('מנהל על')
    ) || '';

    console.log(`   • ${name} | tagId=${tagId} | ${isAdmin ? 'מנהל על' : 'commander'}`);

    if (!PREVIEW) {
      // מחפשים לפי tagId כדי לא לשכפל
      let nu = await nUser.findOne({ tagId });
      if (!nu) {
        nu = await nUser.create({
          tagId,
          name,
          username: tagId,
          role:     isAdmin ? 'admin' : 'commander',
          jobTitle,
          level1:   firstVal(ou.level_1),
          level2:   firstVal(ou.level_2),
          level3:   firstVal(ou.level_3),
          level4:   firstVal(ou.level_4),
          // level5 לא היה בסכימה הישנה — ריק כברירת מחדל
          isActive: true,
          meta: {
            userEmail:      ou.userEmail || '',
            oldAccess:      ou.access    || [],
            oldNewMissions: ou.newMissions || [],
            migratedAt:     new Date(),
          },
        });
      }

      // שמור ב-map לפי כל המזהים האפשריים
      if (ou.id)        userMap[ou.id]        = nu._id;
      if (ou.username)  userMap[ou.username]  = nu._id;
      if (ou.userEmail) userMap[ou.userEmail] = nu._id;
      userMap[String(ou._id)] = nu._id;
      if (ou.userEmail) emailToUid[ou.userEmail] = nu._id;

      // הרשאות סביבה — לפי spaceWork_DB
      if (ou.spaceWork_DB?.length) {
        for (const swName of ou.spaceWork_DB) {
          const envId = envMap[swName];
          if (!envId) continue;
          const permType = isAdmin ? 'manager' : 'viewer';
          await nPerm.findOneAndUpdate(
            { userId: nu._id, environmentId: envId },
            { type: permType, grantedBy: nu._id },
            { upsert: true, setDefaultsOnInsert: true }
          );
        }
      }
    }
  }

  /* ────────────────────────────────────────────────────
     2.5 עדכון adminId בסביבות — עכשיו כשיש משתמשים
     ה-s_w_names שמרנו userEmail של האחראי; נמצא אותו
     כמשתמש ונגדיר אותו כ-adminId של הסביבה.
  ──────────────────────────────────────────────────── */
  if (!PREVIEW) {
    console.log('\n─── שלב 2.5: קישור adminId לסביבות ───');
    const fallbackAdmin = await nUser.findOne({ role: 'admin' });
    for (const [envIdStr, ownerEmail] of Object.entries(envOwnerEmail)) {
      const ownerUid = emailToUid[ownerEmail] || fallbackAdmin?._id;
      if (ownerUid) {
        await nEnv.findByIdAndUpdate(envIdStr, { adminId: ownerUid });
        console.log(`   • עודכן adminId לסביבה ${envIdStr} → ${ownerEmail}`);
      }
    }
    // סביבות שלא נמצא להן אחראי → הגדר את מנהל-העל הראשון
    if (fallbackAdmin) {
      await nEnv.updateMany(
        { adminId: { $exists: false } },
        { adminId: fallbackAdmin._id }
      );
    }
  }

  /* ────────────────────────────────────────────────────
     3. TASKS — מ-missions (פעיל)
     • responsibility: join כל הערכים (לא רק ראשון)
     • levelFive → level5
     • endedAt → dueDate
     • chat → TaskMessage
     • כל המשתמשים ב-id[] → meta.allAssignees
  ──────────────────────────────────────────────────── */
  console.log('\n─── שלב 3: משימות פעילות (missions) ───');
  const missions = await oMiss.find();
  console.log(`   נמצאו ${missions.length} משימות`);

  let taskNum   = 1;
  let chatCount = 0;

  // ── בניית userMap הפוך לבדיקות preview: אוסף את כל המפתחות הידועים
  // (בrun הם כבר נבנו; בpreview נבנה מהנתונים הישנים ישירות)
  const previewUserKeys = new Set(Object.keys(userMap));
  if (PREVIEW) {
    for (const ou of oldUsers) {
      if (ou.id)        previewUserKeys.add(ou.id);
      if (ou.username)  previewUserKeys.add(ou.username);
      if (ou.userEmail) previewUserKeys.add(ou.userEmail);
      previewUserKeys.add(String(ou._id));
    }
  }

  let unresolved = []; // משימות שלא נמצא להן שיוך משתמש

  for (const m of missions) {
    const status     = mapStatus(m.status || m.statusMission);
    const envId      = PREVIEW ? null : envMap[m.spaceWork_DB];
    const rawIds     = m.id || [];

    // בדיקת שיוך: האם הטוקנים של המשימה מופיעים ב-userMap?
    const resolvedIds  = PREVIEW
      ? rawIds.filter(uid => previewUserKeys.has(uid))
      : rawIds.map(uid => userMap[uid]).filter(Boolean);
    const unresolvable = rawIds.filter(uid =>
      PREVIEW ? !previewUserKeys.has(uid) : !userMap[uid]
    );

    if (unresolvable.length) {
      unresolved.push({
        title:       m.title,
        env:         m.spaceWork_DB || '—',
        badTokens:   unresolvable,
      });
    }

    const allUserIds = resolvedIds;
    const assignedId = PREVIEW ? (allUserIds.length > 0 ? '(ימוצא)' : null) : (allUserIds[0] || null);

    const assignWarn = unresolvable.length ? ` ⚠️  לא נמצא משתמש (${unresolvable.join(', ')})` : '';
    console.log(`   • [${String(taskNum).padStart(3,'0')}] ${m.title} | ${m.spaceWork_DB || '—'} | ${status}${assignWarn}`);

    if (!PREVIEW && envId) {
      const oldKey = m.missionId || m._id.toString();
      let task = await nTask.findOne({ 'meta.oldMissionId': oldKey });
      if (!task) {
        task = await nTask.create({
          taskNumber:     taskNum,
          title:          m.title          || '—',
          description:    m.details        || '',
          environmentId:  envId,
          assignedTo:     assignedId,
          responsibility: joinVals(m.responsibility) || m.noteCommander || '',
          status,
          givenDate:      safeDate(m.startedAt),
          dueDate:        safeDate(m.endedAt),       // endedAt = תאריך יעד בפעיל
          level1:         firstVal(m.levelOne),
          level2:         firstVal(m.levelTwo),
          level3:         firstVal(m.levelThree),
          level4:         firstVal(m.levelFour),
          level5:         firstVal(m.levelFive),     // ← levelFive → level5
          submissionNote: m.changeStatus   || '',
          meta: {
            oldMissionId:   oldKey,
            oldStatus:      m.status || m.statusMission,
            oldDaysLeft:    m.daysLeft || '',
            noteCommander:  m.noteCommander || '',
            nameFiles:      m.nameFiles   || [],
            allAssignees:   m.id          || [],     // כל המשתמשים המקוריים
            migratedAt:     new Date(),
          },
        });
      }

      // מיגרציית הודעות צ'אט
      if (m.chat) {
        const n = await migrateChatMessages(nMsg, task._id, m.title, m.chat, assignedId);
        chatCount += n;
      }
    }
    taskNum++;
  }

  // ── דוח שיוך משתמשים לא פתורים ──
  if (unresolved.length) {
    console.log(`\n   ⚠️  ${unresolved.length} משימות ללא שיוך משתמש (assignedTo יהיה null):`);
    console.log('   הסיבה הסבירה: שדה id[] במשימה מכיל ערך שאינו קיים כ-id/username/email של אף משתמש.');
    console.log('   כל נתוני המשימה יועברו, רק השיוך יהיה ריק. ניתן לתקן ידנית אחרי מיגרציה.\n');
    for (const item of unresolved.slice(0, 20)) {
      console.log(`   ✗ "${item.title}" (${item.env}) ← טוקנים לא זוהו: [${item.badTokens.join(', ')}]`);
    }
    if (unresolved.length > 20) console.log(`   ... ועוד ${unresolved.length - 20} נוספות`);
  } else {
    console.log('   ✅  כל המשימות מצאו שיוך משתמש תקין');
  }

  /* ────────────────────────────────────────────────────
     4. TASKS — מ-missionsArchive
  ──────────────────────────────────────────────────── */
  console.log('\n─── שלב 4: ארכיון (missionsArchive) ───');
  const archives = await oArch.find();
  console.log(`   נמצאו ${archives.length} משימות בארכיון`);

  let unresolvedArc = [];

  for (const m of archives) {
    const envId      = PREVIEW ? null : envMap[m.spaceWork_DB];
    const rawIds     = m.id || [];
    const resolvedIds = PREVIEW
      ? rawIds.filter(uid => previewUserKeys.has(uid))
      : rawIds.map(uid => userMap[uid]).filter(Boolean);
    const unresolvable = rawIds.filter(uid =>
      PREVIEW ? !previewUserKeys.has(uid) : !userMap[uid]
    );
    if (unresolvable.length) unresolvedArc.push({ title: m.title, badTokens: unresolvable });

    const allUserIds = resolvedIds;
    const assignedId = PREVIEW ? (allUserIds.length > 0 ? '(ימוצא)' : null) : (allUserIds[0] || null);

    const assignWarn = unresolvable.length ? ` ⚠️  (${unresolvable.join(', ')})` : '';
    console.log(`   • [ARC] ${m.title} | ${m.spaceWork_DB || '—'}${assignWarn}`);

    if (!PREVIEW && envId) {
      const oldKey = 'ARC_' + (m.missionId || m._id.toString());
      let task = await nTask.findOne({ 'meta.oldMissionId': oldKey });
      if (!task) {
        task = await nTask.create({
          taskNumber:    taskNum++,
          title:         m.title    || '—',
          description:   m.details  || '',
          environmentId: envId,
          assignedTo:    assignedId,
          responsibility:joinVals(m.responsibility) || m.noteCommander || '',
          status:        'completed',
          givenDate:     safeDate(m.startedAt),
          dueDate:       safeDate(m.endedAt),
          resolvedAt:    safeDate(m.endedAt),
          level1:        firstVal(m.levelOne),
          level2:        firstVal(m.levelTwo),
          level3:        firstVal(m.levelThree),
          level4:        firstVal(m.levelFour),
          level5:        firstVal(m.levelFive),     // ← levelFive → level5
          submissionNote:m.changeStatus || '',
          meta: {
            oldMissionId:  oldKey,
            oldStatus:     m.status || m.statusMission,
            oldDaysLeft:   m.daysLeft || '',
            noteCommander: m.noteCommander || '',
            nameFiles:     m.nameFiles  || [],
            allAssignees:  m.id         || [],
            migratedAt:    new Date(),
          },
        });
      }

      if (m.chat) {
        const n = await migrateChatMessages(nMsg, task._id, m.title, m.chat, assignedId);
        chatCount += n;
      }
    }
  }

  if (unresolvedArc.length) {
    console.log(`\n   ⚠️  ${unresolvedArc.length} ארכיונים ללא שיוך משתמש`);
    for (const item of unresolvedArc.slice(0, 10))
      console.log(`   ✗ "${item.title}" ← [${item.badTokens.join(', ')}]`);
  } else {
    console.log('   ✅  כל הארכיונים מצאו שיוך משתמש תקין');
  }

  /* ────────────────────────────────────────────────────
     5. TASKS — מ-dailyMissions
  ──────────────────────────────────────────────────── */
  console.log('\n─── שלב 5: משימות יומיות (dailyMissions) ───');
  const dailies = await oDaily.find();
  console.log(`   נמצאו ${dailies.length} משימות יומיות`);

  for (const m of dailies) {
    const envId = PREVIEW ? null : envMap[m.spaceWork_DB];
    console.log(`   • [DAY] ${m.title} | ${m.spaceWork_DB || '—'}`);

    if (!PREVIEW && envId) {
      const oldKey = 'DAY_' + m._id.toString();
      const exists = await nTask.findOne({ 'meta.oldMissionId': oldKey });
      if (!exists) {
        await nTask.create({
          taskNumber:    taskNum++,
          title:         m.title    || '—',
          description:   m.details  || '',
          environmentId: envId,
          responsibility:joinVals(m.responsibility),
          status:        'pending',
          givenDate:     safeDate(m.startedAt),
          meta: {
            oldMissionId: oldKey,
            nameFiles:    m.nameFiles || [],
            isDaily:      true,
            migratedAt:   new Date(),
          },
        });
      }
    }
  }

  /* ── סיכום ── */
  console.log('\n══════════════════════════════════════');
  const totalUnresolved = unresolved.length + unresolvedArc.length;

  if (PREVIEW) {
    console.log('👁  PREVIEW הושלם — לא נכתב כלום');
    console.log(`
   סביבות:         ${spaces.length}
   משתמשים:        ${oldUsers.length}
   משימות פעילות:  ${missions.length}
   משימות ארכיון:  ${archives.length}
   משימות יומיות:  ${dailies.length}
`);
    if (totalUnresolved > 0) {
      console.log(`   ⚠️  ${totalUnresolved} משימות יאבדו את שיוך המשתמש (assignedTo=null)`);
      console.log('   ← ראה פירוט למעלה. כל שאר הנתונים יועברו תקין.');
      console.log('   ← ניתן לתקן ידנית אחרי מיגרציה דרך עמוד "ניהול משתמשים".');
    } else {
      console.log('   ✅  כל שיוכי המשתמש תקינים — מוכן להרצה!');
    }
    console.log('\n   להריץ מיגרציה אמיתית: node migrate.js --run');
  } else {
    const [uCount, eCount, tCount, mCount] = await Promise.all([
      nUser.countDocuments(), nEnv.countDocuments(), nTask.countDocuments(), nMsg.countDocuments(),
    ]);
    console.log('🎉  מיגרציה הושלמה!');
    console.log(`
   סביבות:          ${spaces.length}   →  ${eCount}  ב-DB
   משתמשים:         ${oldUsers.length}  →  ${uCount}  ב-DB
   משימות פעילות:   ${missions.length}
   משימות ארכיון:   ${archives.length}
   משימות יומיות:   ${dailies.length}
   סה"כ משימות:     ${tCount}  ב-DB
   הודעות צ'אט:     ${chatCount} הועברו ל-TaskMessage

   ✅  אין סיסמאות — אימות לפי חוגר (tagId) בלבד.
   ✅  userEmail שמור ב-meta של כל משתמש.
   ✅  allAssignees שמור ב-meta של כל משימה.
   ✅  levelFive → level5 הועתק לשדה Task.
    `);
  }
  console.log('══════════════════════════════════════\n');

  await oldConn.close();
  await newConn.close();
  process.exit(0);
}

migrate().catch(err => {
  console.error('\n❌  שגיאה במיגרציה:', err.message, err.stack);
  process.exit(1);
});
