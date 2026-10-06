const mongoose = require('mongoose');

/**
 * Project — "תיקיית פרויקט" המקבצת מספר משימות (Tasks) תחת סביבה.
 *
 * מבנה היררכי:
 *   Environment → Project → Task
 *
 * • שם פרויקט (חובה) + תיאור (אופציונלי)
 * • givenDate — תאריך מתן משותף לכל המשימות בפרויקט
 * • status — active / archived
 * • projectNumber — מספר רץ אוטומטי בתוך הסביבה
 */
const projectSchema = new mongoose.Schema({
  projectNumber: { type: Number },
  name:          { type: String, required: true, trim: true },
  description:   { type: String, default: '' },
  environmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Environment', required: true, index: true },
  givenDate:     { type: Date, default: Date.now },

  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  meta:      { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

projectSchema.pre('save', async function () {
  if (this.isNew && !this.projectNumber) {
    const count = await this.constructor.countDocuments({ environmentId: this.environmentId });
    this.projectNumber = count + 1;
  }
});

module.exports = mongoose.model('Project', projectSchema);
