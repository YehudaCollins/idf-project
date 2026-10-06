const mongoose = require('mongoose');

/**
 * User
 *
 * אימות: לפי tagId (מספר חוגר) — אין סיסמה.
 * כשמשתמש מחבר את החוגר, השרת מחפש לפי tagId
 * ומחזיר JWT אם נמצא.
 *
 * role:
 *   'admin'     = מנהל על — גישה לכל המערכת
 *   'commander' = מפקד / משתמש רגיל — גישה לפי EnvironmentPermission
 */
const userSchema = new mongoose.Schema({
  tagId:    { type: String, required: true, unique: true, trim: true }, // מספר חוגר
  name:     { type: String, required: true, trim: true },
  username: { type: String, trim: true, default: '' },   // שם משתמש נוסף (אופציונלי)
  role:     { type: String, enum: ['admin', 'commander'], default: 'commander' },

  // שדות פרופיל
  jobTitle: { type: String, default: '' },
  rank:     { type: String, default: '' },
  militaryRole: { type: String, default: '' },
  email:    { type: String, trim: true, default: '', index: true, sparse: true },
  phone:    { type: String, trim: true, default: '' },
  profileImageUrl: { type: String, trim: true, default: '' },
  sourceSystem: { type: String, trim: true, default: '' },
  registeredVia: { type: String, trim: true, default: '' },
  sourceSystems: [{ type: String, trim: true }],
  managerTagId: { type: String, trim: true, default: '' },
  unitreeOrgPathText: { type: String, default: '' },
  unitreeOrgPathIds: [{ type: String }],
  knownNames: [{ type: String }],
  rawOrgPaths: [{ type: String }],
  level1:   { type: String, default: '' },
  level2:   { type: String, default: '' },
  level3:   { type: String, default: '' },
  level4:   { type: String, default: '' },
  level5:   { type: String, default: '' },
  isActive: { type: Boolean, default: true },

  // שדה גיבוי מיגרציה — userEmail ישן + שדות נוספים שלא היו בסכימה החדשה
  meta: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
