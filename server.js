// server.js — TravKings & Partners Platform Backend
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const { WebSocketServer } = require("ws");
const http = require("http");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("./db");
const loggerMiddleware = require("./middleware/logs");
require("./seed");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 4000;
const SECRET = process.env.JWT_SECRET || "travkings_jwt_secret_change_me";

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
// app.use(loggerMiddleware);
// Static file serving
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

// File upload (multer)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${uuid()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ── Helpers ───────────────────────────────────────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, is_super_admin: user.is_super_admin },
    SECRET,
    { expiresIn: "30d" },
  );

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorised" });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const adminOnly = (req, res, next) =>
  req.user.is_super_admin
    ? next()
    : res.status(403).json({ error: "Admin only" });

const safeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  avatar: u.avatar,
  color: u.color,
  is_super_admin: u.is_super_admin,
  is_active: u.is_active,
  last_seen: u.last_seen,
});

// ── WebSocket ─────────────────────────────────────────────────────────────────
const clients = new Map(); // userId → WebSocket

wss.on("connection", (ws, req) => {
  const token = new URL(req.url, "ws://x").searchParams.get("token");
  try {
    const decoded = jwt.verify(token, SECRET);
    clients.set(decoded.id, ws);
    // Update last_seen
    db.prepare("UPDATE users SET last_seen=CURRENT_TIMESTAMP WHERE id=?").run(
      decoded.id,
    );
    ws.on("close", () => {
      clients.delete(decoded.id);
      db.prepare("UPDATE users SET last_seen=CURRENT_TIMESTAMP WHERE id=?").run(
        decoded.id,
      );
    });
    ws.send(
      JSON.stringify({ event: "connected", data: { userId: decoded.id } }),
    );
  } catch {
    ws.close();
  }
});

