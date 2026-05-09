// seed.js — Fresh seed for TravKings platform
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const connectDB = require("./config/db");

const Company        = require("./models/Company");
const Branch         = require("./models/Branch");
const Department     = require("./models/Department");
const User           = require("./models/User");
const UserCompany    = require("./models/UserCompany");
const UserBranch     = require("./models/UserBranch");
const UserDepartment = require("./models/UserDepartment");
const ChatGroup      = require("./models/ChatGroup");
const Message        = require("./models/Message");
const CallLog        = require("./models/CallLog");
const Reminder       = require("./models/Reminder");

connectDB();

const seed = async () => {
  try {
    console.log("🗑️  Clearing all existing data...");
    await Reminder.deleteMany({});
    await CallLog.deleteMany({});
    await Message.deleteMany({});
    await ChatGroup.deleteMany({});
    await UserDepartment.deleteMany({});
    await UserBranch.deleteMany({});
    await UserCompany.deleteMany({});
    await User.deleteMany({});
    await Branch.deleteMany({});
    await Department.deleteMany({});
    await Company.deleteMany({});
    console.log("✅ Cleared\n");

    // ── Departments ───────────────────────────────────────────────────────────
    console.log("🏷️  Seeding departments...");
    const DEPTS = [
      { _id: "dept_fin", name: "Finance",   short_name: "FIN", icon: "💰", color: "#10B981" },
      { _id: "dept_dev", name: "Developer", short_name: "DEV", icon: "💻", color: "#6366F1" },
    ];
    await Department.insertMany(DEPTS);
    console.log(`✅ ${DEPTS.length} departments\n`);

    // ── Company ───────────────────────────────────────────────────────────────
    console.log("🏢 Seeding company...");
    const COMPANIES = [
      { _id: "co_tk", name: "TravKings", tagline: "Travel & Tourism", avatar: "✈️", color: "#3B82F6" },
    ];
    await Company.insertMany(COMPANIES);
    console.log(`✅ ${COMPANIES.length} company\n`);

    // ── Branches ──────────────────────────────────────────────────────────────
    console.log("🌿 Seeding branches...");
    const BRANCHES = [
      { _id: "br_bom", company_id: "co_tk", name: "Mumbai Branch",    city: "Mumbai",    avatar: "🌊", color: "#0EA5E9" },
      { _id: "br_amd", company_id: "co_tk", name: "Ahmedabad Branch", city: "Ahmedabad", avatar: "🏙️", color: "#6366F1" },
    ];
    await Branch.insertMany(BRANCHES);
    console.log(`✅ ${BRANCHES.length} branches\n`);

    // ── Chat Groups (branch × department) ────────────────────────────────────
    console.log("💬 Seeding chat groups...");
    const chatGroups = [];
    BRANCHES.forEach(br => {
      DEPTS.forEach(d => {
        const brCode = br.city.slice(0, 3).toUpperCase();
        chatGroups.push({
          _id:           uuid(),
          branch_id:     br._id,
          department_id: d._id,
          name:          `${brCode} ${d.short_name}`,
        });
      });
    });
    await ChatGroup.insertMany(chatGroups);
    console.log(`✅ ${chatGroups.length} chat groups\n`);

    // ── Users ─────────────────────────────────────────────────────────────────
    console.log("👤 Seeding users...");
    const hash = await bcrypt.hash("password123", 10);

    const USERS = [
      {
        _id: "usr_afshin", name: "Afshin Dhanani",
        email: "afshin.dhanani@kingsgroupco.com",
        password_hash: hash, role: "Super Admin",
        avatar: "👑", color: "#2563EB", is_super_admin: true,
      },
      {
        _id: "usr_vinod", name: "Vinod",
        email: "vinod@kingsgroupco.com",
        password_hash: hash, role: "Super Admin",
        avatar: "👑", color: "#1D4ED8", is_super_admin: true,
      },
      {
        _id: "usr_farhan", name: "Farhan",
        email: "farhan@travkings.com",
        password_hash: hash, role: "Company Manager",
        avatar: "🏢", color: "#3B82F6", is_super_admin: false,
      },
      {
        _id: "usr_faiz", name: "Faiz",
        email: "faiz@travkings.com",
        password_hash: hash, role: "Company Manager",
        avatar: "🏢", color: "#2563EB", is_super_admin: false,
      },
      {
        _id: "usr_sughra", name: "Sughra",
        email: "sughra@travkings.com",
        password_hash: hash, role: "HOD Finance",
        avatar: "💰", color: "#10B981", is_super_admin: false,
      },
      {
        _id: "usr_pravesh", name: "Pravesh",
        email: "pravesh@travkings.com",
        password_hash: hash, role: "AMD Mumbai Branch",
        avatar: "📍", color: "#F59E0B", is_super_admin: false,
      },
      {
        _id: "usr_ap", name: "AP",
        email: "ap@travkings.com",
        password_hash: hash, role: "Finance Employee",
        avatar: "📊", color: "#14B8A6", is_super_admin: false,
      },
      {
        _id: "usr_accounts_drc", name: "Accounts DRC",
        email: "accounts.drc@travkings.com",
        password_hash: hash, role: "Finance Employee",
        avatar: "💵", color: "#059669", is_super_admin: false,
      },
      {
        _id: "usr_anuvab", name: "Anuvab",
        email: "anuvab@kingsgroupco.com",
        password_hash: hash, role: "Company Manager",
        avatar: "🏢", color: "#7C3AED", is_super_admin: false,
      },
      {
        _id: "usr_surajit", name: "Surajit",
        email: "surajit@kingsgroupco.com",
        password_hash: hash, role: "Company Manager",
        avatar: "🧑‍💻", color: "#8B5CF6", is_super_admin: false,
      },
      {
        _id: "usr_ratnesh", name: "Ratnesh",
        email: "ratnesh@kingsgroupco.com",
        password_hash: hash, role: "Developer",
        avatar: "💻", color: "#6366F1", is_super_admin: false,
      },
    ];

    await User.insertMany(USERS);
    console.log(`✅ ${USERS.length} users (password: password123)\n`);

    // ── User Access ───────────────────────────────────────────────────────────
    console.log("🔐 Seeding user access...");
    const userCompanies    = [];
    const userBranches     = [];
    const userDepartments  = [];

    const grantAll = (userId) => {
      COMPANIES.forEach(c => userCompanies.push({ user_id: userId, company_id: c._id }));
      BRANCHES.forEach(b  => userBranches.push({ user_id: userId, branch_id: b._id }));
      DEPTS.forEach(d     => userDepartments.push({ user_id: userId, department_id: d._id }));
    };

    const grant = (userId, companyIds, branchIds, deptIds) => {
      companyIds.forEach(c => userCompanies.push({ user_id: userId, company_id: c }));
      branchIds.forEach(b  => userBranches.push({ user_id: userId, branch_id: b }));
      deptIds.forEach(d    => userDepartments.push({ user_id: userId, department_id: d }));
    };

    // Super admins — all access
    grantAll("usr_afshin");
    grantAll("usr_vinod");

    // Company managers — all TravKings, both branches, both depts
    ["usr_farhan", "usr_faiz", "usr_anuvab", "usr_surajit"].forEach(u =>
      grant(u, ["co_tk"], ["br_bom", "br_amd"], ["dept_fin", "dept_dev"])
    );

    // HOD Finance — Mumbai, Finance
    grant("usr_sughra", ["co_tk"], ["br_bom"], ["dept_fin"]);

    // AMD Mumbai Branch — Mumbai, both depts
    grant("usr_pravesh", ["co_tk"], ["br_bom"], ["dept_fin", "dept_dev"]);

    // Finance Employees — Mumbai, Finance
    grant("usr_ap",           ["co_tk"], ["br_bom"], ["dept_fin"]);
    grant("usr_accounts_drc", ["co_tk"], ["br_bom"], ["dept_fin"]);

    // Developer — Mumbai, Developer
    grant("usr_ratnesh", ["co_tk"], ["br_bom"], ["dept_dev"]);

    await UserCompany.insertMany(userCompanies);
    await UserBranch.insertMany(userBranches);
    await UserDepartment.insertMany(userDepartments);
    console.log("✅ User access granted\n");

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("═══════════════════════════════════════════════════════");
    console.log("🎉 Seed Complete!");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  Companies:   ${await Company.countDocuments()}`);
    console.log(`  Branches:    ${await Branch.countDocuments()}`);
    console.log(`  Departments: ${await Department.countDocuments()}`);
    console.log(`  Chat Groups: ${await ChatGroup.countDocuments()}`);
    console.log(`  Users:       ${await User.countDocuments()}`);
    console.log(`  Messages:    ${await Message.countDocuments()}`);
    console.log(`  Reminders:   ${await Reminder.countDocuments()}`);
    console.log("═══════════════════════════════════════════════════════");
    console.log("\n👥 Credentials (all password: password123)");
    console.log("───────────────────────────────────────────────────────");
    USERS.forEach(u => console.log(`  ${u.email.padEnd(38)} → ${u.role}`));
    console.log("═══════════════════════════════════════════════════════");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
};

module.exports = { seed };
// seed();
