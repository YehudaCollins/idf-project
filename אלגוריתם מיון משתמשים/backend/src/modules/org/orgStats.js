const { User, OrgUnit } = require('../../models/index');
function uniqueIds(ids) {
    const seen = new Set();
    return ids.filter((id) => {
        const key = String(id);
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
/** מחשב מחדש userCount — רק משתמשים שמשויכים פיזית ליחידה (לא דרך ילדים) */
async function recalcUserCountsForUnits(unitIds) {
    for (const id of uniqueIds(unitIds)) {
        const count = await User.countDocuments({ currentOrgUnitId: id });
        await OrgUnit.findByIdAndUpdate(id, { 'stats.userCount': count });
    }
}
/** מחשב מחדש userCount לכל היחידות במערכת */
async function recalcAllUserCounts() {
    await OrgUnit.updateMany({}, { 'stats.userCount': 0 });
    const counts = await User.aggregate([
        { $match: { currentOrgUnitId: { $exists: true, $ne: null } } },
        { $group: { _id: '$currentOrgUnitId', count: { $sum: 1 } } },
    ]);
    await Promise.all(counts.map(({ _id, count }) => OrgUnit.findByIdAndUpdate(_id, { 'stats.userCount': count })));
}
/** אחרי מעבר משתמש — מעדכן counts גם בנתיב הישן וגם בחדש */
async function syncStatsAfterUserMove(oldPathIds, newPathIds) {
    await recalcUserCountsForUnits([...oldPathIds, ...newPathIds]);
}
/** מגדיל loginCount על כל יחידה בנתיב (root→leaf) */
async function incrementLoginStats(pathIds) {
    const ids = uniqueIds(pathIds);
    if (!ids.length)
        return;
    await OrgUnit.updateMany({ _id: { $in: ids } }, { $inc: { 'stats.loginCount': 1 } });
}

module.exports = { recalcUserCountsForUnits, recalcAllUserCounts, syncStatsAfterUserMove, incrementLoginStats };
