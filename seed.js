// seed.js — Minimal clean seed
// Usage:
//   cd backend
//   node seed.js

const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const path = require("path");

const db = new Database(path.join(__dirname, "travkings.db"));
db.pragma("foreign_keys = ON");

console.log("🌱 Starting clean seed...\n");

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const now = () => new Date().toISOString();

// ─────────────────────────────────────────────────────────────
// FULL CLEAN DATABASE
// ─────────────────────────────────────────────────────────────
console.log("🗑️ Clearing entire database...");

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

console.log("✅ Database cleaned\n");

// ─────────────────────────────────────────────────────────────
// Departments
// ─────────────────────────────────────────────────────────────
console.log("🏷️ Seeding departments...");

const DEPARTMENTS = [
  {
    id: "dept_finance",
    name: "Finance",
    short_name: "FIN",
    icon: "💰",
    color: "#10B981",
  },
  {
    id: "dept_dev",
    name: "Development",
    short_name: "DEV",
    icon: "💻",
    color: "#3B82F6",
  },
];

const insertDept = db.prepare(`
  INSERT INTO departments
  (id,name,short_name,icon,color)
  VALUES (?,?,?,?,?)
`);

DEPARTMENTS.forEach((d) => {
  insertDept.run(
    d.id,
    d.name,
    d.short_name,
    d.icon,
    d.color,
  );
});

console.log(`✅ ${DEPARTMENTS.length} departments seeded\n`);

// ─────────────────────────────────────────────────────────────
// Companies
// ─────────────────────────────────────────────────────────────
console.log("🏢 Seeding companies...");

const COMPANIES = [
  {
    id: "co_travkings",
    name: "TravKings",
    tagline: "Travel & Tourism",
    avatar: "✈️",
    color: "#2563EB",
  },
  {
    id: "co_kingbiz",
    name: "KingBiz",
    tagline: "Business Operations",
    avatar: "🏢",
    color: "#7C3AED",
  },
];

const insertCompany = db.prepare(`
  INSERT INTO companies
  (id,name,tagline,avatar,color)
  VALUES (?,?,?,?,?)
`);

COMPANIES.forEach((c) => {
  insertCompany.run(
    c.id,
    c.name,
    c.tagline,
    c.avatar,
    c.color,
  );
});

console.log(`✅ ${COMPANIES.length} companies seeded\n`);

// ─────────────────────────────────────────────────────────────
// Branches
// ─────────────────────────────────────────────────────────────
console.log("🌿 Seeding branches...");

const BRANCHES = [
  {
    id: "br_mumbai",
    company_id: "co_travkings",
    name: "Mumbai Branch",
    city: "Mumbai",
    avatar: "🌆",
    color: "#0EA5E9",
  },
];

const insertBranch = db.prepare(`
  INSERT INTO branches
  (id,company_id,name,city,avatar,color)
  VALUES (?,?,?,?,?,?)
`);

BRANCHES.forEach((b) => {
  insertBranch.run(
    b.id,
    b.company_id,
    b.name,
    b.city,
    b.avatar,
    b.color,
  );
});

console.log(`✅ ${BRANCHES.length} branch seeded\n`);

// ─────────────────────────────────────────────────────────────
// Chat Groups
// ─────────────────────────────────────────────────────────────
console.log("💬 Seeding chat groups...");

const insertGroup = db.prepare(`
  INSERT INTO chat_groups
  (id,branch_id,department_id,name)
  VALUES (?,?,?,?)
`);

DEPARTMENTS.forEach((d) => {
  insertGroup.run(
    uuid(),
    "br_mumbai",
    d.id,
    `Mumbai ${d.short_name}`,
  );
});

console.log("✅ Chat groups seeded\n");

// ─────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────
console.log("👤 Seeding users...");

const passwordHash = bcrypt.hashSync("password123", 10);

