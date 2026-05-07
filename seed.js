// seed.js — Run once to populate dummy data
// Usage: node seed.js
// Run from backend folder: cd backend && node seed.js

const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const path = require("path");

const db = new Database(path.join(__dirname, "travkings.db"));
db.pragma("foreign_keys = ON");

console.log("🌱 Starting seed...\n");

// ── Helper ────────────────────────────────────────────────────────────────────
const now = () => new Date().toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const hoursAgo = (n) => new Date(Date.now() - n * 3600000).toISOString();
const minsAgo = (n) => new Date(Date.now() - n * 60000).toISOString();

// ── Clear existing data (fresh seed) ─────────────────────────────────────────
console.log("🗑️  Clearing existing data...");
db.exec(`
  DELETE FROM reminders;
  DELETE FROM call_logs;
  DELETE FROM messages;
  DELETE FROM chat_groups;
  DELETE FROM user_departments;
  DELETE FROM user_branches;
  DELETE FROM user_companies;
  DELETE FROM users;
  DELETE FROM branches;
  DELETE FROM companies;
  DELETE FROM departments;
`);
console.log("✅ Cleared\n");

// ── Departments ───────────────────────────────────────────────────────────────
console.log("🏷️  Seeding departments...");
const DEPTS = [
  {
    id: "dept_mktg",
    name: "Marketing",
    short_name: "MKTG",
    icon: "📣",
    color: "#F59E0B",
  },
  {
    id: "dept_fin",
    name: "Finance",
    short_name: "FIN",
    icon: "💰",
    color: "#10B981",
  },
  {
    id: "dept_tkt",
    name: "Ticketing",
    short_name: "TKT",
    icon: "🎫",
    color: "#3B82F6",
  },
  {
    id: "dept_hol",
    name: "Holidays",
    short_name: "HOL",
    icon: "🌴",
    color: "#EC4899",
  },
  {
    id: "dept_bm",
    name: "Branch Manager",
    short_name: "BM",
    icon: "🏢",
    color: "#8B5CF6",
  },
  {
    id: "dept_gm",
    name: "General Manager",
    short_name: "GM",
    icon: "👔",
    color: "#EF4444",
  },
];
const insDept = db.prepare(
  "INSERT OR IGNORE INTO departments (id,name,short_name,icon,color) VALUES (?,?,?,?,?)",
);
DEPTS.forEach((d) => insDept.run(d.id, d.name, d.short_name, d.icon, d.color));
console.log(`✅ ${DEPTS.length} departments\n`);

// ── Companies ─────────────────────────────────────────────────────────────────
console.log("🏢 Seeding companies...");
const COMPANIES = [
  {
    id: "co_tk",
    name: "TravKings",
    tagline: "Travel & Tourism",
    avatar: "✈️",
    color: "#3B82F6",
  },
  {
    id: "co_hkp",
    name: "Hotel Kings Palace",
    tagline: "Luxury Hospitality",
    avatar: "🏨",
    color: "#D97706",
  },
  {
    id: "co_qa",
    name: "Quin Aliza",
    tagline: "Premium Services",
    avatar: "💜",
    color: "#8B5CF6",
  },
  {
    id: "co_kl",
    name: "Kings Logistics",
    tagline: "Logistics & Supply Chain",
    avatar: "🚛",
    color: "#10B981",
  },
];
const insCo = db.prepare(
  "INSERT OR IGNORE INTO companies (id,name,tagline,avatar,color) VALUES (?,?,?,?,?)",
);
COMPANIES.forEach((c) => insCo.run(c.id, c.name, c.tagline, c.avatar, c.color));
console.log(`✅ ${COMPANIES.length} companies\n`);

