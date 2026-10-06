const { OrgUnit, User } = require('../../models/index');
async function refreshUnitPathTextsAndUsers(rootId) {
    const affectedUnits = await OrgUnit.find({
        $or: [{ _id: rootId }, { pathIds: rootId }],
    }).lean();
    if (!affectedUnits.length)
        return;
    const affectedIds = affectedUnits.map((unit) => unit._id);
    const allPathIds = Array.from(new Set(affectedUnits.flatMap((unit) => [...unit.pathIds.map(String), String(unit._id)])));
    const pathUnits = await OrgUnit.find({ _id: { $in: allPathIds } }).lean();
    const names = new Map(pathUnits.map((unit) => [String(unit._id), unit.canonicalName]));
    const unitUpdates = affectedUnits.map((unit) => {
        const fullPathIds = [...unit.pathIds.map(String), String(unit._id)];
        const pathText = fullPathIds.map((id) => names.get(id) ?? '?').join('/');
        return OrgUnit.updateOne({ _id: unit._id }, { $set: { pathText } });
    });
    await Promise.all(unitUpdates);
    const refreshedUnits = await OrgUnit.find({ _id: { $in: affectedIds } }).select('_id pathText').lean();
    const pathTextByUnitId = new Map(refreshedUnits.map((unit) => [String(unit._id), unit.pathText]));
    const userUpdates = refreshedUnits.map((unit) => User.updateMany({ currentOrgUnitId: unit._id }, { $set: { currentOrgPathText: pathTextByUnitId.get(String(unit._id)) ?? unit.pathText } }));
    await Promise.all(userUpdates);
}

module.exports = { refreshUnitPathTextsAndUsers };
