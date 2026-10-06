const mongoose = require('mongoose');

/**
 * template — תבנית טבלת ההנחיות של הסביבה
 *
 * responsibilityLevels: כמה רמות אחריות (1-5)
 *   - 5 = שימוש ב-level1..level5
 *   - 4 = שימוש ב-level1..level4
 *   - 3 = שימוש ב-level1..level3
 *   - 2 = שימוש ב-level1..level2
 *   - 1 = שימוש ב-level1 בלבד
 *
 * customColumns: עמודות מותאמות שהמנהל מוסיף
 *   [{ id, label }]  label = שם העמודה (לדוגמא "משתתפים בדיון")
 */
const environmentSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  adminId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive:    { type: Boolean, default: true },
  /**
   * visibility — האם הסביבה גלויה בחיפוש לבקשת גישה:
   *   public  — מופיעה בחיפוש לכל משתמש; ניתן לבקש גישה
   *   private — לא מופיעה בחיפוש; ניתן להצטרף רק בהזמנה ישירה של מנהל
   */
  visibility:  { type: String, enum: ['public', 'private'], default: 'public', index: true },

  template: {
    responsibilityLevels: { type: Number, default: 4, min: 1, max: 5 },
    customColumns: [{
      id:    { type: String, required: true },
      label: { type: String, required: true },
    }],
    /** הגדרות מתן הנחיות */
    defaultDueDays:      { type: Number, default: 14, min: 1 },   // ברירת מחדל תג"ב (ימים)
    overdueThresholdDays:{ type: Number, default: 0 },            // כמה ימים אחרי תג"ב = חריגה (0=מיידי)
    autoReminderDays:    { type: Number, default: 3, min: 0 },    // תזכורת X ימים לפני תג"ב (0=כבוי)
  },
}, { timestamps: true });

module.exports = mongoose.model('Environment', environmentSchema);
