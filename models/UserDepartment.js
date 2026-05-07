const mongoose = require('mongoose');

const UserDepartmentSchema = new mongoose.Schema({
  user_id: {
    type: String,
    ref: 'User',
    required: true
  },
  department_id: {
    type: String,
    ref: 'Department',
    required: true
  }
}, { _id: false });

UserDepartmentSchema.index({ user_id: 1, department_id: 1 }, { unique: true });

module.exports = mongoose.model('UserDepartment', UserDepartmentSchema);