// ── Branches ──────────────────────────────────────────────────────────────────
console.log("🌿 Seeding branches...");
const BRANCHES = [
  // TravKings
  {
    id: "br_amd",
    company_id: "co_tk",
    name: "AMD Branch",
    city: "Ahmedabad",
    avatar: "🏙️",
    color: "#6366F1",
  },
  {
    id: "br_bom",
    company_id: "co_tk",
    name: "BOM Branch",
    city: "Mumbai",
    avatar: "🌊",
    color: "#0EA5E9",
  },
  {
    id: "br_dar",
    company_id: "co_tk",
    name: "DAR Branch",
    city: "Dar es Salaam",
    avatar: "🌍",
    color: "#10B981",
  },
  {
    id: "br_nbo",
    company_id: "co_tk",
    name: "NBO Branch",
    city: "Nairobi",
    avatar: "🦁",
    color: "#F59E0B",
  },
  {
    id: "br_drc",
    company_id: "co_tk",
    name: "DRC Branch",
    city: "Kinshasa",
    avatar: "🌿",
    color: "#EC4899",
  },
  // Hotel Kings Palace
  {
    id: "br_lshi_hkp",
    company_id: "co_hkp",
    name: "Lshi Branch",
    city: "Lshi",
    avatar: "🏨",
    color: "#D97706",
  },
  // Quin Aliza
  {
    id: "br_lshi_qa",
    company_id: "co_qa",
    name: "Lshi Branch",
    city: "Lshi",
    avatar: "🌟",
    color: "#8B5CF6",
  },
  // Kings Logistics
  {
    id: "br_lshi_kl",
    company_id: "co_kl",
    name: "Lshi Branch",
    city: "Lshi",
    avatar: "📦",
    color: "#10B981",
  },
  {
    id: "br_dar_kl",
    company_id: "co_kl",
    name: "DAR Branch",
    city: "Dar es Salaam",
    avatar: "🌍",
    color: "#F59E0B",
  },
];
const insBr = db.prepare(
  "INSERT OR IGNORE INTO branches (id,company_id,name,city,avatar,color) VALUES (?,?,?,?,?,?)",
);
BRANCHES.forEach((b) =>
  insBr.run(b.id, b.company_id, b.name, b.city, b.avatar, b.color),
);
console.log(`✅ ${BRANCHES.length} branches\n`);

// ── Chat Groups (auto create for each branch × dept) ──────────────────────────
console.log("💬 Seeding chat groups...");
const insGrp = db.prepare(
  "INSERT OR IGNORE INTO chat_groups (id,branch_id,department_id,name) VALUES (?,?,?,?)",
);
let grpCount = 0;
BRANCHES.forEach((br) => {
  DEPTS.forEach((d) => {
    const code = br.name.split(" ")[0];
    insGrp.run(uuid(), br.id, d.id, `${code} ${d.short_name}`);
    grpCount++;
  });
});
console.log(`✅ ${grpCount} chat groups\n`);

// ── Users ─────────────────────────────────────────────────────────────────────
console.log("👤 Seeding users...");
const hash = bcrypt.hashSync("password123", 10);

const USERS = [
  {
    id: "usr_admin",
    name: "Super Admin",
    email: "admin@travkings.com",
    role: "Super Admin",
    avatar: "👑",
    color: "#60A5FA",
    is_super_admin: 1,
  },
  {
    id: "usr_arjun",
    name: "Arjun Mehta",
    email: "arjun@travkings.com",
    role: "Finance Head",
    avatar: "👨‍💼",
    color: "#10B981",
    is_super_admin: 0,
  },
  {
    id: "usr_riya",
    name: "Riya Sharma",
    email: "riya@travkings.com",
    role: "Marketing Lead",
    avatar: "👩‍💻",
    color: "#F59E0B",
    is_super_admin: 0,
  },
  {
    id: "usr_james",
    name: "James Omondi",
    email: "james@travkings.com",
    role: "Branch Manager",
    avatar: "👨‍✈️",
    color: "#3B82F6",
    is_super_admin: 0,
  },
  {
    id: "usr_fatima",
    name: "Fatima Al-Zahra",
    email: "fatima@travkings.com",
    role: "Ticketing Exec",
    avatar: "👩‍🦱",
    color: "#EC4899",
    is_super_admin: 0,
  },
  {
    id: "usr_emile",
    name: "Emile Kabongo",
    email: "emile@travkings.com",
    role: "Branch Manager",
    avatar: "👨‍🔬",
    color: "#8B5CF6",
    is_super_admin: 0,
  },
  {
    id: "usr_priya",
    name: "Priya Nair",
    email: "priya@hotelkings.com",
    role: "General Manager",
    avatar: "👩‍💼",
    color: "#D97706",
    is_super_admin: 0,
  },
  {
    id: "usr_rahul",
    name: "Rahul Verma",
    email: "rahul@hotelkings.com",
    role: "Finance Head",
    avatar: "👨‍💻",
    color: "#EF4444",
    is_super_admin: 0,
  },
  {
    id: "usr_sara",
    name: "Sara Ahmed",
    email: "sara@quinaliza.com",
    role: "Marketing Lead",
    avatar: "👩‍🎨",
    color: "#A78BFA",
    is_super_admin: 0,
  },
  {
    id: "usr_amir",
    name: "Amir Hassan",
    email: "amir@kingslogistics.com",
    role: "Branch Manager",
    avatar: "🧑‍💼",
    color: "#34D399",
    is_super_admin: 0,
  },
];

