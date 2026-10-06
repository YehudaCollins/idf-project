const { connectDb } = require('../config/db');
const { User, OrgUnit, UserOrgHistory, AiDecisionLog, OrgChangeRequest, RawIngestEvent, } = require('../models/index');
const { seedBaseOrgTree } = require('./baseOrgTree');
async function seed() {
    await connectDb();
    console.log('מנקה אוספים...');
    await Promise.all([
        User.deleteMany({}),
        OrgUnit.deleteMany({}),
        UserOrgHistory.deleteMany({}),
        AiDecisionLog.deleteMany({}),
        OrgChangeRequest.deleteMany({}),
        RawIngestEvent.deleteMany({}),
    ]);
    console.log('יוצר עץ ארגוני בסיס...');
    const result = await seedBaseOrgTree();
    console.log('');
    console.log('✓ Seed הושלם');
    console.log(`  יחידות ארגון: ${result.unitCount}`);
    console.log(`  משתמשים:       ${result.userCount}`);
    console.log(`  שורש:          ${result.rootPath}`);
    console.log('');
    console.log('הרץ npm run dev והיכנס לתרשים ארגוני.');
    process.exit(0);
}
seed().catch((e) => {
    console.error(e);
    process.exit(1);
});
