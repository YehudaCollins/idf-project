const mongoose = require('mongoose');
const { Schema } = mongoose;
const PatternPromotionSchema = new Schema({
    parentKey: { type: String, required: true, index: true },
    rawNormalized: { type: String, required: true },
    unitId: { type: Schema.Types.ObjectId, ref: 'OrgUnit', required: true },
    count: { type: Number, default: 1 },
    updatedAt: { type: Date, default: Date.now },
});
PatternPromotionSchema.index({ parentKey: 1, rawNormalized: 1, unitId: 1 }, { unique: true });
const PatternPromotion = mongoose.model('PatternPromotion', PatternPromotionSchema);

module.exports = { PatternPromotion };