const insUsr = db.prepare(
  "INSERT OR IGNORE INTO users (id,name,email,password_hash,role,avatar,color,is_super_admin) VALUES (?,?,?,?,?,?,?,?)",
);
USERS.forEach((u) =>
  insUsr.run(
    u.id,
    u.name,
    u.email,
    hash,
    u.role,
    u.avatar,
    u.color,
    u.is_super_admin,
  ),
);
console.log(`✅ ${USERS.length} users (password: password123)\n`);

// ── User Access ───────────────────────────────────────────────────────────────
console.log("🔐 Seeding user access...");
const insCmp = db.prepare(
  "INSERT OR IGNORE INTO user_companies (user_id,company_id) VALUES (?,?)",
);
const insBrA = db.prepare(
  "INSERT OR IGNORE INTO user_branches (user_id,branch_id) VALUES (?,?)",
);
const insDpA = db.prepare(
  "INSERT OR IGNORE INTO user_departments (user_id,department_id) VALUES (?,?)",
);

// Super Admin — all access
COMPANIES.forEach((c) => insCmp.run("usr_admin", c.id));
BRANCHES.forEach((b) => insBrA.run("usr_admin", b.id));
DEPTS.forEach((d) => insDpA.run("usr_admin", d.id));

// Arjun — TravKings, AMD+BOM, Finance
insCmp.run("usr_arjun", "co_tk");
["br_amd", "br_bom"].forEach((b) => insBrA.run("usr_arjun", b));
["dept_fin", "dept_bm"].forEach((d) => insDpA.run("usr_arjun", d));

// Riya — TravKings, BOM+NBO, Marketing+Holidays
insCmp.run("usr_riya", "co_tk");
["br_bom", "br_nbo"].forEach((b) => insBrA.run("usr_riya", b));
["dept_mktg", "dept_hol"].forEach((d) => insDpA.run("usr_riya", d));

// James — TravKings, NBO+DAR, Branch Manager
insCmp.run("usr_james", "co_tk");
["br_nbo", "br_dar"].forEach((b) => insBrA.run("usr_james", b));
["dept_bm", "dept_tkt"].forEach((d) => insDpA.run("usr_james", d));

// Fatima — TravKings, AMD+DRC, Ticketing
insCmp.run("usr_fatima", "co_tk");
["br_amd", "br_drc"].forEach((b) => insBrA.run("usr_fatima", b));
["dept_tkt", "dept_hol"].forEach((d) => insDpA.run("usr_fatima", d));

// Emile — TravKings, DRC+DAR, Branch Manager
insCmp.run("usr_emile", "co_tk");
["br_drc", "br_dar"].forEach((b) => insBrA.run("usr_emile", b));
["dept_bm", "dept_gm"].forEach((d) => insDpA.run("usr_emile", d));

// Priya — Hotel Kings Palace, Lshi, GM
insCmp.run("usr_priya", "co_hkp");
insBrA.run("usr_priya", "br_lshi_hkp");
["dept_gm", "dept_bm", "dept_mktg"].forEach((d) => insDpA.run("usr_priya", d));

