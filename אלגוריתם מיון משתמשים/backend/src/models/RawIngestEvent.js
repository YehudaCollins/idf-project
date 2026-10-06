const mongoose = require('mongoose');
const { Schema } = mongoose;
const RawIngestEventSchema = new Schema({
    personalNumber: { type: String, required: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    profileImageUrl: { type: String },
    rawOrgPath: { type: String, required: true },
    source: { type: String, default: 'demo' },
    sourceSystem: { type: String, index: true },
    parsedResult: { type: Schema.Types.Mixed },
    finalResult: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
});
RawIngestEventSchema.index({ sourceSystem: 1, createdAt: -1 });
RawIngestEventSchema.index({ source: 1, createdAt: -1 });
const RawIngestEvent = mongoose.model('RawIngestEvent', RawIngestEventSchema);

module.exports = { RawIngestEvent };
