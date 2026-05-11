// seed-kings-auth.js
// Creates users directly in kings-auth's MongoDB (bypasses the API for bootstrapping)
// Run: node seed-kings-auth.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// kings-auth DB — override via KINGS_AUTH_MONGO_URI env var if needed
const MONGO_URI = process.env.KINGS_AUTH_MONGO_URI || 'mongodb://localhost:27017/jwt_auth';
const PASSWORD  = 'password123';

// ── Replicate the kings-auth User schema (must stay in sync with kings-auth/src/models/User.ts) ──
const roleAssignmentSchema = new mongoose.Schema(
  {
    role:       { type: String, enum: ['super_admin', 'company_manager', 'branch_manager', 'hod', 'employee'], required: true },
    entityType: { type: String, enum: ['organisation', 'company', 'branch', 'department'], required: true },
    entityId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name:            { type: String, required: true, trim: true },
    email:           { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile:          { type: String, required: true, unique: true, trim: true },
    passwordHash:    { type: String, required: true },
    designation:     { type: String, trim: true },
    isActive:        { type: Boolean, default: true },
    mfaEnabled:      { type: Boolean, default: false },
    mfaMethod:       { type: String, enum: ['email', 'sms', null], default: null },
    roleAssignments: { type: [roleAssignmentSchema], default: [] },
    tokenVersion:    { type: Number, default: 0 },
    createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

// Dummy ObjectId for roleAssignment entityId (super_admin doesn't need a real one)
const ORG_PLACEHOLDER = new mongoose.Types.ObjectId();

const USERS = [
  {
    name: 'Afshin Dhanani',
    email: 'afshin.dhanani@kingsgroupco.com',
    mobile: '+911000000001',
    designation: 'Super Admin',
    roleAssignments: [{ role: 'super_admin', entityType: 'organisation', entityId: ORG_PLACEHOLDER }],
  },
  {
    name: 'Vinod',
    email: 'vinod@kingsgroupco.com',
    mobile: '+911000000002',
    designation: 'Super Admin',
    roleAssignments: [{ role: 'super_admin', entityType: 'organisation', entityId: ORG_PLACEHOLDER }],
  },
  {
    name: 'Farhan',
    email: 'farhan@travkings.com',
    mobile: '+911000000003',
    designation: 'Company Manager',
    roleAssignments: [{ role: 'company_manager', entityType: 'organisation', entityId: ORG_PLACEHOLDER }],
  },
  {
    name: 'Faiz',
    email: 'faiz@travkings.com',
    mobile: '+911000000004',
    designation: 'Company Manager',
    roleAssignments: [{ role: 'company_manager', entityType: 'organisation', entityId: ORG_PLACEHOLDER }],
  },
  {
    name: 'Sughra',
    email: 'sughra@travkings.com',
    mobile: '+911000000005',
    designation: 'HOD Finance',
    roleAssignments: [{ role: 'hod', entityType: 'organisation', entityId: ORG_PLACEHOLDER }],
  },
  {
    name: 'Pravesh',
    email: 'pravesh@travkings.com',
    mobile: '+911000000006',
    designation: 'AMD Mumbai Branch',
    roleAssignments: [{ role: 'branch_manager', entityType: 'organisation', entityId: ORG_PLACEHOLDER }],
  },
  {
    name: 'AP',
    email: 'ap@travkings.com',
    mobile: '+911000000007',
    designation: 'Finance Employee',
    roleAssignments: [{ role: 'employee', entityType: 'organisation', entityId: ORG_PLACEHOLDER }],
  },
  {
    name: 'Accounts DRC',
    email: 'accounts.drc@travkings.com',
    mobile: '+911000000008',
    designation: 'Finance Employee',
    roleAssignments: [{ role: 'employee', entityType: 'organisation', entityId: ORG_PLACEHOLDER }],
  },
  {
    name: 'Anuvab',
    email: 'anuvab@kingsgroupco.com',
    mobile: '+911000000009',
    designation: 'Company Manager',
    roleAssignments: [{ role: 'company_manager', entityType: 'organisation', entityId: ORG_PLACEHOLDER }],
  },
  {
    name: 'Surajit',
    email: 'surajit@kingsgroupco.com',
    mobile: '+911000000010',
    designation: 'Company Manager',
    roleAssignments: [{ role: 'company_manager', entityType: 'organisation', entityId: ORG_PLACEHOLDER }],
  },
  {
    name: 'Ratnesh',
    email: 'ratnesh@kingsgroupco.com',
    mobile: '+911000000011',
    designation: 'Developer',
    roleAssignments: [{ role: 'employee', entityType: 'organisation', entityId: ORG_PLACEHOLDER }],
  },
];

async function seed() {
  console.log(`Connecting to ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected\n');

  const hash = await bcrypt.hash(PASSWORD, 10);

  let created = 0, skipped = 0;
  for (const u of USERS) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      console.log(`  ⏭️  ${u.email} already exists — skipped`);
      skipped++;
      continue;
    }
    await User.create({ ...u, passwordHash: hash });
    console.log(`  ✅  ${u.email.padEnd(40)} → ${u.designation}`);
    created++;
  }

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`🎉 Done! Created: ${created}  Skipped: ${skipped}`);
  console.log(`   Password for all: ${PASSWORD}`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log('\n👑 Super admins:');
  console.log('   afshin.dhanani@kingsgroupco.com');
  console.log('   vinod@kingsgroupco.com');
  console.log('\n⚠️  Note: roleAssignment entityIds are placeholders.');
  console.log('   Use the admin panel to assign proper company/branch/dept access after creating org structure.');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