// Rahul — Hotel Kings Palace, Lshi, Finance
insCmp.run("usr_rahul", "co_hkp");
insBrA.run("usr_rahul", "br_lshi_hkp");
["dept_fin", "dept_tkt"].forEach((d) => insDpA.run("usr_rahul", d));

// Sara — Quin Aliza, Lshi, Marketing
insCmp.run("usr_sara", "co_qa");
insBrA.run("usr_sara", "br_lshi_qa");
["dept_mktg", "dept_hol"].forEach((d) => insDpA.run("usr_sara", d));

// Amir — Kings Logistics, Lshi+DAR, Branch Manager
insCmp.run("usr_amir", "co_kl");
["br_lshi_kl", "br_dar_kl"].forEach((b) => insBrA.run("usr_amir", b));
["dept_bm", "dept_fin"].forEach((d) => insDpA.run("usr_amir", d));

console.log("✅ User access granted\n");

// ── Messages ──────────────────────────────────────────────────────────────────
console.log("💬 Seeding messages...");
const insMsg = db.prepare(
  "INSERT OR IGNORE INTO messages (id,chat_id,chat_type,sender_id,type,content,is_read,created_at) VALUES (?,?,?,?,?,?,?,?)",
);

// Get all chat group IDs
const groups = db.prepare("SELECT id,name FROM chat_groups").all();

// Seed messages in each group
const GROUP_MESSAGES = [
  [
    "usr_admin",
    "Good morning team! Monthly targets have been updated. Please review.",
  ],
  [
    "usr_arjun",
    "Q3 expense reports are ready for review. Finance team please check.",
  ],
  ["usr_riya", "New campaign for Maldives package is live on all platforms 🎉"],
  [
    "usr_james",
    "Flight KQ101 delayed by 2 hours. Informing all passengers now.",
  ],
  [
    "usr_fatima",
    "Dubai group booking confirmed — 12 passengers, all tickets issued.",
  ],
  ["usr_emile", "MiningCo deal signed today ✅ Contract sent to headquarters."],
  ["usr_admin", "Reminder: Team meeting tomorrow at 10 AM via video call."],
  [
    "usr_arjun",
    "Salary slips for March have been sent. Please confirm receipt.",
  ],
  ["usr_riya", "Instagram campaign reached 50K impressions this week! 📊"],
  ["usr_james", "Airport transfer arranged for VIP clients arriving Friday."],
];

groups.forEach((grp, gi) => {
  GROUP_MESSAGES.forEach(([sender, content], mi) => {
    insMsg.run(
      uuid(),
      grp.id,
      "group",
      sender,
      "text",
      content,
      1,
      hoursAgo((groups.length - gi) * 2 + (10 - mi)),
    );
  });
});

