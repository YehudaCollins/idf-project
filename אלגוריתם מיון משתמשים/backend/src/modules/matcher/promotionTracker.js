const mongoose = require('mongoose');
const { PatternPromotion } = require('../../models/PatternPromotion');
async function trackPromotion(parentKey, rawNorm, unitId) {
    const oid = new mongoose.Types.ObjectId(unitId);
    const existing = await PatternPromotion.findOne({
        parentKey,
        rawNormalized: rawNorm,
        unitId: oid,
    });
    if (existing) {
        existing.count += 1;
        existing.updatedAt = new Date();
        await existing.save();
        return existing.count;
    }
    await PatternPromotion.create({
        parentKey,
        rawNormalized: rawNorm,
        unitId: oid,
        count: 1,
        updatedAt: new Date(),
    });
    return 1;
}
async function getPromotionCount(parentKey, rawNorm, unitId) {
    const doc = await PatternPromotion.findOne({
        parentKey,
        rawNormalized: rawNorm,
        unitId: new mongoose.Types.ObjectId(unitId),
    });
    return doc?.count ?? 0;
}

module.exports = { trackPromotion, getPromotionCount };
