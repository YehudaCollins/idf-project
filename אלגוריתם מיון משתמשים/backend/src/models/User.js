const mongoose = require('mongoose');
const { Schema } = mongoose;
const UserSchema = new Schema({
    personalNumber: { type: String, required: true, unique: true, index: true },
    accessRole: { type: String, enum: ['admin', 'regular'], default: 'regular', index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    fullName: { type: String, required: true },
    rank: { type: String },
    role: { type: String },
    email: { type: String, index: true, sparse: true },
    phone: { type: String },
    profileImageUrl: { type: String },
    sourceSystem: { type: String, index: true },
    registeredSourceSystem: { type: String, index: true },
    sourceSystems: [{ type: String, index: true }],
    attributes: { type: Schema.Types.Mixed, default: {} },
    currentOrgUnitId: { type: Schema.Types.ObjectId, ref: 'OrgUnit' },
    currentOrgPathIds: [{ type: Schema.Types.ObjectId, ref: 'OrgUnit' }],
    currentOrgPathText: { type: String, default: '' },
    rawPaths: [{ type: String }],
    knownNames: [{ type: String }],
    sources: [{ type: String }],
    loginCount: { type: Number, default: 0 },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });
UserSchema.index({ fullName: 'text', currentOrgPathText: 'text' });
UserSchema.index({ sourceSystem: 1, lastSeenAt: -1 });
UserSchema.index({ registeredSourceSystem: 1, firstSeenAt: -1 });
const User = mongoose.model('User', UserSchema);

module.exports = { User };
