const mongoose = require('mongoose');

/**
 * EnvironmentPermission — הרשאה של משתמש לסביבה ספציפית
 *
 * type: 'manager' = מנהל הסביבה (יכול לנהל משימות + להוסיף מפקדים)
 * type: 'viewer'  = מפקד (צופה + מגיש עדכונים על משימות שלו)
 */
const environmentPermissionSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',        required: true },
  environmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Environment', required: true },
  type:          { type: String, enum: ['manager', 'viewer'], required: true },
  grantedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',        default: null },
}, { timestamps: true });

// משתמש יכול להיות רק פעם אחת לאותה סביבה
environmentPermissionSchema.index({ userId: 1, environmentId: 1 }, { unique: true });

module.exports = mongoose.model('EnvironmentPermission', environmentPermissionSchema);
