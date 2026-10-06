const mongoose = require('mongoose');
const { Schema } = mongoose;
const AiDecisionLogSchema = new Schema({
    decisionType: { type: String, required: true },
    rawValue: { type: String, required: true },
    normalizedRawValue: { type: String, required: true },
    matchedUnitId: { type: Schema.Types.ObjectId, ref: 'OrgUnit' },
    matchedCanonicalName: { type: String },
    parentId: { type: Schema.Types.ObjectId, ref: 'OrgUnit' },
    confidence: { type: Number, default: 0 },
    action: { type: String, required: true },
    reason: { type: String, default: '' },
    signals: { type: Schema.Types.Mixed, default: {} },
    source: { type: String, default: 'mock-ai' },
    personalNumber: { type: String },
    modelVersion: { type: String },
    createdAt: { type: Date, default: Date.now },
});
const AiDecisionLog = mongoose.model('AiDecisionLog', AiDecisionLogSchema);

module.exports = { AiDecisionLog };
