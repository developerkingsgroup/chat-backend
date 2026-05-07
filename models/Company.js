const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  tagline: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: '🏢'
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  created_by: {
    type: String,
    ref: 'User' // Assuming a User model will be created
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, { _id: false }); // Disable Mongoose's default _id

module.exports = mongoose.model('Company', CompanySchema);
