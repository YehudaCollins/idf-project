const mongoose = require('mongoose');

/**
 * הודעות צ׳אט לכל הנחיה — בין מנהל למפקד
 */
const taskMessageSchema = new mongoose.Schema({
  taskId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
  sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  text:      { type: String, required: true, trim: true, maxlength: 2000 },
  /** מערך של userId שקראו את ההודעה (לא כולל השולח) */
  readBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

taskMessageSchema.index({ taskId: 1, createdAt: 1 });

module.exports = mongoose.model('TaskMessage', taskMessageSchema);
