const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  short_name: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '🏷️'
  },
  color: {
    type: String,
    default: '#8B5CF6'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

module.exports = mongoose.model('Department', DepartmentSchema);
