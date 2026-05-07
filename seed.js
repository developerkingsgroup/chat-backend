// seed.js — Run once to populate dummy data
// Usage: node seed.js
// Run from backend folder: cd backend && node seed.js

require('dotenv').config();
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
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

// Connect to MongoDB
connectDB();

console.log("🌱 Starting seed...\n");

// ── Helper ────────────────────────────────────────────────────────────────────
const now = () => new Date().toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const hoursAgo = (n) => new Date(Date.now() - n * 3600000).toISOString();
const minsAgo = (n) => new Date(Date.now() - n * 60000).toISOString();

// ── Clear existing data (fresh seed) ─────────────────────────────────────────
const seed = async () => {
  try {
    console.log("🗑️  Clearing existing data...");
    await Reminder.deleteMany({});
    await CallLog.deleteMany({});
    await Message.deleteMany({});
    await ChatGroup.deleteMany({});
    await UserDepartment.deleteMany({});
    await UserBranch.deleteMany({});
    await UserCompany.deleteMany({});
    await User.deleteMany({});
    await Branch.deleteMany({});
    await Company.deleteMany({});
    await Department.deleteMany({});
    console.log("✅ Cleared\n");

    // ── Departments ───────────────────────────────────────────────────────────────
    console.log("🏷️  Seeding departments...");
    const DEPTS = [
      {
        _id: "dept_mktg",
        name: "Marketing",
        short_name: "MKTG",
        icon: "📣",
        color: "#F59E0B",
      },
      {
        _id: "dept_fin",
        name: "Finance",
        short_name: "FIN",
        icon: "💰",
        color: "#10B981",
      },
      {
        _id: "dept_tkt",
        name: "Ticketing",
        short_name: "TKT",
        icon: "🎫",
        color: "#3B82F6",
      },
      {
        _id: "dept_hol",
        name: "Holidays",
        short_name: "HOL",
        icon: "🌴",
        color: "#EC4899",
      },
      {
        _id: "dept_bm",
        name: "Branch Manager",
        short_name: "BM",
        icon: "🏢",
        color: "#8B5CF6",
      },
      {
        _id: "dept_gm",
        name: "General Manager",
        short_name: "GM",
        icon: "👔",
        color: "#EF4444",
      },
    ];
    await Department.insertMany(DEPTS);
    console.log(`✅ ${DEPTS.length} departments\n`);

    // ── Companies ─────────────────────────────────────────────────────────────────
    console.log("🏢 Seeding companies...");
    const COMPANIES = [
      {
        _id: "co_tk",
        name: "TravKings",
        tagline: "Travel & Tourism",
        avatar: "✈️",
        color: "#3B82F6",
      },
      {
        _id: "co_hkp",
        name: "Hotel Kings Palace",
        tagline: "Luxury Hospitality",
        avatar: "🏨",
        color: "#D97706",
      },
      {
        _id: "co_qa",
        name: "Quin Aliza",
        tagline: "Premium Services",
        avatar: "💜",
        color: "#8B5CF6",
      },
      {
        _id: "co_kl",
        name: "Kings Logistics",
        tagline: "Logistics & Supply Chain",
        avatar: "🚛",
        color: "#10B981",
      },
    ];
    await Company.insertMany(COMPANIES);
    console.log(`✅ ${COMPANIES.length} companies\n`);

    // ── Branches ──────────────────────────────────────────────────────────────────
    console.log("🌿 Seeding branches...");
    const BRANCHES = [
      // TravKings
      {
        _id: "br_amd",
        company_id: "co_tk",
        name: "AMD Branch",
        city: "Ahmedabad",
        avatar: "🏙️",
        color: "#6366F1",
      },
      {
        _id: "br_bom",
        company_id: "co_tk",
        name: "BOM Branch",
        city: "Mumbai",
        avatar: "🌊",
        color: "#0EA5E9",
      },
      {
        _id: "br_dar",
        company_id: "co_tk",
        name: "DAR Branch",
        city: "Dar es Salaam",
        avatar: "🌍",
        color: "#10B981",
      },
      {
        _id: "br_nbo",
        company_id: "co_tk",
        name: "NBO Branch",
        city: "Nairobi",
        avatar: "🦁",
        color: "#F59E0B",
      },
      {
        _id: "br_drc",
        company_id: "co_tk",
        name: "DRC Branch",
        city: "Kinshasa",
        avatar: "🌿",
        color: "#EC4899",
      },
      // Hotel Kings Palace
      {
        _id: "br_lshi_hkp",
        company_id: "co_hkp",
        name: "Lshi Branch",
        city: "Lshi",
        avatar: "🏨",
        color: "#D97706",
      },
      // Quin Aliza
      {
        _id: "br_lshi_qa",
        company_id: "co_qa",
        name: "Lshi Branch",
        city: "Lshi",
        avatar: "🌟",
        color: "#8B5CF6",
      },
      // Kings Logistics
      {
        _id: "br_lshi_kl",
        company_id: "co_kl",
        name: "Lshi Branch",
        city: "Lshi",
        avatar: "📦",
        color: "#10B981",
      },
      {
        _id: "br_dar_kl",
        company_id: "co_kl",
        name: "DAR Branch",
        city: "Dar es Salaam",
        avatar: "🌍",
        color: "#F59E0B",
      },
    ];
    await Branch.insertMany(BRANCHES);
    console.log(`✅ ${BRANCHES.length} branches\n`);

    // ── Chat Groups (auto create for each branch × dept) ──────────────────────────
    console.log("💬 Seeding chat groups...");
    const chatGroupsToInsert = [];
    BRANCHES.forEach((br) => {
      DEPTS.forEach((d) => {
        const code = br.name.split(" ")[0];
        chatGroupsToInsert.push({
          _id: uuid(),
          branch_id: br._id,
          department_id: d._id,
          name: `${code} ${d.short_name}`,
        });
      });
    });
    await ChatGroup.insertMany(chatGroupsToInsert);
    console.log(`✅ ${chatGroupsToInsert.length} chat groups\n`);

    // ── Users ─────────────────────────────────────────────────────────────────────
    console.log("👤 Seeding users...");
    const hash = await bcrypt.hash("password123", 10);

    const USERS = [
      {
        _id: "usr_admin",
        name: "Super Admin",
        email: "admin@travkings.com",
        password_hash: hash,
        role: "Super Admin",
        avatar: "👑",
        color: "#60A5FA",
        is_super_admin: true,
      },
      {
        _id: "usr_arjun",
        name: "Arjun Mehta",
        email: "arjun@travkings.com",
        password_hash: hash,
        role: "Finance Head",
        avatar: "👨‍💼",
        color: "#10B981",
        is_super_admin: false,
      },
      {
        _id: "usr_riya",
        name: "Riya Sharma",
        email: "riya@travkings.com",
        password_hash: hash,
        role: "Marketing Lead",
        avatar: "👩‍💻",
        color: "#F59E0B",
        is_super_admin: false,
      },
      {
        _id: "usr_james",
        name: "James Omondi",
        email: "james@travkings.com",
        password_hash: hash,
        role: "Branch Manager",
        avatar: "👨‍✈️",
        color: "#3B82F6",
        is_super_admin: false,
      },
      {
        _id: "usr_fatima",
        name: "Fatima Al-Zahra",
        email: "fatima@travkings.com",
        password_hash: hash,
        role: "Ticketing Exec",
        avatar: "👩‍🦱",
        color: "#EC4899",
        is_super_admin: false,
      },
      {
        _id: "usr_emile",
        name: "Emile Kabongo",
        email: "emile@travkings.com",
        password_hash: hash,
        role: "Branch Manager",
        avatar: "👨‍🔬",
        color: "#8B5CF6",
        is_super_admin: false,
      },
      {
        _id: "usr_priya",
        name: "Priya Nair",
        email: "priya@hotelkings.com",
        password_hash: hash,
        role: "General Manager",
        avatar: "👩‍💼",
        color: "#D97706",
        is_super_admin: false,
      },
      {
        _id: "usr_rahul",
        name: "Rahul Verma",
        email: "rahul@hotelkings.com",
        password_hash: hash,
        role: "Finance Head",
        avatar: "👨‍💻",
        color: "#EF4444",
        is_super_admin: false,
      },
      {
        _id: "usr_sara",
        name: "Sara Ahmed",
        email: "sara@quinaliza.com",
        password_hash: hash,
        role: "Marketing Lead",
        avatar: "👩‍🎨",
        color: "#A78BFA",
        is_super_admin: false,
      },
      {
        _id: "usr_amir",
        name: "Amir Hassan",
        email: "amir@kingslogistics.com",
        password_hash: hash,
        role: "Branch Manager",
        avatar: "🧑‍💼",
        color: "#34D399",
        is_super_admin: false,
      },
    ];

    await User.insertMany(USERS);
    console.log(`✅ ${USERS.length} users (password: password123)\n`);

    // ── User Access ───────────────────────────────────────────────────────────────
    console.log("🔐 Seeding user access...");
    const userCompaniesToInsert = [];
    const userBranchesToInsert = [];
    const userDepartmentsToInsert = [];

    // Super Admin — all access
    COMPANIES.forEach((c) => userCompaniesToInsert.push({ user_id: "usr_admin", company_id: c._id }));
    BRANCHES.forEach((b) => userBranchesToInsert.push({ user_id: "usr_admin", branch_id: b._id }));
    DEPTS.forEach((d) => userDepartmentsToInsert.push({ user_id: "usr_admin", department_id: d._id }));

    // Arjun — TravKings, AMD+BOM, Finance
    userCompaniesToInsert.push({ user_id: "usr_arjun", company_id: "co_tk" });
    ["br_amd", "br_bom"].forEach((b) => userBranchesToInsert.push({ user_id: "usr_arjun", branch_id: b }));
    ["dept_fin", "dept_bm"].forEach((d) => userDepartmentsToInsert.push({ user_id: "usr_arjun", department_id: d }));

    // Riya — TravKings, BOM+NBO, Marketing+Holidays
    userCompaniesToInsert.push({ user_id: "usr_riya", company_id: "co_tk" });
    ["br_bom", "br_nbo"].forEach((b) => userBranchesToInsert.push({ user_id: "usr_riya", branch_id: b }));
    ["dept_mktg", "dept_hol"].forEach((d) => userDepartmentsToInsert.push({ user_id: "usr_riya", department_id: d }));

    // James — TravKings, NBO+DAR, Branch Manager
    userCompaniesToInsert.push({ user_id: "usr_james", company_id: "co_tk" });
    ["br_nbo", "br_dar"].forEach((b) => userBranchesToInsert.push({ user_id: "usr_james", branch_id: b }));
    ["dept_bm", "dept_tkt"].forEach((d) => userDepartmentsToInsert.push({ user_id: "usr_james", department_id: d }));

    // Fatima — TravKings, AMD+DRC, Ticketing
    userCompaniesToInsert.push({ user_id: "usr_fatima", company_id: "co_tk" });
    ["br_amd", "br_drc"].forEach((b) => userBranchesToInsert.push({ user_id: "usr_fatima", branch_id: b }));
    ["dept_tkt", "dept_hol"].forEach((d) => userDepartmentsToInsert.push({ user_id: "usr_fatima", department_id: d }));

    // Emile — TravKings, DRC+DAR, Branch Manager
    userCompaniesToInsert.push({ user_id: "usr_emile", company_id: "co_tk" });
    ["br_drc", "br_dar"].forEach((b) => userBranchesToInsert.push({ user_id: "usr_emile", branch_id: b }));
    ["dept_bm", "dept_gm"].forEach((d) => userDepartmentsToInsert.push({ user_id: "usr_emile", department_id: d }));

    // Priya — Hotel Kings Palace, Lshi, GM
    userCompaniesToInsert.push({ user_id: "usr_priya", company_id: "co_hkp" });
    userBranchesToInsert.push({ user_id: "usr_priya", branch_id: "br_lshi_hkp" });
    ["dept_gm", "dept_bm", "dept_mktg"].forEach((d) => userDepartmentsToInsert.push({ user_id: "usr_priya", department_id: d }));

    // Rahul — Hotel Kings Palace, Lshi, Finance
    userCompaniesToInsert.push({ user_id: "usr_rahul", company_id: "co_hkp" });
    userBranchesToInsert.push({ user_id: "usr_rahul", branch_id: "br_lshi_hkp" });
    ["dept_fin", "dept_tkt"].forEach((d) => userDepartmentsToInsert.push({ user_id: "usr_rahul", department_id: d }));

    // Sara — Quin Aliza, Lshi, Marketing
    userCompaniesToInsert.push({ user_id: "usr_sara", company_id: "co_qa" });
    userBranchesToInsert.push({ user_id: "usr_sara", branch_id: "br_lshi_qa" });
    ["dept_mktg", "dept_hol"].forEach((d) => userDepartmentsToInsert.push({ user_id: "usr_sara", department_id: d }));

    // Amir — Kings Logistics, Lshi+DAR, Branch Manager
    userCompaniesToInsert.push({ user_id: "usr_amir", company_id: "co_kl" });
    ["br_lshi_kl", "br_dar_kl"].forEach((b) => userBranchesToInsert.push({ user_id: "usr_amir", branch_id: b }));
    ["dept_bm", "dept_fin"].forEach((d) => userDepartmentsToInsert.push({ user_id: "usr_amir", department_id: d }));

    await UserCompany.insertMany(userCompaniesToInsert);
    await UserBranch.insertMany(userBranchesToInsert);
    await UserDepartment.insertMany(userDepartmentsToInsert);
    console.log("✅ User access granted\n");

    // ── Messages ──────────────────────────────────────────────────────────────────
    console.log("💬 Seeding messages...");
    const groups = await ChatGroup.find({}, '_id name'); // Get all chat group IDs

    const messagesToInsert = [];

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
        messagesToInsert.push({
          _id: uuid(),
          chat_id: grp._id,
          chat_type: "group",
          sender_id: sender,
          type: "text",
          content: content,
          is_read: true,
          created_at: hoursAgo((groups.length - gi) * 2 + (10 - mi)),
        });
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
        messagesToInsert.push({
          _id: uuid(),
          chat_id: chatId,
          chat_type: "direct",
          sender_id: sender,
          type: "text",
          content: msg.content,
          is_read: true,
          created_at: msg.time,
        });
      });
    });

    // Add a few unread messages
    messagesToInsert.push({
      _id: uuid(),
      chat_id: "usr_admin",
      chat_type: "direct",
      sender_id: "usr_arjun",
      type: "text",
      content: "Salary slips sent for March, please confirm receipt.",
      is_read: false,
      created_at: minsAgo(30),
    });
    messagesToInsert.push({
      _id: uuid(),
      chat_id: "usr_admin",
      chat_type: "direct",
      sender_id: "usr_fatima",
      type: "text",
      content: "PNRs shared for the Dubai group — 12 pax confirmed.",
      is_read: false,
      created_at: minsAgo(15),
    });
    messagesToInsert.push({
      _id: uuid(),
      chat_id: "usr_admin",
      chat_type: "direct",
      sender_id: "usr_james",
      type: "text",
      content: "Flight KQ101 delayed by 2 hrs, informing pax now.",
      is_read: false,
      created_at: minsAgo(45),
    });

    await Message.insertMany(messagesToInsert);
    console.log("✅ Messages seeded\n");

    // ── Call Logs ─────────────────────────────────────────────────────────────────
    console.log("📞 Seeding call logs...");
    const callsToInsert = [];

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
      callsToInsert.push({
        _id: uuid(),
        caller_id: c.caller,
        callee_id: c.callee,
        type: c.type,
        direction: c.dir,
        duration: c.dur,
        status: c.status,
        created_at: c.time,
      }),
    );
    await CallLog.insertMany(callsToInsert);
    console.log(`✅ ${CALLS.length} call logs\n`);

    // ── Reminders ─────────────────────────────────────────────────────────────────
    console.log("🔔 Seeding reminders...");
    const remindersToInsert = [];

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
      remindersToInsert.push({
        _id: uuid(),
        title: r.title,
        note: r.note,
        due_date: r.due,
        priority: r.priority,
        status: r.status,
        for_user_id: r.for,
        created_by: r.by,
        reviewed_by: r.rev,
        reviewed_at: r.revAt,
        created_at: r.at,
      });
    });
    await Reminder.insertMany(remindersToInsert);
    console.log(`✅ ${REMINDERS.length} reminders\n`);

    // ── Summary ───────────────────────────────────────────────────────────────────
    console.log("═══════════════════════════════════════");
    console.log("🎉 Seed Complete! Summary:");
    console.log("═══════════════════════════════════════");
    console.log(
      `  Companies:    ${await Company.countDocuments()}`,
    );
    console.log(
      `  Branches:     ${await Branch.countDocuments()}`,
    );
    console.log(
      `  Departments:  ${await Department.countDocuments()}`,
    );
    console.log(
      `  Chat Groups:  ${await ChatGroup.countDocuments()}`,
    );
    console.log(
      `  Users:        ${await User.countDocuments()}`,
    );
    console.log(
      `  Messages:     ${await Message.countDocuments()}`,
    );
    console.log(
      `  Call Logs:    ${await CallLog.countDocuments()}`,
    );
    console.log(
      `  Reminders:    ${await Reminder.countDocuments()}`,
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
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
};

seed();