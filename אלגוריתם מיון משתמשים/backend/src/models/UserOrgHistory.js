const mongoose = require('mongoose');
const { Schema } = mongoose;
const UserOrgHistorySchema = new Schema({
    personalNumber: { type: String, required: true, index: true },
    fromOrgUnitId: { type: Schema.Types.ObjectId, ref: 'OrgUnit' },
    toOrgUnitId: { type: Schema.Types.ObjectId, ref: 'OrgUnit' },
    fromPathIds: [{ type: Schema.Types.ObjectId, ref: 'OrgUnit' }],
    toPathIds: [{ type: Schema.Types.ObjectId, ref: 'OrgUnit' }],
    rawPath: { type: String, required: true },
    changeSource: { type: String, default: 'ingest' },
    sourceSystem: { type: String, index: true },
    confidence: { type: Number, default: 1 },
    changedAt: { type: Date, default: Date.now },
});
UserOrgHistorySchema.index({ sourceSystem: 1, changedAt: -1 });
const UserOrgHistory = mongoose.model('UserOrgHistory', UserOrgHistorySchema);

module.exports = { UserOrgHistory };
