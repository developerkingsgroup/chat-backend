const mongoose = require('mongoose');

const ChatGroupSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  branch_id: {
    type: String,
    ref: 'Branch',
    required: true
  },
  department_id: {
    type: String,
    ref: 'Department',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

ChatGroupSchema.index({ branch_id: 1, department_id: 1 }, { unique: true });

module.exports = mongoose.model('ChatGroup', ChatGroupSchema);
