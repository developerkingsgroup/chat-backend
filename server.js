// server.js — TravKings & Partners Platform Backend
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { WebSocketServer } = require('ws');
const http   = require('http');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const connectDB = require('./config/db');

// Import Mongoose Models
const Company = require('./models/Company');
const Branch = require('./models/Branch');
const Department = require('./models/Department');
const User = require('./models/User');
const UserCompany = require('./models/UserCompany');
const UserBranch = require('./models/UserBranch');
const UserDepartment = require('./models/UserDepartment');
const ChatGroup = require('./models/ChatGroup');
const Message = require('./models/Message');
const CallLog = require('./models/CallLog');
const Reminder = require('./models/Reminder');
const { seed } = require('./seed');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

const PORT    = process.env.PORT || 4000;
const SECRET  = process.env.JWT_SECRET || 'travkings_jwt_secret_change_me';

// Connect to MongoDB
connectDB().then(()=>{
  console.log("running seed")
  seed()
})

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Static file serving
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

// File upload (multer)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req,  file, cb) => cb(null, `${uuid()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ── Helpers ───────────────────────────────────────────────────────────────────
const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, is_super_admin: user.is_super_admin }, SECRET, { expiresIn: '30d' });

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorised' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
};

const adminOnly = (req, res, next) =>
  req.user.is_super_admin ? next() : res.status(403).json({ error: 'Admin only' });

const safeUser = (u) => ({ id:u.id, name:u.name, email:u.email, role:u.role, avatar:u.avatar, color:u.color, is_super_admin:u.is_super_admin, is_active:u.is_active, last_seen:u.last_seen });

// ── WebSocket ─────────────────────────────────────────────────────────────────
const clients = new Map(); // userId → WebSocket

wss.on('connection', async(ws, req) => {
  const token = new URL(req.url, 'ws://x').searchParams.get('token');
  try {
    const decoded = jwt.verify(token, SECRET);
    clients.set(decoded.id, ws);
    // Update last_seen
    await User.findByIdAndUpdate(decoded.id, { last_seen: new Date() });
    ws.on('close', async () => {
      clients.delete(decoded.id);
      await User.findByIdAndUpdate(decoded.id, { last_seen: new Date() });
    });
    ws.send(JSON.stringify({ event: 'connected', data: { userId: decoded.id } }));
  } catch { ws.close(); }
});