// Direct messages between users
const DM_PAIRS = [
  {
    from: "usr_admin",
    to: "usr_arjun",
    msgs: [
      {
        content: "Arjun, please prepare the Q3 financial summary by Friday.",
        time: hoursAgo(5),
      },
      {
        content: "Sure, will have it ready by Thursday EOD.",
        time: hoursAgo(4),
        swap: true,
      },
      { content: "Great, include all 4 companies please.", time: hoursAgo(3) },
    ],
  },
  {
    from: "usr_admin",
    to: "usr_riya",
    msgs: [
      {
        content: "Riya, how is the new Maldives campaign performing?",
        time: hoursAgo(8),
      },
      {
        content: "Really well! 40% more inquiries than last month 🎉",
        time: hoursAgo(7),
        swap: true,
      },
      { content: "Excellent work! Keep it up.", time: hoursAgo(6) },
    ],
  },
  {
    from: "usr_james",
    to: "usr_admin",
    msgs: [
      {
        content: "Sir, NBO branch has exceeded monthly targets by 15%!",
        time: daysAgo(1),
      },
      {
        content: "Outstanding James! Share the full report.",
        time: daysAgo(1),
        swap: true,
      },
    ],
  },
  {
    from: "usr_fatima",
    to: "usr_admin",
    msgs: [
      {
        content: "PNRs shared for the Dubai group — all 12 confirmed.",
        time: hoursAgo(2),
      },
      {
        content: "Perfect. Issue all tickets and send to clients.",
        time: hoursAgo(1),
        swap: true,
      },
    ],
  },
  {
    from: "usr_priya",
    to: "usr_admin",
    msgs: [
      {
        content: "Hotel occupancy this month is above 90%! Best month ever.",
        time: daysAgo(2),
      },
      {
        content: "Fantastic Priya! Keep the team motivated.",
        time: daysAgo(2),
        swap: true,
      },
    ],
  },
  {
    from: "usr_sara",
    to: "usr_admin",
    msgs: [
      {
        content: "Quin Aliza premium package launch ready for approval.",
        time: hoursAgo(10),
      },
      {
        content: "Approved! Go ahead with the launch.",
        time: hoursAgo(9),
        swap: true,
      },
    ],
  },
  {
    from: "usr_amir",
    to: "usr_emile",
    msgs: [
      { content: "DAR branch logistics report is ready.", time: daysAgo(1) },
      {
        content: "Send it over, will review tonight.",
        time: daysAgo(1),
        swap: true,
      },
    ],
  },
  {
    from: "usr_rahul",
    to: "usr_priya",
    msgs: [
      {
        content: "Room revenue report for Q2 is ready for your review.",
        time: hoursAgo(6),
      },
      {
        content: "Thanks Rahul, reviewing it now.",
        time: hoursAgo(5),
        swap: true,
      },
    ],
  },
];

DM_PAIRS.forEach((pair) => {
  pair.msgs.forEach((msg) => {
    const sender = msg.swap ? pair.to : pair.from;
    const chatId = msg.swap ? pair.from : pair.to;
    insMsg.run(
      uuid(),
      chatId,
      "direct",
      sender,
      "text",
      msg.content,
      1,
      msg.time,
    );
  });
});

// Add a few unread messages
insMsg.run(
  uuid(),
  "usr_admin",
  "direct",
  "usr_arjun",
  "text",
  "Salary slips sent for March, please confirm receipt.",
  0,
  minsAgo(30),
);
insMsg.run(
  uuid(),
  "usr_admin",
  "direct",
  "usr_fatima",
  "text",
  "PNRs shared for the Dubai group — 12 pax confirmed.",
  0,
  minsAgo(15),
);
insMsg.run(
  uuid(),
  "usr_admin",
  "direct",
  "usr_james",
  "text",
  "Flight KQ101 delayed by 2 hrs, informing pax now.",
  0,
  minsAgo(45),
);

console.log("✅ Messages seeded\n");

// ── Call Logs ─────────────────────────────────────────────────────────────────
console.log("📞 Seeding call logs...");
const insCall = db.prepare(
  "INSERT OR IGNORE INTO call_logs (id,caller_id,callee_id,type,direction,duration,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
);

const CALLS = [
  {
    caller: "usr_admin",
    callee: "usr_arjun",
    type: "voice",
    dir: "outgoing",
    dur: 142,
    status: "completed",
    time: hoursAgo(2),
  },
  {
    caller: "usr_admin",
    callee: "usr_james",
    type: "voice",
    dir: "outgoing",
    dur: 0,
    status: "missed",
    time: hoursAgo(5),
  },
  {
    caller: "usr_fatima",
    callee: "usr_admin",
    type: "video",
    dir: "incoming",
    dur: 318,
    status: "completed",
    time: daysAgo(1),
  },
  {
    caller: "usr_riya",
    callee: "usr_admin",
    type: "voice",
    dir: "incoming",
    dur: 76,
    status: "completed",
    time: daysAgo(2),
  },
  {
    caller: "usr_admin",
    callee: "usr_emile",
    type: "video",
    dir: "outgoing",
    dur: 0,
    status: "missed",
    time: daysAgo(2),
  },
  {
    caller: "usr_admin",
    callee: "usr_arjun",
    type: "voice",
    dir: "outgoing",
    dur: 204,
    status: "completed",
    time: daysAgo(3),
  },
  {
    caller: "usr_priya",
    callee: "usr_admin",
    type: "voice",
    dir: "incoming",
    dur: 95,
    status: "completed",
    time: daysAgo(4),
  },
  {
    caller: "usr_admin",
    callee: "usr_sara",
    type: "video",
    dir: "outgoing",
    dur: 445,
    status: "completed",
    time: daysAgo(5),
  },
  {
    caller: "usr_james",
    callee: "usr_admin",
    type: "voice",
    dir: "incoming",
    dur: 188,
    status: "completed",
    time: daysAgo(6),
  },
  {
    caller: "usr_admin",
    callee: "usr_rahul",
    type: "voice",
    dir: "outgoing",
    dur: 0,
    status: "missed",
    time: daysAgo(7),
  },
];

