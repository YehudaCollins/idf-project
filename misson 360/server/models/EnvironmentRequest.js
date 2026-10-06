const mongoose = require('mongoose');

/**
 * EnvironmentRequest — בקשת גישה של משתמש לסביבה
 *
 * Workflow:
 *   pending  → המבקש שלח, מנהלי הסביבה מקבלים התראה ויכולים לאשר/לדחות
 *   approved → נוצרה EnvPerm בהתאם ל-requestType; המבקש קיבל התראה
 *   rejected → נדחה ע"י מנהל; המבקש קיבל התראה עם הערה
 */
const environmentRequestSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  environmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Environment', required: true, index: true },
  requestType:   { type: String, enum: ['manager', 'viewer'], required: true },
  note:          { type: String, default: '', maxlength: 600 },

  status:        { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  decidedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt:     { type: Date, default: null },
  decisionNote:  { type: String, default: '', maxlength: 600 },
}, { timestamps: true });

// מניעת כפילויות: בקשה אחת ממתינה בלבד לכל (משתמש, סביבה)
environmentRequestSchema.index(
  { userId: 1, environmentId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

module.exports = mongoose.model('EnvironmentRequest', environmentRequestSchema);
