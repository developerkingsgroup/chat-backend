const mongoose = require('mongoose');

const CallLogSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  caller_id: {
    type: String,
    ref: 'UserProfile',
    required: true
  },
  callee_id: {
    type: String,
    ref: 'UserProfile',
    required: true
  },
  type: {
    type: String,
    default: 'voice'
  },
  direction: {
    type: String,
    default: 'outgoing'
  },
  duration: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    default: 'completed'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

module.exports = mongoose.model('CallLog', CallLogSchema);