const emit = (userIds, event, data) => {
  const payload = JSON.stringify({ event, data });
  [...new Set(userIds)].forEach(id => {
    const ws = clients.get(id);
    if (ws?.readyState === 1) ws.send(payload);
  });
};

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    if (await User.findOne({ email })) return res.status(409).json({ error: 'Email already exists' });
    const hash = await bcrypt.hash(password, 12);
    const id   = uuid();
    const isFirst = (await User.countDocuments()) === 0;
    const user = await User.create({
      _id: id,
      name,
      email,
      password_hash: hash,
      role: role || 'User',
      is_super_admin: isFirst,
    });
    // If super admin → add to all companies/branches/depts
    if (isFirst) await grantSuperAdminAccess(id);
    res.status(201).json({ token: signToken(user), user: safeUser(user) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
    await User.findByIdAndUpdate(user._id, { last_seen: new Date() });
    res.json({ token: signToken(user), user: safeUser(user) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// app.post('/api/auth/login', async (req, res) => {
//   try {
//     const { email } = req.body;

//     // Dummy user (no DB dependency)
//     const user = {
//       id: 1,
//       name: 'Demo User',
//       email: email || 'demo@travkings.com',
//       role: 'admin',
//       avatar: '👤',
//     };

//     res.json({
//       token: signToken(user), // still generate token
//       user: safeUser ? safeUser(user) : user, // fallback if safeUser not needed
//     });

//   } catch (e) {
//     res.status(500).json({ error: e.message });
//   }
// });
app.get('/api/auth/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const full = await enrichUser(user);
  res.json(full);
});

app.put('/api/auth/profile', auth, async (req, res) => {
  const { name, avatar, color } = req.body;
  await User.findByIdAndUpdate(req.user.id, { name, avatar, color });
  res.json({ ok: true });
});

app.put('/api/auth/password', auth, async (req, res) => {
  const { current_password, new_password } = req.body;
  const user = await User.findById(req.user.id);
  if (!await bcrypt.compare(current_password, user.password_hash)) return res.status(400).json({ error: 'Wrong current password' });
  await User.findByIdAndUpdate(req.user.id, { password_hash: await bcrypt.hash(new_password, 12) });
  res.json({ ok: true });
});

// ── USERS ─────────────────────────────────────────────────────────────────────
const enrichUser = async (u) => {
  const out = safeUser(u);
  out.companies   = (await UserCompany.find({ user_id: u._id })).map(r=>r.company_id);
  out.branches    = (await UserBranch.find({ user_id: u._id })).map(r=>r.branch_id);
  out.departments = (await UserDepartment.find({ user_id: u._id })).map(r=>r.department_id);
  return out;
};

const grantSuperAdminAccess = async (userId) => {
  const cos  = await Company.find({}, '_id');
  const brs  = await Branch.find({}, '_id');
  const dpts = await Department.find({}, '_id');
  await UserCompany.insertMany(cos.map(c => ({ user_id: userId, company_id: c._id })));
  await UserBranch.insertMany(brs.map(b => ({ user_id: userId, branch_id: b._id })));
  await UserDepartment.insertMany(dpts.map(d => ({ user_id: userId, department_id: d._id })));
};

app.get('/api/users', auth, async (_req, res) => {
  const users = await User.find({}).sort({ name: 1 });
  const enrichedUsers = await Promise.all(users.map(enrichUser));
  res.json(enrichedUsers);
});

app.post('/api/users', auth, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, avatar, color, is_super_admin, companies=[], branches=[], departments=[] } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(409).json({ error: 'Email already exists' });
    const id   = uuid();
    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      _id: id,
      name,
      email,
      password_hash: hash,
      role: role||'User',
      avatar: avatar||'👤',
      color: color||'#60A5FA',
      is_super_admin: is_super_admin ? true : false,
    });
    if (is_super_admin) {
      await grantSuperAdminAccess(id);
    } else {
      await UserCompany.insertMany(companies.map(c => ({ user_id: id, company_id: c })));
      await UserBranch.insertMany(branches.map(b => ({ user_id: id, branch_id: b })));
      await UserDepartment.insertMany(departments.map(d => ({ user_id: id, department_id: d })));
    }
    res.status(201).json(await enrichUser(user));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id', auth, adminOnly, async (req, res) => {
  const { name, role, avatar, color, is_super_admin, is_active, companies, branches, departments } = req.body;
  await User.findByIdAndUpdate(req.params.id, { name, role, avatar, color, is_super_admin, is_active });
  if (is_super_admin) {
    await grantSuperAdminAccess(req.params.id);
  } else {
    if (companies) {
      await UserCompany.deleteMany({ user_id: req.params.id });
      await UserCompany.insertMany(companies.map(c => ({ user_id: req.params.id, company_id: c })));
    }
    if (branches) {
      await UserBranch.deleteMany({ user_id: req.params.id });
      await UserBranch.insertMany(branches.map(b => ({ user_id: req.params.id, branch_id: b })));
    }
    if (departments) {
      await UserDepartment.deleteMany({ user_id: req.params.id });
      await UserDepartment.insertMany(departments.map(d => ({ user_id: req.params.id, department_id: d })));
    }
  }
  res.json({ ok: true });
});

app.delete('/api/users/:id', auth, adminOnly, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  await UserCompany.deleteMany({ user_id: req.params.id });
  await UserBranch.deleteMany({ user_id: req.params.id });
  await UserDepartment.deleteMany({ user_id: req.params.id });
  res.json({ ok: true });
});