CALLS.forEach((c) =>
  insCall.run(
    uuid(),
    c.caller,
    c.callee,
    c.type,
    c.dir,
    c.dur,
    c.status,
    c.time,
  ),
);
console.log(`✅ ${CALLS.length} call logs\n`);

// ── Reminders ─────────────────────────────────────────────────────────────────
console.log("🔔 Seeding reminders...");
const insRem = db.prepare(
  "INSERT OR IGNORE INTO reminders (id,title,note,due_date,priority,status,for_user_id,created_by,reviewed_by,reviewed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
);

const REMINDERS = [
  // Admin assigns to team
  {
    title: "Submit Q3 Financial Report",
    note: "Include all 4 companies. Send to GM by EOD.",
    due: daysAgo(-2),
    priority: "high",
    status: "pending",
    for: "usr_arjun",
    by: "usr_admin",
    rev: null,
    revAt: null,
    at: daysAgo(3),
  },
  {
    title: "Launch Maldives Summer Campaign",
    note: "Target: 500 leads in first week.",
    due: daysAgo(-3),
    priority: "high",
    status: "review",
    for: "usr_riya",
    by: "usr_admin",
    rev: null,
    revAt: null,
    at: daysAgo(4),
  },
  {
    title: "NBO Branch Monthly Performance Report",
    note: "Include target vs actual comparison.",
    due: daysAgo(-1),
    priority: "medium",
    status: "approved",
    for: "usr_james",
    by: "usr_admin",
    rev: "usr_admin",
    revAt: daysAgo(1),
    at: daysAgo(5),
  },
  {
    title: "Issue All Dubai Group Tickets",
    note: "12 passengers — PNRs already confirmed.",
    due: daysAgo(0),
    priority: "high",
    status: "pending",
    for: "usr_fatima",
    by: "usr_admin",
    rev: null,
    revAt: null,
    at: daysAgo(1),
  },
  {
    title: "DRC Branch Contract Filing",
    note: "MiningCo deal — file all signed documents.",
    due: daysAgo(-4),
    priority: "medium",
    status: "review",
    for: "usr_emile",
    by: "usr_admin",
    rev: null,
    revAt: null,
    at: daysAgo(6),
  },
  {
    title: "Hotel Kings Q2 Revenue Summary",
    note: "Include occupancy rates and RevPAR.",
    due: daysAgo(-2),
    priority: "high",
    status: "pending",
    for: "usr_priya",
    by: "usr_admin",
    rev: null,
    revAt: null,
    at: daysAgo(2),
  },
  {
    title: "Quin Aliza Premium Package Approval",
    note: "Final pricing and launch materials ready.",
    due: daysAgo(1),
    priority: "medium",
    status: "approved",
    for: "usr_sara",
    by: "usr_admin",
    rev: "usr_admin",
    revAt: daysAgo(2),
    at: daysAgo(7),
  },
  {
    title: "DAR Logistics KPI Review",
    note: "Q3 targets vs actual performance.",
    due: daysAgo(-1),
    priority: "medium",
    status: "pending",
    for: "usr_amir",
    by: "usr_admin",
    rev: null,
    revAt: null,
    at: daysAgo(2),
  },
  {
    title: "Hotel Finance Audit Prep",
    note: "Prepare documents for annual audit.",
    due: daysAgo(-5),
    priority: "high",
    status: "rejected",
    for: "usr_rahul",
    by: "usr_priya",
    rev: "usr_priya",
    revAt: daysAgo(3),
    at: daysAgo(8),
  },
  // Self-assigned reminders
  {
    title: "Team Meeting Agenda Preparation",
    note: "Agenda for Monday all-hands meeting.",
    due: daysAgo(-1),
    priority: "medium",
    status: "pending",
    for: "usr_admin",
    by: "usr_admin",
    rev: null,
    revAt: null,
    at: daysAgo(1),
  },
  {
    title: "Review Visa Docs — BOM Group",
    note: "Maldives group — 8 passengers.",
    due: daysAgo(2),
    priority: "low",
    status: "approved",
    for: "usr_admin",
    by: "usr_admin",
    rev: "usr_admin",
    revAt: daysAgo(5),
    at: daysAgo(10),
  },
  {
    title: "Follow Up with AMD Client",
    note: "Interested in corporate travel package.",
    due: daysAgo(-1),
    priority: "medium",
    status: "pending",
    for: "usr_admin",
    by: "usr_admin",
    rev: null,
    revAt: null,
    at: daysAgo(2),
  },
  // User assigns to admin
  {
    title: "Approve Riya Marketing Budget",
    note: "Q4 budget — needs approval before 15th.",
    due: daysAgo(-3),
    priority: "high",
    status: "review",
    for: "usr_admin",
    by: "usr_riya",
    rev: null,
    revAt: null,
    at: daysAgo(3),
  },
  {
    title: "Sign NBO Vendor Contract",
    note: "3-year contract with local transport provider.",
    due: daysAgo(-2),
    priority: "high",
    status: "pending",
    for: "usr_admin",
    by: "usr_james",
    rev: null,
    revAt: null,
    at: daysAgo(4),
  },
];

