const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  note: {
    type: String,
    default: ''
  },
  due_date: {
    type: Date
  },
  priority: {
    type: String,
    default: 'medium'
  },
  status: {
    type: String,
    default: 'pending'
  },
  for_user_id: {
    type: String,
    ref: 'User',
    required: true
  },
  created_by: {
    type: String,
    ref: 'User',
    required: true
  },
  reviewed_by: {
    type: String,
    ref: 'User'
  },
  reviewed_at: {
    type: Date
  },
  rejection_reason: {
    type: String,
    default: ''
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

module.exports = mongoose.model('Reminder', ReminderSchema);
