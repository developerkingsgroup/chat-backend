const mongoose = require('mongoose');

const UserCompanySchema = new mongoose.Schema({
  user_id: {
    type: String,
    ref: 'User',
    required: true
  },
  company_id: {
    type: String,
    ref: 'Company',
    required: true
  }
}, { _id: false });

UserCompanySchema.index({ user_id: 1, company_id: 1 }, { unique: true });

module.exports = mongoose.model('UserCompany', UserCompanySchema);
