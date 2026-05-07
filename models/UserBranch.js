const mongoose = require('mongoose');

const UserBranchSchema = new mongoose.Schema({
  user_id: {
    type: String,
    ref: 'User',
    required: true
  },
  branch_id: {
    type: String,
    ref: 'Branch',
    required: true
  }
}, { _id: false });

UserBranchSchema.index({ user_id: 1, branch_id: 1 }, { unique: true });

module.exports = mongoose.model('UserBranch', UserBranchSchema);