const emit = (userIds, event, data) => {
  const payload = JSON.stringify({ event, data });
  [...new Set(userIds)].forEach((id) => {
    const ws = clients.get(id);
    if (ws?.readyState === 1) ws.send(payload);
  });
};

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "name, email, password required" });
    if (db.prepare("SELECT id FROM users WHERE email=?").get(email))
      return res.status(409).json({ error: "Email already exists" });
    const hash = await bcrypt.hash(password, 12);
    const id = uuid();
    const isFirst = db.prepare("SELECT COUNT(*) as n FROM users").get().n === 0;
    db.prepare(
      "INSERT INTO users (id,name,email,password_hash,role,is_super_admin) VALUES (?,?,?,?,?,?)",
    ).run(id, name, email, hash, role || "User", isFirst ? 1 : 0);
    // If super admin → add to all companies/branches/depts
    if (isFirst) grantSuperAdminAccess(id);
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(id);
    res.status(201).json({ token: signToken(user), user: safeUser(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    console.log("\n════════ LOGIN DEBUG ════════");

    const { email, password } = req.body;

    console.log("📧 Email:", email);
    console.log("🔑 Password:", password);


    // Find user
    const user = db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(email);

    console.log("\n🔍 DB User:");
    console.log(user);

    if (!user) {
      console.log("❌ User not found");
      return res.status(401).json({
        error: "Invalid credentials",
        debug: "User not found",
      });
    }



    // Compare password
    const isMatch = await bcrypt.compare(
      password,
      user.password_hash,
    );



    if (!isMatch) {
      console.log("❌ Password mismatch");

      // TEMP TEST
      const testHash = bcrypt.hashSync(password, 10);

      console.log("\n🧪 Fresh Hash Test:");
      console.log(testHash);

      return res.status(401).json({
        error: "Invalid credentials",
        debug: "Password mismatch",
      });
    }

    // Update last seen
    db.prepare(`
      UPDATE users
      SET last_seen=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(user.id);

    console.log("✅ Login Success");
    console.log("══════════════════════════════\n");

    res.json({
      token: signToken(user),
      user: safeUser(user),
    });
  } catch (e) {
    console.log("💥 LOGIN ERROR:");
    console.error(e);

    res.status(500).json({
      error: e.message,
    });
  }
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
app.get("/api/auth/me", auth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  const full = enrichUser(user);
  res.json(full);
});

app.put("/api/auth/profile", auth, (req, res) => {
  const { name, avatar, color } = req.body;
  db.prepare(
    "UPDATE users SET name=COALESCE(?,name), avatar=COALESCE(?,avatar), color=COALESCE(?,color) WHERE id=?",
  ).run(name, avatar, color, req.user.id);
  res.json({ ok: true });
});

app.put("/api/auth/password", auth, async (req, res) => {
  const { current_password, new_password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  if (!(await bcrypt.compare(current_password, user.password_hash)))
    return res.status(400).json({ error: "Wrong current password" });
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
    await bcrypt.hash(new_password, 12),
    user.id,
  );
  res.json({ ok: true });
});

// ── USERS ─────────────────────────────────────────────────────────────────────
const enrichUser = (u) => {
  const out = safeUser(u);
  out.companies = db
    .prepare("SELECT company_id FROM user_companies WHERE user_id=?")
    .all(u.id)
    .map((r) => r.company_id);
  out.branches = db
    .prepare("SELECT branch_id FROM user_branches WHERE user_id=?")
    .all(u.id)
    .map((r) => r.branch_id);
  out.departments = db
    .prepare("SELECT department_id FROM user_departments WHERE user_id=?")
    .all(u.id)
    .map((r) => r.department_id);
  return out;
};

const grantSuperAdminAccess = (userId) => {
  const cos = db.prepare("SELECT id FROM companies").all();
  const brs = db.prepare("SELECT id FROM branches").all();
  const dpts = db.prepare("SELECT id FROM departments").all();
  const insCo = db.prepare(
    "INSERT OR IGNORE INTO user_companies (user_id,company_id) VALUES (?,?)",
  );
  const insBr = db.prepare(
    "INSERT OR IGNORE INTO user_branches (user_id,branch_id) VALUES (?,?)",
  );
  const insDe = db.prepare(
    "INSERT OR IGNORE INTO user_departments (user_id,department_id) VALUES (?,?)",
  );
  cos.forEach((c) => insCo.run(userId, c.id));
  brs.forEach((b) => insBr.run(userId, b.id));
  dpts.forEach((d) => insDe.run(userId, d.id));
};

app.get("/api/users", auth, (_req, res) => {
  const users = db.prepare("SELECT * FROM users ORDER BY name").all();
  res.json(users.map(enrichUser));
});

app.get("/api/users/search", auth, (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const pattern = `%${q}%`;
  const users = db
    .prepare(
      `
    SELECT * FROM users 
    WHERE name LIKE ? OR email LIKE ? OR role LIKE ?
    ORDER BY name
    LIMIT 50
  `,
    )
    .all(pattern, pattern, pattern);
  res.json(users.map(enrichUser));
});

app.post("/api/users", auth, adminOnly, async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      avatar,
      color,
      is_super_admin,
      companies = [],
      branches = [],
      departments = [],
    } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "Missing fields" });
    const id = uuid();
    const hash = await bcrypt.hash(password, 12);
    db.prepare(
      "INSERT INTO users (id,name,email,password_hash,role,avatar,color,is_super_admin) VALUES (?,?,?,?,?,?,?,?)",
    ).run(
      id,
      name,
      email,
      hash,
      role || "User",
      avatar || "👤",
      color || "#60A5FA",
      is_super_admin ? 1 : 0,
    );
    if (is_super_admin) {
      grantSuperAdminAccess(id);
    } else {
      const insCo = db.prepare(
        "INSERT OR IGNORE INTO user_companies VALUES (?,?)",
      );
      const insBr = db.prepare(
        "INSERT OR IGNORE INTO user_branches VALUES (?,?)",
      );
      const insDe = db.prepare(
        "INSERT OR IGNORE INTO user_departments VALUES (?,?)",
      );
      companies.forEach((c) => insCo.run(id, c));
      branches.forEach((b) => insBr.run(id, b));
      departments.forEach((d) => insDe.run(id, d));
    }
    res
      .status(201)
      .json(enrichUser(db.prepare("SELECT * FROM users WHERE id=?").get(id)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/users/:id", auth, adminOnly, (req, res) => {
  const {
    name,
    role,
    avatar,
    color,
    is_super_admin,
    is_active,
    companies,
    branches,
    departments,
  } = req.body;
  db.prepare(
    "UPDATE users SET name=COALESCE(?,name),role=COALESCE(?,role),avatar=COALESCE(?,avatar),color=COALESCE(?,color),is_super_admin=COALESCE(?,is_super_admin),is_active=COALESCE(?,is_active) WHERE id=?",
  ).run(
    name,
    role,
    avatar,
    color,
    is_super_admin != null ? +is_super_admin : null,
    is_active != null ? +is_active : null,
    req.params.id,
  );
  if (is_super_admin) {
    grantSuperAdminAccess(req.params.id);
  } else {
    if (companies) {
      db.prepare("DELETE FROM user_companies WHERE user_id=?").run(
        req.params.id,
      );
      companies.forEach((c) =>
        db
          .prepare("INSERT OR IGNORE INTO user_companies VALUES (?,?)")
          .run(req.params.id, c),
      );
    }
    if (branches) {
      db.prepare("DELETE FROM user_branches WHERE user_id=?").run(
        req.params.id,
      );
      branches.forEach((b) =>
        db
          .prepare("INSERT OR IGNORE INTO user_branches VALUES (?,?)")
          .run(req.params.id, b),
      );
    }
    if (departments) {
      db.prepare("DELETE FROM user_departments WHERE user_id=?").run(
        req.params.id,
      );
      departments.forEach((d) =>
        db
          .prepare("INSERT OR IGNORE INTO user_departments VALUES (?,?)")
          .run(req.params.id, d),
      );
    }
  }
  res.json({ ok: true });
});

app.delete("/api/users/:id", auth, adminOnly, (req, res) => {
  db.prepare("DELETE FROM users WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ── COMPANIES ─────────────────────────────────────────────────────────────────
app.get("/api/companies", auth, (_req, res) => {
  const cos = db.prepare("SELECT * FROM companies ORDER BY name").all();
  cos.forEach((c) => {
    c.branches = db
      .prepare("SELECT * FROM branches WHERE company_id=? ORDER BY name")
      .all(c.id);
  });
  res.json(cos);
});

app.post("/api/companies", auth, adminOnly, (req, res) => {
  const { name, tagline, avatar, color } = req.body;
  const id = uuid();
  db.prepare(
    "INSERT INTO companies (id,name,tagline,avatar,color,created_by) VALUES (?,?,?,?,?,?)",
  ).run(
    id,
    name,
    tagline || "",
    avatar || "🏢",
    color || "#3B82F6",
    req.user.id,
  );
  // Grant access to all super admins
  const admins = db
    .prepare("SELECT id FROM users WHERE is_super_admin=1")
    .all();
  admins.forEach((a) =>
    db
      .prepare("INSERT OR IGNORE INTO user_companies VALUES (?,?)")
      .run(a.id, id),
  );
  res.status(201).json({ id, name, tagline, avatar, color, branches: [] });
});

app.put("/api/companies/:id", auth, adminOnly, (req, res) => {
  const { name, tagline, avatar, color } = req.body;
  db.prepare(
    "UPDATE companies SET name=COALESCE(?,name),tagline=COALESCE(?,tagline),avatar=COALESCE(?,avatar),color=COALESCE(?,color) WHERE id=?",
  ).run(name, tagline, avatar, color, req.params.id);
  res.json({ ok: true });
});

app.delete("/api/companies/:id", auth, adminOnly, (req, res) => {
  db.prepare("DELETE FROM companies WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ── BRANCHES ──────────────────────────────────────────────────────────────────
app.get("/api/branches", auth, (req, res) => {
  const q = req.query.company_id
    ? db
        .prepare("SELECT * FROM branches WHERE company_id=? ORDER BY name")
        .all(req.query.company_id)
    : db.prepare("SELECT * FROM branches ORDER BY name").all();
  res.json(q);
});

app.post("/api/branches", auth, adminOnly, (req, res) => {
  const { company_id, name, city, avatar, color } = req.body;
  const id = uuid();
  db.prepare(
    "INSERT INTO branches (id,company_id,name,city,avatar,color) VALUES (?,?,?,?,?,?)",
  ).run(id, company_id, name, city || "", avatar || "🌿", color || "#10B981");
  // Auto-create 6 dept chat groups for this branch
  const depts = db.prepare("SELECT * FROM departments").all();
  const insGrp = db.prepare(
    "INSERT OR IGNORE INTO chat_groups (id,branch_id,department_id,name) VALUES (?,?,?,?)",
  );
  depts.forEach((d) =>
    insGrp.run(uuid(), id, d.id, `${name.split(" ")[0]} ${d.short_name}`),
  );
  // Grant access to all super admins
  const admins = db
    .prepare("SELECT id FROM users WHERE is_super_admin=1")
    .all();
  admins.forEach((a) =>
    db
      .prepare("INSERT OR IGNORE INTO user_branches VALUES (?,?)")
      .run(a.id, id),
  );
  res.status(201).json({ id, company_id, name, city, avatar, color });
});

app.put("/api/branches/:id", auth, adminOnly, (req, res) => {
  const { name, city, avatar, color } = req.body;
  db.prepare(
    "UPDATE branches SET name=COALESCE(?,name),city=COALESCE(?,city),avatar=COALESCE(?,avatar),color=COALESCE(?,color) WHERE id=?",
  ).run(name, city, avatar, color, req.params.id);
  res.json({ ok: true });
});

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────
app.get("/api/departments", auth, (_req, res) =>
  res.json(db.prepare("SELECT * FROM departments").all()),
);

app.post("/api/departments", auth, adminOnly, (req, res) => {
  const { name, short_name, icon, color } = req.body;
  const id = uuid();
  db.prepare(
    "INSERT INTO departments (id,name,short_name,icon,color) VALUES (?,?,?,?,?)",
  ).run(
    id,
    name,
    short_name || name.slice(0, 4).toUpperCase(),
    icon || "🏷️",
    color || "#8B5CF6",
  );
  // Auto-create chat group for all branches
  const branches = db.prepare("SELECT * FROM branches").all();
  const ins = db.prepare(
    "INSERT OR IGNORE INTO chat_groups (id,branch_id,department_id,name) VALUES (?,?,?,?)",
  );
  branches.forEach((b) =>
    ins.run(
      uuid(),
      b.id,
      id,
      `${b.name.split(" ")[0]} ${short_name || name.slice(0, 4).toUpperCase()}`,
    ),
  );
  // Grant access to all super admins
  const admins = db
    .prepare("SELECT id FROM users WHERE is_super_admin=1")
    .all();
  admins.forEach((a) =>
    db
      .prepare("INSERT OR IGNORE INTO user_departments VALUES (?,?)")
      .run(a.id, id),
  );
  res.status(201).json({ id, name, short_name, icon, color });
});

// ── CHAT GROUPS ───────────────────────────────────────────────────────────────
app.get("/api/chat-groups", auth, (req, res) => {
  const groups = db
    .prepare(
      `
    SELECT cg.*,
      b.name  AS branch_name,  b.city, b.avatar AS branch_avatar, b.color AS branch_color, b.company_id,
      c.name  AS company_name, c.avatar AS company_avatar, c.color AS company_color,
      d.name  AS dept_name,    d.short_name, d.icon AS dept_icon, d.color AS dept_color
    FROM chat_groups cg
    JOIN branches   b ON cg.branch_id=b.id
    JOIN companies  c ON b.company_id=c.id
    JOIN departments d ON cg.department_id=d.id
    ORDER BY c.name, b.name, d.name
  `,
    )
    .all();
  groups.forEach((g) => {
    g.unread =
      db
        .prepare(
          `SELECT COUNT(*) as n FROM messages WHERE chat_id=? AND chat_type='group' AND sender_id!=? AND is_read=0`,
        )
        .get(g.id, req.user.id)?.n || 0;
    g.last_message = db
      .prepare(
        `SELECT content,type,created_at,sender_id FROM messages WHERE chat_id=? AND chat_type='group' ORDER BY created_at DESC LIMIT 1`,
      )
      .get(g.id);
  });
  res.json(groups);
});

// ── MESSAGES ──────────────────────────────────────────────────────────────────
app.get("/api/messages/:chatType/:chatId", auth, (req, res) => {
  const { chatType, chatId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before;
  let q = `SELECT m.*, u.name AS sender_name, u.avatar AS sender_avatar, u.color AS sender_color
           FROM messages m JOIN users u ON m.sender_id=u.id
           WHERE m.chat_id=? AND m.chat_type=?`;
  const params = [chatId, chatType];
  if (before) {
    q += " AND m.created_at<?";
    params.push(before);
  }
  q += " ORDER BY m.created_at DESC LIMIT ?";
  params.push(limit);
  const msgs = db
    .prepare(q)
    .all(...params)
    .reverse();
  // Mark as read
  db.prepare(
    `UPDATE messages SET is_read=1 WHERE chat_id=? AND chat_type=? AND sender_id!=?`,
  ).run(chatId, chatType, req.user.id);
  res.json(msgs);
});

app.post("/api/messages", auth, (req, res) => {
  const {
    chat_id,
    chat_type,
    type,
    content,
    file_url,
    file_name,
    file_size,
    duration,
  } = req.body;
  const id = uuid();
  db.prepare(
    "INSERT INTO messages (id,chat_id,chat_type,sender_id,type,content,file_url,file_name,file_size,duration) VALUES (?,?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    chat_id,
    chat_type,
    req.user.id,
    type || "text",
    content || null,
    file_url || null,
    file_name || null,
    file_size || null,
    duration || null,
  );
  const msg = db
    .prepare(
      `SELECT m.*,u.name AS sender_name,u.avatar AS sender_avatar,u.color AS sender_color FROM messages m JOIN users u ON m.sender_id=u.id WHERE m.id=?`,
    )
    .get(id);
  // Broadcast via WebSocket
  if (chat_type === "group") {
    const allUsers = db
      .prepare("SELECT id FROM users WHERE is_active=1")
      .all()
      .map((u) => u.id);
    emit(allUsers, "new_message", msg);
  } else {
    emit([chat_id, req.user.id], "new_message", msg);
  }
  res.status(201).json(msg);
});

// File upload
app.post("/api/messages/upload", auth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  const size =
    req.file.size < 1048576
      ? `${(req.file.size / 1024).toFixed(1)} KB`
      : `${(req.file.size / 1048576).toFixed(1)} MB`;
  res.json({ url, name: req.file.originalname, size });
});

// ── CONVERSATIONS (DM list) ───────────────────────────────────────────────────
app.get("/api/conversations", auth, (req, res) => {
  const me = req.user.id;
  const rows = db
    .prepare(
      `
    SELECT DISTINCT CASE WHEN sender_id=? THEN chat_id ELSE sender_id END AS other_id
    FROM messages WHERE (sender_id=? OR chat_id=?) AND chat_type='direct'
  `,
    )
    .all(me, me, me);
  const result = rows
    .map((r) => {
      const user = db.prepare("SELECT * FROM users WHERE id=?").get(r.other_id);
      if (!user) return null;
      const last = db
        .prepare(
          `SELECT * FROM messages WHERE ((sender_id=? AND chat_id=?) OR (sender_id=? AND chat_id=?)) AND chat_type='direct' ORDER BY created_at DESC LIMIT 1`,
        )
        .get(me, r.other_id, r.other_id, me);
      const unread =
        db
          .prepare(
            `SELECT COUNT(*) as n FROM messages WHERE chat_id=? AND sender_id=? AND chat_type='direct' AND is_read=0`,
          )
          .get(me, r.other_id)?.n || 0;
      return { user: safeUser(user), last_message: last, unread };
    })
    .filter(Boolean);
  res.json(result);
});

// ── CALLS ─────────────────────────────────────────────────────────────────────
app.get("/api/calls", auth, (req, res) => {
  const calls = db
    .prepare(
      `
    SELECT cl.*,
      cu.name AS caller_name, cu.avatar AS caller_avatar, cu.color AS caller_color,
      ce.name AS callee_name, ce.avatar AS callee_avatar, ce.color AS callee_color
    FROM call_logs cl
    JOIN users cu ON cl.caller_id=cu.id
    JOIN users ce ON cl.callee_id=ce.id
    WHERE cl.caller_id=? OR cl.callee_id=?
    ORDER BY cl.created_at DESC LIMIT 100
  `,
    )
    .all(req.user.id, req.user.id);
  res.json(calls);
});

app.post("/api/calls", auth, (req, res) => {
  const { callee_id, type, duration, status } = req.body;
  const id = uuid();
  db.prepare(
    "INSERT INTO call_logs (id,caller_id,callee_id,type,duration,status) VALUES (?,?,?,?,?,?)",
  ).run(
    id,
    req.user.id,
    callee_id,
    type || "voice",
    duration || 0,
    status || "completed",
  );
  emit([callee_id], "incoming_call", {
    caller_id: req.user.id,
    call_id: id,
    type,
  });
  res.status(201).json({ id });
});

// ── REMINDERS ─────────────────────────────────────────────────────────────────
app.get("/api/reminders", auth, (req, res) => {
  const { view } = req.query;
  const me = req.user.id;
  let where = "";
  const params = [];
  if (view === "mine") {
    where = "WHERE r.for_user_id=?";
    params.push(me);
  } else if (view === "others") {
    where = "WHERE r.created_by=? AND r.for_user_id!=?";
    params.push(me, me);
  } else if (view === "review") {
    where = "WHERE r.status='review'";
  } else if (!req.user.is_super_admin) {
    where = "WHERE r.for_user_id=? OR r.created_by=?";
    params.push(me, me);
  }
  const rems = db
    .prepare(
      `
    SELECT r.*,
      fu.name AS for_name, fu.avatar AS for_avatar, fu.color AS for_color, fu.role AS for_role,
      cu.name AS creator_name, cu.avatar AS creator_avatar
    FROM reminders r
    JOIN users fu ON r.for_user_id=fu.id
    JOIN users cu ON r.created_by=cu.id
    ${where}
    ORDER BY r.created_at DESC
  `,
    )
    .all(...params);
  res.json(rems);
});

app.post("/api/reminders", auth, (req, res) => {
  const { title, note, due_date, priority, for_user_id } = req.body;
  const id = uuid();
  db.prepare(
    "INSERT INTO reminders (id,title,note,due_date,priority,for_user_id,created_by) VALUES (?,?,?,?,?,?,?)",
  ).run(
    id,
    title,
    note || "",
    due_date || null,
    priority || "medium",
    for_user_id || req.user.id,
    req.user.id,
  );
  const rem = db.prepare("SELECT * FROM reminders WHERE id=?").get(id);
  emit([for_user_id, req.user.id], "reminder_created", rem);
  res.status(201).json(rem);
});

app.put("/api/reminders/:id", auth, (req, res) => {
  const { title, note, due_date, priority, for_user_id } = req.body;
  db.prepare(
    "UPDATE reminders SET title=COALESCE(?,title),note=COALESCE(?,note),due_date=COALESCE(?,due_date),priority=COALESCE(?,priority),for_user_id=COALESCE(?,for_user_id),updated_at=CURRENT_TIMESTAMP WHERE id=?",
  ).run(title, note, due_date, priority, for_user_id, req.params.id);
  res.json({ ok: true });
});

app.patch("/api/reminders/:id/status", auth, (req, res) => {
  const { status } = req.body;
  const valid = ["pending", "review", "approved", "rejected"];
  if (!valid.includes(status))
    return res.status(400).json({ error: "Invalid status" });
  const rem = db
    .prepare("SELECT * FROM reminders WHERE id=?")
    .get(req.params.id);
  if (!rem) return res.status(404).json({ error: "Not found" });
  db.prepare(
    "UPDATE reminders SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?",
  ).run(status, req.user.id, req.params.id);
  emit([rem.for_user_id, rem.created_by, req.user.id], "reminder_updated", {
    id: rem.id,
    status,
  });
  res.json({ ok: true });
});

app.delete("/api/reminders/:id", auth, (req, res) => {
  db.prepare("DELETE FROM reminders WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ── STATS ─────────────────────────────────────────────────────────────────────
app.get("/api/stats", auth, adminOnly, (_req, res) =>
  res.json({
    companies: db.prepare("SELECT COUNT(*) as n FROM companies").get().n,
    branches: db.prepare("SELECT COUNT(*) as n FROM branches").get().n,
    departments: db.prepare("SELECT COUNT(*) as n FROM departments").get().n,
    users: db.prepare("SELECT COUNT(*) as n FROM users").get().n,
    messages: db.prepare("SELECT COUNT(*) as n FROM messages").get().n,
    reminders: db.prepare("SELECT COUNT(*) as n FROM reminders").get().n,
  }),
);

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: new Date() }));

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log("staritng seed");

  console.log(`✅  TravKings backend → http://localhost:${PORT}`);
  console.log(`✅  WebSocket         → ws://localhost:${PORT}`);
});