const USERS = [
  // ROOT SUPER ADMIN
  {
    id: "usr_afshin",
    name: "Afshin Dhanani",
    email: "afshin.dhanani@kingsgroupco.com",
    role: "Super Admin",
    avatar: "👑",
    color: "#2563EB",
    is_super_admin: 1,
  },

  // ───────── TRAVKINGS ─────────
  {
    id: "usr_vinod",
    name: "Vinod",
    email: "vinod@kingsgroupco.com",
    role: "Super Admin",
    avatar: "👑",
    color: "#1D4ED8",
    is_super_admin: 1,
  },
  {
    id: "usr_farhan",
    name: "Farhan",
    email: "farhan@travkings.com",
    role: "Company Manager",
    avatar: "🏢",
    color: "#3B82F6",
    is_super_admin: 0,
  },
  {
    id: "usr_faiz",
    name: "Faiz",
    email: "faiz@travkings.com",
    role: "Company Manager",
    avatar: "🏢",
    color: "#2563EB",
    is_super_admin: 0,
  },
  {
    id: "usr_sughra",
    name: "Sughra",
    email: "sughra@travkings.com",
    role: "HOD Finance",
    avatar: "💰",
    color: "#10B981",
    is_super_admin: 0,
  },
  {
    id: "usr_pravesh",
    name: "Pravesh",
    email: "pravesh@travkings.com",
    role: "AMD Mumbai Branch",
    avatar: "📍",
    color: "#F59E0B",
    is_super_admin: 0,
  },
  {
    id: "usr_ap",
    name: "AP",
    email: "ap@travkings.com",
    role: "Finance Employee",
    avatar: "📊",
    color: "#14B8A6",
    is_super_admin: 0,
  },
  {
    id: "usr_accounts_drc",
    name: "Accounts DRC",
    email: "accounts.drc@travkings.com",
    role: "Finance Employee",
    avatar: "💵",
    color: "#059669",
    is_super_admin: 0,
  },

  // ───────── KINGBIZ ─────────
  {
    id: "usr_anuvab",
    name: "Anuvab",
    email: "anuvab@kingsgroupco.com",
    role: "Company Manager",
    avatar: "🏢",
    color: "#7C3AED",
    is_super_admin: 0,
  },
  {
    id: "usr_surajit",
    name: "Surajit",
    email: "surajit@kingsgroupco.com",
    role: "Company Manager",
    avatar: "🧑‍💻",
    color: "#8B5CF6",
    is_super_admin: 0,
  },
  {
    id: "usr_ratnesh",
    name: "Ratnesh",
    email: "ratnesh@kingsgroupco.com",
    role: "Developer",
    avatar: "💻",
    color: "#6366F1",
    is_super_admin: 0,
  },
];

const insertUser = db.prepare(`
  INSERT INTO users
  (id,name,email,password_hash,role,avatar,color,is_super_admin)
  VALUES (?,?,?,?,?,?,?,?)
`);

USERS.forEach((u) => {
  insertUser.run(
    u.id,
    u.name,
    u.email,
    passwordHash,
    u.role,
    u.avatar,
    u.color,
    u.is_super_admin,
  );
});

console.log(`✅ ${USERS.length} users seeded\n`);

// ─────────────────────────────────────────────────────────────
// User Company Access
// ─────────────────────────────────────────────────────────────
console.log("🔐 Seeding access control...");

const insertUserCompany = db.prepare(`
  INSERT INTO user_companies
  (user_id,company_id)
  VALUES (?,?)
`);

const insertUserBranch = db.prepare(`
  INSERT INTO user_branches
  (user_id,branch_id)
  VALUES (?,?)
`);

const insertUserDepartment = db.prepare(`
  INSERT INTO user_departments
  (user_id,department_id)
  VALUES (?,?)
`);

// TravKings users
[
  "usr_farhan",
  "usr_faiz",
  "usr_sughra",
  "usr_pravesh",
  "usr_ap",
  "usr_accounts_drc",
].forEach((u) => {
  insertUserCompany.run(u, "co_travkings");
  insertUserBranch.run(u, "br_mumbai");
});

// KingBiz users
[
  "usr_anuvab",
  "usr_surajit",
  "usr_ratnesh",
].forEach((u) => {
  insertUserCompany.run(u, "co_kingbiz");
});

// Finance Department
[
  "usr_sughra",
  "usr_ap",
  "usr_accounts_drc",
].forEach((u) => {
  insertUserDepartment.run(u, "dept_finance");
});

// Dev Department
[
  "usr_ratnesh",
].forEach((u) => {
  insertUserDepartment.run(u, "dept_dev");
});

// Super admins get all departments
DEPARTMENTS.forEach((d) => {
  insertUserDepartment.run("usr_afshin", d.id);
  insertUserDepartment.run("usr_vinod", d.id);
});

console.log("✅ Access control seeded\n");

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────
console.log("═══════════════════════════════════════");
console.log("🎉 Seed Complete!");
console.log("═══════════════════════════════════════");

console.log(
  `Companies:   ${db.prepare("SELECT COUNT(*) as n FROM companies").get().n}`,
);

console.log(
  `Branches:    ${db.prepare("SELECT COUNT(*) as n FROM branches").get().n}`,
);

console.log(
  `Departments: ${db.prepare("SELECT COUNT(*) as n FROM departments").get().n}`,
);

console.log(
  `Users:       ${db.prepare("SELECT COUNT(*) as n FROM users").get().n}`,
);

console.log(
  `Groups:      ${db.prepare("SELECT COUNT(*) as n FROM chat_groups").get().n}`,
);

console.log("═══════════════════════════════════════\n");

console.log("🔑 Login Password For All Users:");
console.log("password123\n");

console.log("✅ Run: node server.js");