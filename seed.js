// seed.js — Chat-layer seed (kings-auth must be running and seeded first)
// Creates:  UserProfiles (avatar/color display data)
//           ChatGroups   (branch × department rooms)
// Does NOT seed users, companies, branches, departments — those live in kings-auth.
require('dotenv').config();
const axios      = require('axios');
const jwt        = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const connectDB  = require('./config/db');

const ChatGroup   = require('./models/ChatGroup');
const UserProfile = require('./models/UserProfile');

const AUTH_URL = process.env.KINGS_AUTH_URL || 'http://localhost:3000';
const authClient = axios.create({ baseURL: AUTH_URL });

// Display metadata to overlay on kings-auth users (matched by email)
const USER_DISPLAY = {
  'afshin.dhanani@kingsgroupco.com': { avatar: '👑', color: '#2563EB', role: 'Super Admin' },
  'vinod@kingsgroupco.com':          { avatar: '👑', color: '#1D4ED8', role: 'Super Admin' },
  'farhan@travkings.com':            { avatar: '🏢', color: '#3B82F6', role: 'Company Manager' },
  'faiz@travkings.com':              { avatar: '🏢', color: '#2563EB', role: 'Company Manager' },
  'sughra@travkings.com':            { avatar: '💰', color: '#10B981', role: 'HOD Finance' },
  'pravesh@travkings.com':           { avatar: '📍', color: '#F59E0B', role: 'AMD Mumbai Branch' },
  'ap@travkings.com':                { avatar: '📊', color: '#14B8A6', role: 'Finance Employee' },
  'accounts.drc@travkings.com':      { avatar: '💵', color: '#059669', role: 'Finance Employee' },
  'anuvab@kingsgroupco.com':         { avatar: '🏢', color: '#7C3AED', role: 'Company Manager' },
  'surajit@kingsgroupco.com':        { avatar: '🧑‍💻', color: '#8B5CF6', role: 'Company Manager' },
  'ratnesh@kingsgroupco.com':        { avatar: '💻', color: '#6366F1', role: 'Developer' },
};

const seed = async () => {
  try {
    await connectDB();
    console.log('🗑️  Clearing chat-layer data...');
    await ChatGroup.deleteMany({});
    await UserProfile.deleteMany({});
    console.log('✅ Cleared\n');

    // ── Get service token ─────────────────────────────────────────────────────
    console.log('🔑 Logging into kings-auth...');
    const loginRes = await authClient.post('/auth/login/password', {
      email:    process.env.KINGS_AUTH_SERVICE_EMAIL,
      password: process.env.KINGS_AUTH_SERVICE_PASSWORD,
    });
    const token  = loginRes.data.token;
    const svcHdr = { headers: { Authorization: `Bearer ${token}` } };
    console.log('✅ Authenticated\n');

    // ── Fetch org structure from kings-auth ───────────────────────────────────
    console.log('📡 Fetching org data from kings-auth...');
    const [brRes, deRes, usrRes] = await Promise.all([
      authClient.get('/orgs/branches?limit=200',    svcHdr),
      authClient.get('/orgs/departments?limit=200', svcHdr),
      authClient.get('/users?limit=200',            svcHdr),
    ]);
    const branches    = brRes.data.data  || [];
    const departments = deRes.data.data  || [];
    const authUsers   = usrRes.data.data || [];
    console.log(`✅ ${branches.length} branches, ${departments.length} departments, ${authUsers.length} users\n`);

    // ── Seed UserProfiles ─────────────────────────────────────────────────────
    console.log('👤 Seeding UserProfiles...');
    const profileDocs = authUsers.map(u => {
      const display = USER_DISPLAY[u.email] || {};
      return {
        _id:    String(u._id),
        name:   u.name,
        avatar: display.avatar || '👤',
        color:  display.color  || '#60A5FA',
        role:   display.role   || u.designation || (u.roleAssignments?.[0]?.role) || 'User',
      };
    });
    if (profileDocs.length) await UserProfile.insertMany(profileDocs);
    console.log(`✅ ${profileDocs.length} UserProfiles\n`);

    // ── Seed ChatGroups (branch × department) ─────────────────────────────────
    console.log('💬 Seeding ChatGroups...');
    const chatGroups = [];
    branches.forEach(br => {
      departments.forEach(d => {
        const brPrefix = (br.name || '').split(' ')[0];
        const dCode    = d.code || d.name.slice(0, 4).toUpperCase();
        chatGroups.push({
          _id:           uuid(),
          branch_id:     String(br._id),
          department_id: String(d._id),
          name:          `${brPrefix} ${dCode}`,
        });
      });
    });
    if (chatGroups.length) await ChatGroup.insertMany(chatGroups);
    console.log(`✅ ${chatGroups.length} ChatGroups\n`);

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 Chat seed complete!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  UserProfiles: ${await UserProfile.countDocuments()}`);
    console.log(`  ChatGroups:   ${await ChatGroup.countDocuments()}`);
    console.log('═══════════════════════════════════════════════════════');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.response?.data || err.message);
    process.exit(1);
  }
};

module.exports = { seed };
// seed();
