// server.js — TravKings Chat Backend (kings-auth integrated)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const { WebSocketServer } = require("ws");
const http = require("http");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const connectDB = require("./config/db");

// Chat-specific models only — org/user data lives in kings-auth
const ChatGroup = require("./models/ChatGroup");
const Message = require("./models/Message");
const CallLog = require("./models/CallLog");
const Reminder = require("./models/Reminder");
const UserProfile = require("./models/UserProfile");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 4000;
const AUTH_URL = process.env.KINGS_AUTH_URL || "http://localhost:3000";

connectDB();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log("========== REQUEST ==========");
  console.log("Time:", new Date().toISOString());
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);

  console.log("Params:", req.params);
  console.log("Query:", req.query);
  console.log("Body:", req.body);

  console.log("Headers:", req.headers);

  next();
});

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${uuid()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// ── kings-auth HTTP client ────────────────────────────────────────────────────
const authClient = axios.create({ baseURL: AUTH_URL });

// Service token — long-lived super_admin token for server-to-server calls
let _serviceToken = null,
  _serviceTokenExp = 0;

async function getServiceToken() {
  if (_serviceToken && Date.now() < _serviceTokenExp - 60_000) {
    console.log(
      "[SERVICE-TOKEN] Using cached token (expires:",
      new Date(_serviceTokenExp).toISOString(),
      ")",
    );
    return _serviceToken;
  }
  console.log("[SERVICE-TOKEN] Fetching new token from kings-auth...");
  console.log("[SERVICE-TOKEN] AUTH_URL:", AUTH_URL);
  console.log("[SERVICE-TOKEN] email:", process.env.KINGS_AUTH_SERVICE_EMAIL);
  try {
    const res = await authClient.post("/auth/login/password", {
      email: process.env.KINGS_AUTH_SERVICE_EMAIL,
      password: process.env.KINGS_AUTH_SERVICE_PASSWORD,
    });
    console.log("res for auth verify",res)
    _serviceToken = res.data.token;
    const decoded = jwt.decode(_serviceToken);
    _serviceTokenExp = decoded.exp * 1000;
    console.log(
      "[SERVICE-TOKEN] ✅ Got token, expires:",
      new Date(_serviceTokenExp).toISOString(),
    );
    return _serviceToken;
  } catch (err) {
    console.log(
      "[SERVICE-TOKEN] ❌ Failed:",
      err.response?.status,
      JSON.stringify(err.response?.data),
    );
    throw err;
  }
}

const authHeader = (req) => ({
  headers: { Authorization: req.headers.authorization },
});
const serviceHeader = async () => ({
  headers: { Authorization: `Bearer ${await getServiceToken()}` },
});

// Org data in-memory cache (5-minute TTL)
let _orgCache = null,
  _orgCacheAt = 0;

async function getOrg() {
  if (_orgCache && Date.now() - _orgCacheAt < 5 * 60 * 1000) return _orgCache;
  const svc = await serviceHeader();
  const [coRes, brRes, deRes] = await Promise.all([
    authClient.get("/orgs/companies?limit=100", svc),
    authClient.get("/orgs/branches?limit=100", svc),
    authClient.get("/orgs/departments?limit=100", svc),
  ]);
  // /orgs/branches returns grouped: [{company: {_id,name,code}, branches: [...]}]
  // flatten to a plain array with company_id injected on each branch
  const branchGroups = brRes.data.data || [];
  const flatBranches = branchGroups.flatMap((g) =>
    (g.branches || []).map((b) => ({ ...b, company_id: String(g.company?._id || '') })),
  );

  _orgCache = {
    companies: coRes.data.data || [],
    branches: flatBranches,
    departments: deRes.data.data || [],
  };
  _orgCacheAt = Date.now();
  return _orgCache;
}

const invalidateOrgCache = () => {
  _orgCacheAt = 0;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Cache verified tokens for 60 s to avoid calling kings-auth on every request
const _tokenCache = new Map(); // token → { user, cachedAt }

async function verifyToken(token) {
  const cached = _tokenCache.get(token);
  if (cached && Date.now() - cached.cachedAt < 60_000) return cached.user;

  // kings-auth confirms blacklist/revocation/active status
  const kRes = await authClient.post("/auth/token/verify", { token });
  if (!kRes.data.valid) throw new Error("Token invalid or expired");

  // kings-auth's response schema strips payload fields (Fastify serializer limitation).
  // Decode locally — safe because validity was already confirmed above.
  const p = jwt.decode(token);
  if (!p?.sub) throw new Error("Token missing sub claim");

  const user = {
    id: p.sub,
    email: p.email,
    name: p.name,
    jti: p.jti,
    roleAssignments: p.roleAssignments || [],
    is_super_admin: (p.roleAssignments || []).some(
      (ra) => ra.role === "super_admin",
    ),
  };
  _tokenCache.set(token, { user, cachedAt: Date.now() });
  return user;
}

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorised" });
  try {
    req.user = await verifyToken(token);
    console.log("auth midleware pass");
    next();
  } catch (err) {
    console.log("[AUTH] ❌", err.response?.data || err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
};

const adminOnly = (req, res, next) =>
  req.user.is_super_admin
    ? next()
    : res.status(403).json({ error: "Admin only" });

const toPlain = (doc) => ({ ...doc.toObject(), id: String(doc._id) });

// Shape a kings-auth user + local UserProfile into what the frontend expects
const mergeUser = (authUser, profile) => ({
  id: String(authUser._id),
  name: authUser.name,
  email: authUser.email,
  mobile: authUser.mobile || "",
  role:
    authUser.designation ||
    profile?.role ||
    authUser.roleAssignments?.[0]?.role ||
    "User",
  avatar: profile?.avatar || "👤",
  color: profile?.color || "#60A5FA",
  is_super_admin: (authUser.roleAssignments || []).some(
    (ra) => ra.role === "super_admin",
  ),
  is_active: authUser.isActive !== false,
  last_seen: authUser.updatedAt || null,
  companies: (authUser.roleAssignments || [])
    .filter((ra) => ra.entityType === "company")
    .map((ra) => String(ra.entityId)),
  branches: (authUser.roleAssignments || [])
    .filter((ra) => ra.entityType === "branch")
    .map((ra) => String(ra.entityId)),
  departments: (authUser.roleAssignments || [])
    .filter((ra) => ra.entityType === "department")
    .map((ra) => String(ra.entityId)),
});

// Normalise kings-auth branch → frontend shape
// b.company may be an ObjectId string (from createBranch response) or undefined (from grouped list).
// b.company_id is injected by getOrg() flatten when coming from the grouped endpoint.
const normalizeBranch = (b) => ({
  id: String(b._id),
  name: b.name,
  city: b.address || b.name,
  avatar: b.avatar || "🌿",
  color: b.color || "#10B981",
  company_id: String(b.company_id || b.company || ""),
});

// Normalise kings-auth company → frontend shape (includes nested branches)
const normalizeCompany = (c, allBranches = []) => ({
  id: String(c._id),
  name: c.name,
  tagline: c.description || "",
  avatar: c.avatar || "🏢",
  color: c.color || "#3B82F6",
  branches: allBranches
    .filter((b) => String(b.company_id || b.company || "") === String(c._id))
    .map(normalizeBranch),
});

// Normalise kings-auth department → frontend shape
// d.branch and d.company may be populated objects {_id, name, code} from listAllDepartments()
// or plain ObjectId strings from createDepartment().
const normalizeDept = (d) => ({
  id: String(d._id),
  name: d.name,
  short_name: d.code || d.name.slice(0, 4).toUpperCase(),
  icon: d.icon || "🏷️",
  color: d.color || "#8B5CF6",
  branch_id: String(d.branch?._id || d.branch || d.branch_id || ""),
  company_id: String(d.company?._id || d.company || d.company_id || ""),
});

// Flatten a populated message document into what the frontend expects
const fmtMsg = (msg) => {
  const obj = msg.toObject ? msg.toObject() : { ...msg };
  const sender = obj.sender_id;
  const isPop = sender && typeof sender === "object";
  return {
    ...obj,
    id: String(obj._id),
    sender_id: isPop ? String(sender._id) : sender,
    sender_name: isPop ? sender.name || "" : "",
    sender_avatar: isPop ? sender.avatar || "👤" : "👤",
    sender_color: isPop ? sender.color || "#3B82F6" : "#3B82F6",
  };
};

// ── WebSocket ─────────────────────────────────────────────────────────────────
// clients Map: userId → { ws, roleAssignments }
const clients = new Map();

const emit = (userIds, event, data) => {
  const payload = JSON.stringify({ event, data });
  [...new Set(userIds)].forEach((id) => {
    const entry = clients.get(String(id));
    if (entry?.ws?.readyState === 1) entry.ws.send(payload);
  });
};

wss.on("connection", async (ws, req) => {
  const token = new URL(req.url, "ws://x").searchParams.get("token");
  try {
    const user = await verifyToken(token);
    const userId = user.id;
    const roleAssignments = user.roleAssignments || [];

    clients.set(userId, { ws, roleAssignments });

    // Notify other connected users
    const others = [...clients.keys()].filter((id) => id !== userId);
    emit(others, "user_presence", { userId, status: "online" });

    // Send current online snapshot to new client
    ws.send(
      JSON.stringify({
        event: "online_users_snapshot",
        data: { userIds: [...clients.keys()] },
      }),
    );

    ws.on("message", (raw) => {
      try {
        const frame = JSON.parse(raw);
        if (frame.type === "typing") {
          emit(
            [...clients.keys()].filter((id) => id !== userId),
            "user_typing",
            {
              chatId: frame.chatId,
              chatType: frame.chatType,
              userId,
              isTyping: frame.isTyping,
            },
          );
        }
      } catch {}
    });

    ws.on("close", () => {
      clients.delete(userId);
      emit([...clients.keys()], "user_presence", { userId, status: "offline" });
    });

    ws.send(JSON.stringify({ event: "connected", data: { userId } }));
  } catch {
    ws.close();
  }
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  try {
    const kRes = await authClient.post("/auth/login/password", req.body);
    
    if (!kRes.data.success)

      return res.status(401).json({ error: "Invalid credentials" });

    // Pass through MFA flow unchanged
    if (kRes.data.mfaRequired) return res.json(kRes.data);

    const token = kRes.data.token;
    const decoded = jwt.decode(token);
    const userId = decoded.sub;

    // Upsert UserProfile so avatar/color exist from first login
    await UserProfile.findOneAndUpdate(
      { _id: userId },
      {
        $setOnInsert: {
          _id: userId,
          name: decoded.name,
          avatar: "👤",
          color: "#60A5FA",
          role: decoded.roleAssignments?.[0]?.role || "User",
        },
      },
      { upsert: true, new: true },
    );

    const profile = await UserProfile.findById(userId);
    res.json({
      token,
      user: {
        id: userId,
        name: decoded.name,
        email: decoded.email,
        role: profile?.role || "User",
        avatar: profile?.avatar || "👤",
        color: profile?.color || "#60A5FA",
        is_super_admin: (decoded.roleAssignments || []).some(
          (ra) => ra.role === "super_admin",
        ),
      },
    });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message;
    res.status(e.response?.status || 500).json({ error: msg });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const svc = await serviceHeader();
    const kRes = await authClient.post("/auth/register", req.body, svc);
    res.status(201).json(kRes.data);
  } catch (e) {
    res
      .status(e.response?.status || 500)
      .json({ error: e.response?.data?.error?.message || e.message });
  }
});

app.get("/api/auth/me", auth, async (req, res) => {
  try {
    const profile = await UserProfile.findById(req.user.id);
    res.json({
      id:             req.user.id,
      name:           req.user.name,
      email:          req.user.email,
      mobile:         req.user.mobile || "",
      role:           profile?.role || req.user.roleAssignments?.[0]?.role || "User",
      avatar:         profile?.avatar || "👤",
      color:          profile?.color  || "#60A5FA",
      is_super_admin: req.user.is_super_admin,
      is_active:      true,
      roleAssignments: req.user.roleAssignments || [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/auth/profile", auth, async (req, res) => {
  const { name, avatar, color, role } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (avatar !== undefined) update.avatar = avatar;
  if (color !== undefined) update.color = color;
  if (role !== undefined) update.role = role;
  await UserProfile.findOneAndUpdate({ _id: req.user.id }, update, {
    upsert: true,
  });
  res.json({ ok: true });
});

app.put("/api/auth/password", auth, async (req, res) => {
  try {
    const { new_password } = req.body;
    const svc = await serviceHeader();
    await authClient.post(
      "/auth/password/admin-reset",
      { userId: req.user.id, newPassword: new_password },
      svc,
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
});

// ── USERS ─────────────────────────────────────────────────────────────────────
app.get("/api/users/online", auth, (_req, res) => {
  res.json([...clients.keys()]);
});

app.get("/api/users", auth, async (_req, res) => {
  try {
    const svc = await serviceHeader();
    const kRes = await authClient.get("/users?limit=100", svc);
    const authUsers = kRes.data.data || [];
    const ids = authUsers.map((u) => String(u._id));
    const profiles = await UserProfile.find({ _id: { $in: ids } });
    const pMap = Object.fromEntries(profiles.map((p) => [p._id, p]));
    res.json(authUsers.map((u) => mergeUser(u, pMap[String(u._id)])));
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
});

app.get("/api/users/search", auth, async (req, res) => {
  try {
    const svc = await serviceHeader();
    const kRes = await authClient.get(
      `/users?search=${encodeURIComponent(req.query.q || "")}&limit=50`,
      svc,
    );
    const authUsers = kRes.data.data || [];
    const ids = authUsers.map((u) => String(u._id));
    const profiles = await UserProfile.find({ _id: { $in: ids } });
    const pMap = Object.fromEntries(profiles.map((p) => [p._id, p]));
    res.json(authUsers.map((u) => mergeUser(u, pMap[String(u._id)])));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/users", auth, adminOnly, async (req, res) => {
  try {
    const {
      name,
      email,
      mobile,
      password,
      role,
      avatar,
      color,
      is_super_admin,
      companies = [],
      branches = [],
      departments = [],
    } = req.body;
    const svc = await serviceHeader();

    const roleAssignments = is_super_admin
      ? [
          {
            role: "super_admin",
            entityType: "organisation",
            entityId: "000000000000000000000000",
          },
        ]
      : [
          ...companies.map((c) => ({
            role: "company_manager",
            entityType: "company",
            entityId: c,
          })),
          ...branches.map((b) => ({
            role: "employee",
            entityType: "branch",
            entityId: b,
          })),
          ...departments.map((d) => ({
            role: "employee",
            entityType: "department",
            entityId: d,
          })),
        ];

    const kRes = await authClient.post(
      "/users",
      {
        name,
        email,
        mobile: mobile || email,
        password,
        designation: role,
        roleAssignments,
      },
      svc,
    );
    const authUser = kRes.data.user || kRes.data.data || kRes.data;
    const userId = String(authUser._id);

    await UserProfile.findOneAndUpdate(
      { _id: userId },
      {
        $setOnInsert: {
          _id: userId,
          name,
          avatar: avatar || "👤",
          color: color || "#60A5FA",
          role: role || "User",
        },
      },
      { upsert: true, new: true },
    );
    const profile = await UserProfile.findById(userId);
    res.status(201).json(mergeUser(authUser, profile));
  } catch (e) {
    res
      .status(e.response?.status || 500)
      .json({ error: e.response?.data?.error?.message || e.message });
  }
});

app.put("/api/users/:id", auth, adminOnly, async (req, res) => {
  try {
    const { name, role, avatar, color, is_active } = req.body;
    const svc = await serviceHeader();

    await authClient.patch(
      `/users/${req.params.id}`,
      { name, designation: role },
      svc,
    );

    if (is_active === false)
      await authClient.post(`/users/${req.params.id}/deactivate`, {}, svc);
    else if (is_active === true)
      await authClient.post(`/users/${req.params.id}/activate`, {}, svc);

    const profileUpdate = {};
    if (name !== undefined) profileUpdate.name = name;
    if (avatar !== undefined) profileUpdate.avatar = avatar;
    if (color !== undefined) profileUpdate.color = color;
    if (role !== undefined) profileUpdate.role = role;
    if (Object.keys(profileUpdate).length) {
      await UserProfile.findOneAndUpdate(
        { _id: req.params.id },
        profileUpdate,
        { upsert: true },
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
});

app.delete("/api/users/:id", auth, adminOnly, async (req, res) => {
  try {
    const svc = await serviceHeader();
    await authClient.delete(`/users/${req.params.id}`, svc);
    await UserProfile.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
});

// ── COMPANIES ─────────────────────────────────────────────────────────────────
app.get("/api/companies", auth, async (_req, res) => {
  try {
    const { companies, branches } = await getOrg();
    res.json(companies.map((c) => normalizeCompany(c, branches)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/companies", auth, async (req, res) => {
  try {
    console.log("req.body  ---",req.body)
    const { name, tagline, description, code: reqCode } = req.body;
    // kings-auth requires a unique `code` (2-20 chars). Derive from name if not supplied.
    const code = (reqCode || (name || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 10) || 'ORG').toUpperCase();
    const svc = await serviceHeader();
    const kRes = await authClient.post("/orgs/companies", {
      name,
      code,
      description: tagline || description,
    }, svc);
    console.log("[create company] kings-auth response:", kRes.data);
    invalidateOrgCache();
    res.status(201).json({ ...normalizeCompany(kRes.data.data || kRes.data), branches: [] });
  } catch (e) {
    console.log("[create company] error:", e.response?.data || e.message);
    res.status(e.response?.status || 500).json({ error: e.response?.data?.error?.message || e.message });
  }
});

app.put("/api/companies/:id", auth, adminOnly, async (req, res) => {
  try {
    const { name, tagline, description } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (tagline !== undefined || description !== undefined) update.description = tagline || description;
    const svc = await serviceHeader();
    await authClient.patch(`/orgs/companies/${req.params.id}`, update, svc);
    invalidateOrgCache();
    res.json({ ok: true });
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.response?.data?.error?.message || e.message });
  }
});

app.delete("/api/companies/:id", auth, adminOnly, async (req, res) => {
  try {
    const svc = await serviceHeader();
    await authClient.delete(`/orgs/companies/${req.params.id}`, svc);
    invalidateOrgCache();
    res.json({ ok: true });
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
});

// ── BRANCHES ──────────────────────────────────────────────────────────────────
app.get("/api/branches", auth, async (req, res) => {
  try {
    const { branches } = await getOrg();
    const filtered = req.query.company_id
      ? branches.filter(
          (b) => String(b.company_id || b.company || "") === req.query.company_id,
        )
      : branches;
    res.json(filtered.map(normalizeBranch));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/branches", auth, adminOnly, async (req, res) => {
  try {
    const { company_id, name, city } = req.body;
    const svc = await serviceHeader();
    const kRes = await authClient.post(
      `/orgs/companies/${company_id}/branches`,
      { name, address: city || name, code: name.slice(0, 4).toUpperCase() },
      svc,
    );
    const branch = kRes.data.data || kRes.data;
    const branchId = String(branch._id);
    invalidateOrgCache();

    // Auto-create chat groups for every department
    const { departments } = await getOrg();
    if (departments.length) {
      await ChatGroup.insertMany(
        departments.map((d) => ({
          _id: uuid(),
          branch_id: branchId,
          department_id: String(d._id),
          name: `${name.split(" ")[0]} ${d.code || d.name.slice(0, 4).toUpperCase()}`,
        })),
      );
    }
    res.status(201).json(normalizeBranch(branch));
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
});

app.put("/api/branches/:id", auth, adminOnly, async (req, res) => {
  try {
    const { branches } = await getOrg();
    const branch = branches.find((b) => String(b._id) === req.params.id);
    if (!branch) return res.status(404).json({ error: "Branch not found" });
    const svc = await serviceHeader();
    await authClient.patch(
      `/orgs/companies/${String(branch.company_id || branch.company || "")}/branches/${req.params.id}`,
      { name: req.body.name, address: req.body.city },
      svc,
    );
    invalidateOrgCache();
    res.json({ ok: true });
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
});

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────
app.get("/api/departments", auth, async (_req, res) => {
  try {
    const { departments } = await getOrg();
    res.json(departments.map(normalizeDept));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/departments", auth, adminOnly, async (req, res) => {
  try {
    const { name, short_name, icon, color, branch_id, company_id } = req.body;
    const svc = await serviceHeader();
    const kRes = await authClient.post(
      `/orgs/companies/${company_id}/branches/${branch_id}/departments`,
      {
        name,
        code: short_name || name.slice(0, 4).toUpperCase(),
        description: icon || "",
      },
      svc,
    );
    const dept = kRes.data.data || kRes.data;
    const deptId = String(dept._id);
    invalidateOrgCache();

    // Auto-create chat group for every branch
    const { branches } = await getOrg();
    if (branches.length) {
      await ChatGroup.insertMany(
        branches.map((b) => ({
          _id: uuid(),
          branch_id: String(b._id),
          department_id: deptId,
          name: `${b.name.split(" ")[0]} ${short_name || name.slice(0, 4).toUpperCase()}`,
        })),
      );
    }
    res.status(201).json(normalizeDept(dept));
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
});

// ── CHAT GROUPS ───────────────────────────────────────────────────────────────
app.get("/api/chat-groups", auth, async (req, res) => {
  try {
    const { branches, departments } = await getOrg();
    const branchMap = Object.fromEntries(
      branches.map((b) => [String(b._id), b]),
    );
    const deptMap = Object.fromEntries(
      departments.map((d) => [String(d._id), d]),
    );

    // Super admins see all groups; others see only their branch+dept groups
    let groups;
    if (req.user.is_super_admin) {
      groups = await ChatGroup.find({});
    } else {
      const myBranchIds = req.user.roleAssignments
        .filter((ra) => ra.entityType === "branch")
        .map((ra) => String(ra.entityId));
      const myDeptIds = req.user.roleAssignments
        .filter((ra) => ra.entityType === "department")
        .map((ra) => String(ra.entityId));
      groups = await ChatGroup.find({
        branch_id: { $in: myBranchIds },
        department_id: { $in: myDeptIds },
      });
    }

    const enriched = await Promise.all(
      groups.map(async (g) => {
        const branch = branchMap[g.branch_id] || {};
        const dept = deptMap[g.department_id] || {};
        const unread = await Message.countDocuments({
          chat_id: String(g._id),
          chat_type: "group",
          sender_id: { $ne: req.user.id },
          is_read: false,
        });
        const lastMsg = await Message.findOne({
          chat_id: String(g._id),
          chat_type: "group",
        }).sort({ created_at: -1 });
        return {
          ...g.toObject(),
          id: String(g._id),
          branch_name: branch.name || "",
          city: branch.address || branch.name || "",
          branch_avatar: branch.avatar || "🌿",
          branch_color: branch.color || "#10B981",
          company_id: String(branch.company_id || branch.company || ""),
          dept_name: dept.name || "",
          short_name: dept.code || dept.name?.slice(0, 4).toUpperCase() || "",
          dept_icon: dept.icon || "🏷️",
          dept_color: dept.color || "#8B5CF6",
          unread,
          last_message: lastMsg ? fmtMsg(lastMsg) : null,
        };
      }),
    );
    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch(
  "/api/chat-groups/:id/permission",
  auth,
  adminOnly,
  async (req, res) => {
    const { send_permission } = req.body;
    if (!["all", "managers_only"].includes(send_permission))
      return res.status(400).json({ error: "Invalid permission" });
    const group = await ChatGroup.findByIdAndUpdate(
      req.params.id,
      { send_permission },
      { new: true },
    );
    if (!group) return res.status(404).json({ error: "Not found" });
    res.json(toPlain(group));
  },
);

// ── MESSAGES ──────────────────────────────────────────────────────────────────
// search MUST be registered before /:chatType/:chatId to avoid Express matching "search" as a param
app.get("/api/messages/search", auth, async (req, res) => {
  const { q, chat_type, chat_id } = req.query;
  if (!q) return res.status(400).json({ error: "q is required" });
  const filter = { content: { $regex: q, $options: "i" } };
  if (chat_type) filter.chat_type = chat_type;
  if (chat_id) filter.chat_id = chat_id;
  const msgs = await Message.find(filter)
    .populate({ path: "sender_id", select: "name avatar color" })
    .sort({ created_at: -1 })
    .limit(50);
  res.json(msgs.map(fmtMsg));
});

app.get("/api/messages/:chatType/:chatId", auth, async (req, res) => {
  const { chatType, chatId } = req.params;
  const me = req.user.id;
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before;

  // For DMs, fetch both directions: messages I sent to them AND messages they sent to me
  let query;
  if (chatType === "direct") {
    query = {
      chat_type: "direct",
      $or: [
        { chat_id: chatId, sender_id: me },
        { chat_id: me,     sender_id: chatId },
      ],
    };
  } else {
    query = { chat_id: chatId, chat_type: chatType };
  }
  if (before) query.created_at = { $lt: new Date(before) };

  const msgs = await Message.find(query)
    .populate({ path: "sender_id", select: "_id name avatar color" })
    .sort({ created_at: -1 })
    .limit(limit);

  const readFilter = chatType === "direct"
    ? { chat_type: "direct", chat_id: me, sender_id: chatId, is_read: false }
    : { chat_id: chatId, chat_type: chatType, sender_id: { $ne: me }, is_read: false };

  const unread = await Message.find(readFilter, "sender_id");
  await Message.updateMany(readFilter, { $set: { is_read: true } });
  [...new Set(unread.map((m) => String(m.sender_id)))].forEach((senderId) => {
    const entry = clients.get(senderId);
    if (entry?.ws?.readyState === 1) {
      entry.ws.send(
        JSON.stringify({
          event: "message_read",
          data: { chatId, chatType, readBy: req.user.id },
        }),
      );
    }
  });
  res.json(msgs.reverse().map(fmtMsg));
});

app.post("/api/messages", auth, async (req, res) => {
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

  if (chat_type === "group") {
    const group = await ChatGroup.findById(chat_id);
    if (group?.send_permission === "managers_only") {
      const isManager =
        req.user.is_super_admin ||
        req.user.roleAssignments.some((ra) =>
          ["super_admin", "company_manager", "branch_manager", "hod"].includes(
            ra.role,
          ),
        );
      if (!isManager)
        return res
          .status(403)
          .json({ error: "Only managers can send messages in this group" });
    }
  }

  const id = uuid();
  await Message.create({
    _id: id,
    chat_id,
    chat_type,
    sender_id: req.user.id,
    type: type || "text",
    content: content || null,
    file_url: file_url || null,
    file_name: file_name || null,
    file_size: file_size || null,
    duration: duration || null,
  });
  const populatedMsg = await Message.findById(id).populate({
    path: "sender_id",
    select: "_id name avatar color",
  });
  const formatted = fmtMsg(populatedMsg);

  if (chat_type === "group") {
    const group = await ChatGroup.findById(chat_id);
    if (group) {
      // Broadcast to connected users who belong to this branch+dept, plus all super_admins
      const memberIds = [...clients.keys()].filter((uid) => {
        const ra = clients.get(uid)?.roleAssignments || [];
        if (ra.some((r) => r.role === "super_admin")) return true;
        return (
          ra.some((r) => String(r.entityId) === String(group.branch_id)) &&
          ra.some((r) => String(r.entityId) === String(group.department_id))
        );
      });
      emit(memberIds, "new_message", formatted);
    }
  } else {
    emit([chat_id, req.user.id], "new_message", formatted);
  }
  res.status(201).json(formatted);
});

app.put("/api/messages/:id", auth, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: "Not found" });
    if (String(msg.sender_id) !== req.user.id)
      return res.status(403).json({ error: "Forbidden" });
    msg.content = req.body.content;
    msg.is_edited = true;
    msg.edited_at = new Date();
    await msg.save();
    const populated = await Message.findById(msg._id).populate({
      path: "sender_id",
      select: "name avatar color",
    });
    const formatted = fmtMsg(populated);
    emit([...clients.keys()], "message_updated", formatted);
    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/messages/:id", auth, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: "Not found" });
    if (String(msg.sender_id) !== req.user.id)
      return res.status(403).json({ error: "Forbidden" });
    msg.is_deleted = true;
    msg.content = "This message was deleted";
    await msg.save();
    emit([...clients.keys()], "message_updated", fmtMsg(msg));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/messages/upload", auth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  const size =
    req.file.size < 1_048_576
      ? `${(req.file.size / 1024).toFixed(1)} KB`
      : `${(req.file.size / 1_048_576).toFixed(1)} MB`;
  res.json({ url, name: req.file.originalname, size });
});

// ── CONVERSATIONS (DM list) ───────────────────────────────────────────────────
app.get("/api/conversations", auth, async (req, res) => {
  const me = req.user.id;
  const messages = await Message.find({
    $or: [{ sender_id: me }, { chat_id: me }],
    chat_type: "direct",
  }).sort({ created_at: -1 });

  const map = new Map();
  for (const msg of messages) {
    const otherId =
      String(msg.sender_id) === me
        ? String(msg.chat_id)
        : String(msg.sender_id);
    if (!map.has(otherId)) map.set(otherId, { last_message: msg, unread: 0 });
    if (String(msg.chat_id) === me && !msg.is_read) map.get(otherId).unread++;
  }

  const result = await Promise.all(
    [...map.entries()].map(async ([otherId, convo]) => {
      const profile = await UserProfile.findById(otherId);
      if (!profile) return null;
      return {
        user: {
          id: profile._id,
          name: profile.name,
          avatar: profile.avatar,
          color: profile.color,
          role: profile.role,
        },
        last_message: convo.last_message,
        unread: convo.unread,
      };
    }),
  );
  res.json(result.filter(Boolean));
});

// ── CALLS ─────────────────────────────────────────────────────────────────────
app.get("/api/calls", auth, async (req, res) => {
  const calls = await CallLog.find({
    $or: [{ caller_id: req.user.id }, { callee_id: req.user.id }],
  })
    .populate({ path: "caller_id", select: "name avatar color" })
    .populate({ path: "callee_id", select: "name avatar color" })
    .sort({ created_at: -1 })
    .limit(100);
  res.json(calls);
});

app.post("/api/calls", auth, async (req, res) => {
  const { callee_id, type, duration, status } = req.body;
  const id = uuid();
  const call = await CallLog.create({
    _id: id,
    caller_id: req.user.id,
    callee_id,
    type: type || "voice",
    duration: duration || 0,
    status: status || "completed",
  });
  emit([callee_id], "incoming_call", {
    caller_id: req.user.id,
    call_id: id,
    type,
  });
  res.status(201).json({ id: call._id });
});

// ── REMINDERS ─────────────────────────────────────────────────────────────────
app.get("/api/reminders", auth, async (req, res) => {
  const { view } = req.query;
  const me = req.user.id;
  let query = {};
  if (view === "mine") query = { for_user_id: me };
  else if (view === "others")
    query = { created_by: me, for_user_id: { $ne: me } };
  else if (view === "review")
    query = req.user.is_super_admin
      ? { status: "review" }
      : { status: "review", created_by: me };
  else if (view === "all") {
    if (!req.user.is_super_admin)
      query = { $or: [{ for_user_id: me }, { created_by: me }] };
  } else if (!req.user.is_super_admin)
    query = { $or: [{ for_user_id: me }, { created_by: me }] };

  const rems = await Reminder.find(query)
    .populate({ path: "for_user_id", select: "_id name avatar color role" })
    .populate({ path: "created_by", select: "_id name avatar" })
    .sort({ created_at: -1 });
  const result = rems.map((r) => ({ ...r.toObject(), id: String(r._id) }));
  res.json(result);
});

app.post("/api/reminders", auth, async (req, res) => {
  const { title, note, due_date, priority, for_user_id } = req.body;
  const id = uuid();
  const rem = await Reminder.create({
    _id: id,
    title,
    note: note || "",
    due_date: due_date || null,
    priority: priority || "medium",
    for_user_id: for_user_id || req.user.id,
    created_by: req.user.id,
  });
  emit([for_user_id, req.user.id], "reminder_created", rem);
  res.status(201).json(rem);
});

app.put("/api/reminders/:id", auth, async (req, res) => {
  const rem = await Reminder.findById(req.params.id);
  if (!rem) return res.status(404).json({ error: "Not found" });
  const isAssignee = String(rem.for_user_id) === req.user.id;
  if (!isAssignee && !req.user.is_super_admin)
    return res.status(403).json({ error: "Only the assignee can edit this reminder" });
  const { title, note, due_date, priority } = req.body;
  await Reminder.findByIdAndUpdate(req.params.id, {
    title, note, due_date, priority, updated_at: new Date(),
  });
  res.json({ ok: true });
});

app.patch("/api/reminders/:id/status", auth, async (req, res) => {
  const { status, rejection_reason } = req.body;
  if (!["pending", "review", "approved", "rejected"].includes(status))
    return res.status(400).json({ error: "Invalid status" });
  const rem = await Reminder.findById(req.params.id);
  if (!rem) return res.status(404).json({ error: "Not found" });

  const me = req.user.id;
  const isAssignee = String(rem.for_user_id) === me;
  const isCreator  = String(rem.created_by)  === me;

  if (status === "review") {
    if (!isAssignee && !req.user.is_super_admin)
      return res.status(403).json({ error: "Only the assignee can submit for review" });
  } else {
    // approved / rejected / pending (reassign) — creator or super_admin only
    if (!isCreator && !req.user.is_super_admin)
      return res.status(403).json({ error: "Only the creator can approve or reject" });
  }

  const update = {
    status,
    reviewed_by: req.user.id,
    reviewed_at: new Date(),
    updated_at: new Date(),
  };
  if (rejection_reason) update.rejection_reason = rejection_reason;
  await Reminder.findByIdAndUpdate(req.params.id, update);
  emit(
    [String(rem.for_user_id), String(rem.created_by), req.user.id],
    "reminder_updated",
    { id: String(rem._id), status, rejection_reason: rejection_reason || "" },
  );
  res.json({ ok: true });
});

app.delete("/api/reminders/:id", auth, async (req, res) => {
  await Reminder.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ── STATS ─────────────────────────────────────────────────────────────────────
app.get("/api/stats", auth, adminOnly, async (_req, res) => {
  try {
    const { companies, branches, departments } = await getOrg();
    const svc = await serviceHeader();
    const usersRes = await authClient.get("/users?limit=1", svc);
    res.json({
      companies: companies.length,
      branches: branches.length,
      departments: departments.length,
      users: usersRes.data.meta?.total || 0,
      messages: await Message.countDocuments(),
      reminders: await Reminder.countDocuments(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: new Date() }));

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`✅  Chat backend  → http://localhost:${PORT}`);
  console.log(`✅  WebSocket     → ws://localhost:${PORT}`);
  console.log(`✅  kings-auth    → ${AUTH_URL}`);
});

process.on("SIGINT", () => server.close(() => process.exit(0)));