REMINDERS.forEach((r) => {
  insRem.run(
    uuid(),
    r.title,
    r.note,
    r.due,
    r.priority,
    r.status,
    r.for,
    r.by,
    r.rev,
    r.revAt,
    r.at,
  );
});
console.log(`✅ ${REMINDERS.length} reminders\n`);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("═══════════════════════════════════════");
console.log("🎉 Seed Complete! Summary:");
console.log("═══════════════════════════════════════");
console.log(
  `  Companies:    ${db.prepare("SELECT COUNT(*) as n FROM companies").get().n}`,
);
console.log(
  `  Branches:     ${db.prepare("SELECT COUNT(*) as n FROM branches").get().n}`,
);
console.log(
  `  Departments:  ${db.prepare("SELECT COUNT(*) as n FROM departments").get().n}`,
);
console.log(
  `  Chat Groups:  ${db.prepare("SELECT COUNT(*) as n FROM chat_groups").get().n}`,
);
console.log(
  `  Users:        ${db.prepare("SELECT COUNT(*) as n FROM users").get().n}`,
);
console.log(
  `  Messages:     ${db.prepare("SELECT COUNT(*) as n FROM messages").get().n}`,
);
console.log(
  `  Call Logs:    ${db.prepare("SELECT COUNT(*) as n FROM call_logs").get().n}`,
);
console.log(
  `  Reminders:    ${db.prepare("SELECT COUNT(*) as n FROM reminders").get().n}`,
);
console.log("═══════════════════════════════════════");
console.log("");
console.log("👥 Login Credentials (all use password: password123)");
console.log("───────────────────────────────────────");
console.log("  admin@travkings.com      → 👑 Super Admin");
console.log("  arjun@travkings.com      → Finance Head");
console.log("  riya@travkings.com       → Marketing Lead");
console.log("  james@travkings.com      → Branch Manager");
console.log("  fatima@travkings.com     → Ticketing Exec");
console.log("  emile@travkings.com      → Branch Manager");
console.log("  priya@hotelkings.com     → General Manager");
console.log("  rahul@hotelkings.com     → Finance Head");
console.log("  sara@quinaliza.com       → Marketing Lead");
console.log("  amir@kingslogistics.com  → Branch Manager");
console.log("═══════════════════════════════════════");
console.log("\n✅ Run: node server.js to start the backend");

