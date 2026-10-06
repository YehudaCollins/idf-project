const mongoose = require('mongoose');

const historyEntrySchema = new mongoose.Schema({
  action:    { type: String },  // submitted | approved | rejected | reminder
  by:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  byName:    { type: String },
  note:      { type: String, default: '' },
  at:        { type: Date, default: Date.now },
}, { _id: false });

const taskSchema = new mongoose.Schema({
  taskNumber:     { type: Number },
  title:          { type: String, required: true, trim: true },
  description:    { type: String, default: '' },
  environmentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Environment', required: true, index: true },
  projectId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  assignedTo:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // אם ההנחיה נוצרה כחלק מהקצאה למספר אנשים — כל ה"אחים" חולקים אותו taskGroupId
  taskGroupId:    { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  responsibility: { type: String, default: '' },

  status: {
    type: String,
    enum: ['pending', 'in_progress', 'waiting_approval', 'completed', 'overdue', 'rejected'],
    default: 'pending',
  },

  givenDate:  { type: Date, default: Date.now },
  dueDate:    { type: Date, default: null },

  // רמות — קריטריוני מיון (למי מיועדת ההנחיה)
  level1: { type: String, default: '' },
  level2: { type: String, default: '' },
  level3: { type: String, default: '' },
  level4: { type: String, default: '' },
  level5: { type: String, default: '' },

  // תפקיד מיועד (אופציונלי) — "תוכניתן", "מפקד צוות" וכו'
  targetRole: { type: String, default: '' },

  submissionNote: { type: String, default: '' },  // הערת המפקד בהגשה
  submittedAt:    { type: Date, default: null },

  rejectionNote:  { type: String, default: '' },  // סיבת הסירוב מהמנהל
  resolvedAt:     { type: Date, default: null },
  approvedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  lastReminderAt: { type: Date, default: null },

  history: [historyEntrySchema],  // לוג פעולות

  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  customFields: { type: Map, of: String, default: {} }, // עמודות מותאמות { columnId: value }
  meta:         { type: mongoose.Schema.Types.Mixed, default: null },

  attachments: [{
    filename:     { type: String },
    originalName: { type: String },
    size:         { type: Number },
    mimeType:     { type: String },
    uploadedAt:   { type: Date, default: Date.now },
  }],
}, { timestamps: true });

taskSchema.pre('save', async function () {
  if (this.isNew && !this.taskNumber) {
    const filter = this.projectId
      ? { projectId: this.projectId }
      : { environmentId: this.environmentId };
    const count = await this.constructor.countDocuments(filter);
    this.taskNumber = count + 1;
  }
});

module.exports = mongoose.model('Task', taskSchema);
