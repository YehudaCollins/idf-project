const mongoose = require('mongoose');

/** התראות in-app למשתמש — לחיצה מנווטת ל־href */
const notificationSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  environmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Environment', default: null },
  taskId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  type: {
    type: String,
    required: true,
    enum: [
      'task_submitted',
      'task_approved',
      'task_rejected',
      'task_reminder',
      'task_assigned',
      'permission_granted',
      'permission_request',
      'permission_request_approved',
      'permission_request_rejected',
    ],
  },
  title:   { type: String, required: true, trim: true },
  body:    { type: String, default: '' },
  /** נתיב מלא לניווט בצד הלקוח, כולל query */
  href:    { type: String, required: true },
  read:    { type: Boolean, default: false, index: true },
  readAt:  { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
