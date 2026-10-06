const mongoose = require('mongoose');
const { Schema } = mongoose;
const AliasSchema = new Schema({
    value: { type: String, required: true },
    normalizedValue: { type: String, required: true },
    confidence: { type: Number, default: 0.8 },
    seenCount: { type: Number, default: 1 },
    scope: { type: String, default: 'parent' },
    source: { type: String, default: 'auto' },
    status: { type: String, enum: ['active', 'pending', 'rejected'], default: 'active' },
}, { _id: false });
const OrgUnitSchema = new Schema({
    canonicalName: { type: String, required: true },
    normalizedName: { type: String, required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'OrgUnit', index: true },
    pathIds: [{ type: Schema.Types.ObjectId, ref: 'OrgUnit' }],
    pathText: { type: String, default: '' },
    level: { type: Number, default: 0 },
    type: { type: String, default: 'unknown' },
    aliases: [AliasSchema],
    commanderPersonalNumber: { type: String, index: true },
    pendingCommanderPersonalNumber: { type: String, index: true },
    commanderStatus: { type: String, enum: ['auto', 'pending_review', 'approved'], default: 'auto' },
    commanderReviewedAt: { type: Date },
    isVerified: { type: Boolean, default: false },
    verificationStatus: { type: String, default: 'unverified' },
    stats: {
        userCount: { type: Number, default: 0 },
        aliasCount: { type: Number, default: 0 },
        loginCount: { type: Number, default: 0 },
    },
}, { timestamps: true });
OrgUnitSchema.index({ parentId: 1, normalizedName: 1 });
const OrgUnit = mongoose.model('OrgUnit', OrgUnitSchema);

module.exports = { OrgUnit };
