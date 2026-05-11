const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  chat_id: {
    type: String,
    required: true
  },
  chat_type: {
    type: String,
    required: true,
    default: 'group'
  },
  sender_id: {
    type: String,
    ref: 'UserProfile',
    required: true
  },
  type: {
    type: String,
    required: true,
    default: 'text'
  },
  content: {
    type: String
  },
  file_url: {
    type: String
  },
  file_name: {
    type: String
  },
  file_size: {
    type: String
  },
  duration: {
    type: Number
  },
  is_read: {
    type: Boolean,
    default: false
  },
  is_deleted: {
    type: Boolean,
    default: false
  },
  is_edited: {
    type: Boolean,
    default: false
  },
  edited_at: {
    type: Date,
    default: null
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

module.exports = mongoose.model('Message', MessageSchema);