// ── COMPANIES ─────────────────────────────────────────────────────────────────
app.get('/api/companies', auth, async (_req, res) => {
  const cos = await Company.find({}).sort({ name: 1 });
  const companiesWithBranches = await Promise.all(cos.map(async c => {
    const branches = await Branch.find({ company_id: c._id }).sort({ name: 1 });
    return { ...c.toObject(), branches };
  }));
  res.json(companiesWithBranches);
});

app.post('/api/companies', auth, adminOnly, async (req, res) => {
  const { name, tagline, avatar, color } = req.body;
  const id = uuid();
  const company = await Company.create({
    _id: id,
    name,
    tagline: tagline||'',
    avatar: avatar||'🏢',
    color: color||'#3B82F6',
    created_by: req.user.id,
  });
  // Grant access to all super admins
  const admins = await User.find({ is_super_admin: true }, '_id');
  await UserCompany.insertMany(admins.map(a => ({ user_id: a._id, company_id: id })));
  res.status(201).json({ ...company.toObject(), branches: [] });
});

app.put('/api/companies/:id', auth, adminOnly, async (req, res) => {
  const { name, tagline, avatar, color } = req.body;
  await Company.findByIdAndUpdate(req.params.id, { name, tagline, avatar, color });
  res.json({ ok: true });
});

app.delete('/api/companies/:id', auth, adminOnly, async (req, res) => {
  await Company.findByIdAndDelete(req.params.id);
  await Branch.deleteMany({ company_id: req.params.id });
  await UserCompany.deleteMany({ company_id: req.params.id });
  res.json({ ok: true });
});

// ── BRANCHES ──────────────────────────────────────────────────────────────────
app.get('/api/branches', auth, async (req, res) => {
  const query = req.query.company_id ? { company_id: req.query.company_id } : {};
  const branches = await Branch.find(query).sort({ name: 1 });
  res.json(branches);
});

app.post('/api/branches', auth, adminOnly, async (req, res) => {
  const { company_id, name, city, avatar, color } = req.body;
  const id = uuid();
  const branch = await Branch.create({
    _id: id,
    company_id,
    name,
    city: city||'',
    avatar: avatar||'🌿',
    color: color||'#10B981',
  });
  // Auto-create 6 dept chat groups for this branch
  const depts = await Department.find({});
  const chatGroupsToInsert = depts.map(d => ({
    _id: uuid(),
    branch_id: id,
    department_id: d._id,
    name: `${name.split(' ')[0]} ${d.short_name}`,
  }));
  await ChatGroup.insertMany(chatGroupsToInsert);
  // Grant access to all super admins
  const admins = await User.find({ is_super_admin: true }, '_id');
  await UserBranch.insertMany(admins.map(a => ({ user_id: a._id, branch_id: id })));
  res.status(201).json(branch);
});

app.put('/api/branches/:id', auth, adminOnly, async (req, res) => {
  const { name, city, avatar, color } = req.body;
  await Branch.findByIdAndUpdate(req.params.id, { name, city, avatar, color });
  res.json({ ok: true });
});

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────
app.get('/api/departments', auth, async (_req, res) => res.json(await Department.find({})));

app.post('/api/departments', auth, adminOnly, async (req, res) => {
  const { name, short_name, icon, color } = req.body;
  const id = uuid();
  const department = await Department.create({
    _id: id,
    name,
    short_name: short_name||name.slice(0,4).toUpperCase(),
    icon: icon||'🏷️',
    color: color||'#8B5CF6',
  });
  // Auto-create chat group for all branches
  const branches = await Branch.find({});
  const chatGroupsToInsert = branches.map(b => ({
    _id: uuid(),
    branch_id: b._id,
    department_id: id,
    name: `${b.name.split(' ')[0]} ${short_name||name.slice(0,4).toUpperCase()}`,
  }));
  await ChatGroup.insertMany(chatGroupsToInsert);
  // Grant access to all super admins
  const admins = await User.find({ is_super_admin: true }, '_id');
  await UserDepartment.insertMany(admins.map(a => ({ user_id: a._id, department_id: id })));
  res.status(201).json(department);
});

