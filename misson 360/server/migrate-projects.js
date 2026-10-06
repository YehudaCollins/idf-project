/**
 * migrate-projects.js
 *
 * שדרוג מבנה: יוצר Project ברירת מחדל בכל סביבה ומצרף אליו את כל המשימות
 * הקיימות (משימות ללא projectId).
 *
 * הפעלה:
 *   node migrate-projects.js
 *
 * בטוח להרצה חוזרת — מדלג על משימות שכבר שויכו.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Environment = require('./models/Environment');
const Project = require('./models/Project');
const Task = require('./models/Task');

const DEFAULT_NAME = 'הנחיות כלליות';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');

  const envs = await Environment.find();
  console.log(`📁 found ${envs.length} environments`);

  for (const env of envs) {
    const orphanCount = await Task.countDocuments({
      environmentId: env._id,
      $or: [{ projectId: null }, { projectId: { $exists: false } }],
    });

    if (orphanCount === 0) {
      console.log(`   • ${env.name}: אין משימות יתומות — דילוג`);
      continue;
    }

    let project = await Project.findOne({ environmentId: env._id, name: DEFAULT_NAME });
    if (!project) {
      const earliest = await Task.findOne({ environmentId: env._id }).sort({ givenDate: 1 }).select('givenDate');
      project = await Project.create({
        name: DEFAULT_NAME,
        description: 'פרויקט ברירת מחדל למשימות קיימות',
        environmentId: env._id,
        givenDate: earliest?.givenDate || new Date(),
      });
      console.log(`   ✅ ${env.name}: פרויקט נוצר`);
    }

    const result = await Task.updateMany(
      {
        environmentId: env._id,
        $or: [{ projectId: null }, { projectId: { $exists: false } }],
      },
      { $set: { projectId: project._id } },
    );
    console.log(`   ✅ ${env.name}: ${result.modifiedCount} משימות שויכו לפרויקט`);
  }

  console.log('\n🎉 migration complete');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
