const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  company_id: {
    type: String,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  city: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: '🌿'
  },
  color: {
    type: String,
    default: '#10B981'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

module.exports = mongoose.model('Branch', BranchSchema);
