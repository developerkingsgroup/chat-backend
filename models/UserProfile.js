const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
  _id:    { type: String, required: true },
  name:   { type: String, default: '' },
  avatar: { type: String, default: '👤' },
  color:  { type: String, default: '#60A5FA' },
  role:   { type: String, default: 'User' },
});

module.exports = mongoose.model('UserProfile', UserProfileSchema);