// ── CHAT GROUPS ───────────────────────────────────────────────────────────────
app.get('/api/chat-groups', auth, async (req, res) => {
  const groups = await ChatGroup.find({})
    .populate({ path: 'branch_id', select: 'name city avatar color company_id' })
    .populate({ path: 'department_id', select: 'name short_name icon color' })
    .sort({ 'branch_id.company_id': 1, 'branch_id.name': 1, 'department_id.name': 1 });

  const enrichedGroups = await Promise.all(groups.map(async g => {
    const unread = await Message.countDocuments({ chat_id: g._id, chat_type: 'group', sender_id: { $ne: req.user.id }, is_read: false });
    const last_message = await Message.findOne({ chat_id: g._id, chat_type: 'group' }).sort({ created_at: -1 });
    return {
      ...g.toObject(),
      branch_name: g.branch_id.name,
      city: g.branch_id.city,
      branch_avatar: g.branch_id.avatar,
      branch_color: g.branch_id.color,
      company_id: g.branch_id.company_id,
      dept_name: g.department_id.name,
      short_name: g.department_id.short_name,
      dept_icon: g.department_id.icon,
      dept_color: g.department_id.color,
      unread,
      last_message,
    };
  }));
  res.json(enrichedGroups);
});

// ── MESSAGES ──────────────────────────────────────────────────────────────────
app.get('/api/messages/:chatType/:chatId', auth, async (req, res) => {
  const { chatType, chatId } = req.params;
  const limit  = parseInt(req.query.limit) || 50;
  const before = req.query.before;
  const query = { chat_id: chatId, chat_type: chatType };
  if (before) query.created_at = { $lt: new Date(before) };

  const msgs = await Message.find(query)
    .populate({ path: 'sender_id', select: 'name avatar color' })
    .sort({ created_at: -1 })
    .limit(limit);

  // Mark as read
  await Message.updateMany(
    { chat_id: chatId, chat_type: chatType, sender_id: { $ne: req.user.id }, is_read: false },
    { $set: { is_read: true } }
  );
  res.json(msgs.reverse());
});

app.post('/api/messages', auth, async (req, res) => {
  const { chat_id, chat_type, type, content, file_url, file_name, file_size, duration } = req.body;
  const id = uuid();
  const msg = await Message.create({
    _id: id,
    chat_id,
    chat_type,
    sender_id: req.user.id,
    type: type||'text',
    content: content||null,
    file_url: file_url||null,
    file_name: file_name||null,
    file_size: file_size||null,
    duration: duration||null,
  });
  const populatedMsg = await Message.findById(id).populate({ path: 'sender_id', select: 'name avatar color' });
  // Broadcast via WebSocket
  if (chat_type === 'group') {
    const allUsers = await User.find({ is_active: true }, '_id');
    emit(allUsers.map(u => u._id), 'new_message', populatedMsg);
  } else {
    emit([chat_id, req.user.id], 'new_message', populatedMsg);
  }
  res.status(201).json(populatedMsg);
});

// File upload
app.post('/api/messages/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url  = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  const size = req.file.size < 1048576 ? `${(req.file.size/1024).toFixed(1)} KB` : `${(req.file.size/1048576).toFixed(1)} MB`;
  res.json({ url, name: req.file.originalname, size });
});

// ── CONVERSATIONS (DM list) ───────────────────────────────────────────────────
app.get('/api/conversations', auth, async (req, res) => {
  const me = req.user.id;
  const messages = await Message.find({
    $or: [{ sender_id: me }, { chat_id: me }],
    chat_type: 'direct'
  }).sort({ created_at: -1 });

  const conversationMap = new Map();
  for (const msg of messages) {
    const otherId = msg.sender_id === me ? msg.chat_id : msg.sender_id;
    if (!conversationMap.has(otherId)) {
      conversationMap.set(otherId, {
        last_message: msg,
        unread: 0
      });
    }
    if (msg.chat_id === me && !msg.is_read) {
      conversationMap.get(otherId).unread++;
    }
  }

  const result = await Promise.all(Array.from(conversationMap.entries()).map(async ([otherId, convo]) => {
    const user = await User.findById(otherId);
    if (!user) return null;
    return { user: safeUser(user), last_message: convo.last_message, unread: convo.unread };
  }));

  res.json(result.filter(Boolean));
});

