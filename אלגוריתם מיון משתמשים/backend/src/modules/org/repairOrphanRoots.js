const { OrgUnit } = require('../../models/index');
const { recalcUserCountsForUnits } = require('./orgStats');
function countDescendants(unitId, all) {
    const id = String(unitId);
    const children = all.filter((u) => u.parentId && String(u.parentId) === id);
    return children.reduce((sum, c) => sum + 1 + countDescendants(c._id, all), 0);
}
/** מחבר שורשים יתומים לשורש הראשי במסד הנתונים */
async function repairOrphanRoots() {
    const units = await OrgUnit.find().lean();
    const roots = units.filter((u) => !u.parentId);
    if (roots.length <= 1) {
        return { repaired: 0, primaryRoot: roots[0]?.canonicalName ?? null };
    }
    const ranked = [...roots].sort((a, b) => {
        const score = (u) => countDescendants(u._id, units) +
            (u.isVerified ? 10_000 : 0) +
            (u.canonicalName.includes('(דמו)') ? 5_000 : 0);
        return score(b) - score(a);
    });
    const [primary, ...orphans] = ranked;
    const primaryId = primary._id;
    const affectedIds = [primaryId];
    for (const orphan of orphans) {
        const orphanId = orphan._id;
        await OrgUnit.findByIdAndUpdate(orphanId, {
            parentId: primaryId,
            level: (primary.level ?? 0) + 1,
            pathIds: [primaryId],
            pathText: `${primary.pathText}/${orphan.canonicalName}`,
        });
        affectedIds.push(orphanId);
        // עדכון צאצאים — pathIds ו-pathText
        await recascadePaths(orphanId, primary);
    }
    await recalcUserCountsForUnits(affectedIds);
    return { repaired: orphans.length, primaryRoot: primary.canonicalName };
}
async function recascadePaths(rootId, primaryRoot) {
    const children = await OrgUnit.find({ parentId: rootId });
    const orphan = await OrgUnit.findById(rootId);
    if (!orphan)
        return;
    for (const child of children) {
        const pathIds = [...orphan.pathIds, orphan._id];
        const pathText = `${orphan.pathText}/${child.canonicalName}`;
        await OrgUnit.findByIdAndUpdate(child._id, {
            pathIds,
            pathText,
            level: orphan.level + 1,
        });
        await recascadePaths(child._id, primaryRoot);
    }
}

module.exports = { repairOrphanRoots };
