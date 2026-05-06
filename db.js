// db.js — SQLite Schema & Seed
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'travkings.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    tagline    TEXT DEFAULT '',
    avatar     TEXT DEFAULT '🏢',
    color      TEXT DEFAULT '#3B82F6',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS branches (
    id         TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    city       TEXT DEFAULT '',
    avatar     TEXT DEFAULT '🌿',
    color      TEXT DEFAULT '#10B981',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS departments (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    short_name TEXT NOT NULL,
    icon       TEXT DEFAULT '🏷️',
    color      TEXT DEFAULT '#8B5CF6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    email          TEXT UNIQUE NOT NULL,
    password_hash  TEXT NOT NULL,
    role           TEXT DEFAULT 'User',
    avatar         TEXT DEFAULT '👤',
    color          TEXT DEFAULT '#60A5FA',
    is_super_admin INTEGER DEFAULT 0,
    is_active      INTEGER DEFAULT 1,
    last_seen      DATETIME,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_companies (
    user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
    company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, company_id)
  );
  CREATE TABLE IF NOT EXISTS user_branches (
    user_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, branch_id)
  );
  CREATE TABLE IF NOT EXISTS user_departments (
    user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
    department_id TEXT REFERENCES departments(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, department_id)
  );

  CREATE TABLE IF NOT EXISTS chat_groups (
    id            TEXT PRIMARY KEY,
    branch_id     TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, department_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id        TEXT PRIMARY KEY,
    chat_id   TEXT NOT NULL,
    chat_type TEXT NOT NULL DEFAULT 'group',
    sender_id TEXT NOT NULL REFERENCES users(id),
    type      TEXT NOT NULL DEFAULT 'text',
    content   TEXT,
    file_url  TEXT,
    file_name TEXT,
    file_size TEXT,
    duration  INTEGER,
    is_read   INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS call_logs (
    id         TEXT PRIMARY KEY,
    caller_id  TEXT NOT NULL REFERENCES users(id),
    callee_id  TEXT NOT NULL REFERENCES users(id),
    type       TEXT DEFAULT 'voice',
    direction  TEXT DEFAULT 'outgoing',
    duration   INTEGER DEFAULT 0,
    status     TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    note        TEXT DEFAULT '',
    due_date    DATETIME,
    priority    TEXT DEFAULT 'medium',
    status      TEXT DEFAULT 'pending',
    for_user_id TEXT NOT NULL REFERENCES users(id),
    created_by  TEXT NOT NULL REFERENCES users(id),
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed 6 default departments
const deptCount = db.prepare('SELECT COUNT(*) as n FROM departments').get().n;
if (deptCount === 0) {
  const ins = db.prepare('INSERT INTO departments (id,name,short_name,icon,color) VALUES (?,?,?,?,?)');
  [
    ['dept_mktg','Marketing',     'MKTG','📣','#F59E0B'],
    ['dept_fin', 'Finance',        'FIN', '💰','#10B981'],
    ['dept_tkt', 'Ticketing',      'TKT', '🎫','#3B82F6'],
    ['dept_hol', 'Holidays',       'HOL', '🌴','#EC4899'],
    ['dept_bm',  'Branch Manager', 'BM',  '🏢','#8B5CF6'],
    ['dept_gm',  'General Manager','GM',  '👔','#EF4444'],
  ].forEach(d => ins.run(...d));
  console.log('✅ Seeded 6 default departments');
}

module.exports = db;