// ── CALLS ─────────────────────────────────────────────────────────────────────
app.get('/api/calls', auth, async (req, res) => {
  const calls = await CallLog.find({
    $or: [{ caller_id: req.user.id }, { callee_id: req.user.id }]
  })
    .populate({ path: 'caller_id', select: 'name avatar color' })
    .populate({ path: 'callee_id', select: 'name avatar color' })
    .sort({ created_at: -1 })
    .limit(100);
  res.json(calls);
});

app.post('/api/calls', auth, async (req, res) => {
  const { callee_id, type, duration, status } = req.body;
  const id = uuid();
  const call = await CallLog.create({
    _id: id,
    caller_id: req.user.id,
    callee_id,
    type: type||'voice',
    duration: duration||0,
    status: status||'completed',
  });
  emit([callee_id], 'incoming_call', { caller_id: req.user.id, call_id: id, type });
  res.status(201).json({ id: call._id });
});

// ── REMINDERS ─────────────────────────────────────────────────────────────────
app.get('/api/reminders', auth, async (req, res) => {
  const { view } = req.query;
  const me = req.user.id;
  let query = {};
  if      (view === 'mine')   { query = { for_user_id: me }; }
  else if (view === 'others') { query = { created_by: me, for_user_id: { $ne: me } }; }
  else if (view === 'review') { query = { status: 'review' }; }
  else if (!req.user.is_super_admin) { query = { $or: [{ for_user_id: me }, { created_by: me }] }; }

  const rems = await Reminder.find(query)
    .populate({ path: 'for_user_id', select: 'name avatar color role' })
    .populate({ path: 'created_by', select: 'name avatar' })
    .sort({ created_at: -1 });
  res.json(rems);
});

app.post('/api/reminders', auth, async (req, res) => {
  const { title, note, due_date, priority, for_user_id } = req.body;
  const id = uuid();
  const rem = await Reminder.create({
    _id: id,
    title,
    note: note||'',
    due_date: due_date||null,
    priority: priority||'medium',
    for_user_id: for_user_id||req.user.id,
    created_by: req.user.id,
  });
  emit([for_user_id, req.user.id], 'reminder_created', rem);
  res.status(201).json(rem);
});

app.put('/api/reminders/:id', auth, async (req, res) => {
  const { title, note, due_date, priority, for_user_id } = req.body;
  await Reminder.findByIdAndUpdate(req.params.id, {
    title,
    note,
    due_date,
    priority,
    for_user_id,
    updated_at: new Date(),
  });
  res.json({ ok: true });
});

app.patch('/api/reminders/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  const valid = ['pending','review','approved','rejected'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const rem = await Reminder.findById(req.params.id);
  if (!rem) return res.status(404).json({ error: 'Not found' });
  await Reminder.findByIdAndUpdate(req.params.id, {
    status,
    reviewed_by: req.user.id,
    reviewed_at: new Date(),
    updated_at: new Date(),
  });
  emit([rem.for_user_id, rem.created_by, req.user.id], 'reminder_updated', { id: rem._id, status });
  res.json({ ok: true });
});

app.delete('/api/reminders/:id', auth, async (req, res) => {
  await Reminder.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ── STATS ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', auth, adminOnly, async (_req, res) => res.json({
  companies:   await Company.countDocuments(),
  branches:    await Branch.countDocuments(),
  departments: await Department.countDocuments(),
  users:       await User.countDocuments(),
  messages:    await Message.countDocuments(),
  reminders:   await Reminder.countDocuments(),
}));

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date() }));

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`✅  TravKings backend → http://localhost:${PORT}`);
  console.log(`✅  WebSocket         → ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server.');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});
