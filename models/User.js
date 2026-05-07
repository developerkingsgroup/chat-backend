const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password_hash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'User'
  },
  avatar: {
    type: String,
    default: '👤'
  },
  color: {
    type: String,
    default: '#60A5FA'
  },
  is_super_admin: {
    type: Boolean,
    default: false
  },
  is_active: {
    type: Boolean,
    default: true
  },
  last_seen: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

module.exports = mongoose.model('User', UserSchema);
