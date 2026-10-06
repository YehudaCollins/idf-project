const mongoose = require('mongoose');
const { Schema } = mongoose;
const OrgChangeRequestSchema = new Schema({
    changeType: { type: String, required: true },
    targetUnitId: { type: Schema.Types.ObjectId, ref: 'OrgUnit' },
    targetCanonicalName: { type: String },
    proposedType: { type: String },
    proposedAlias: { type: String },
    proposedBy: { type: String },
    status: { type: String, enum: ['needs_review', 'approved', 'rejected'], default: 'needs_review' },
    reason: { type: String, default: '' },
    conflict: { type: Schema.Types.Mixed },
    commanderChange: { type: Schema.Types.Mixed },
    rawValue: { type: String },
    parentId: { type: Schema.Types.ObjectId, ref: 'OrgUnit' },
    confidence: { type: Number },
    affectedUsersCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewedBy: { type: String },
    reviewNote: { type: String },
    selectedUnitId: { type: Schema.Types.ObjectId, ref: 'OrgUnit' },
});
const OrgChangeRequest = mongoose.model('OrgChangeRequest', OrgChangeRequestSchema);

module.exports = { OrgChangeRequest };
