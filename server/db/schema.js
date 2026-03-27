const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'recoverwwatch.db');

let db;
let dbReady;

// sql.js uses an async init, so we wrap it
function initPromise() {
  if (!dbReady) {
    dbReady = initSqlJs().then(SQL => {
      let data = null;
      if (fs.existsSync(DB_PATH)) {
        data = fs.readFileSync(DB_PATH);
      }
      db = data ? new SQL.Database(data) : new SQL.Database();
      db.run('PRAGMA foreign_keys = ON');
      initSchema();
      // Auto-save every 30 seconds
      setInterval(() => saveDb(), 30000);
      return db;
    });
  }
  return dbReady;
}

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) {
    console.error('Failed to save DB:', e.message);
  }
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      photos TEXT DEFAULT '[]',
      structured_profile TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      city TEXT,
      search_radius INTEGER DEFAULT 25,
      scan_frequency TEXT DEFAULT 'daily',
      active INTEGER DEFAULT 1,
      status TEXT DEFAULT 'watching'
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      ran_at TEXT DEFAULT (datetime('now')),
      listings_found INTEGER DEFAULT 0,
      matches_flagged INTEGER DEFAULT 0,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      scan_id INTEGER,
      platform TEXT NOT NULL,
      listing_id TEXT,
      url TEXT,
      title TEXT,
      description TEXT,
      price TEXT,
      location TEXT,
      images TEXT DEFAULT '[]',
      match_score TEXT DEFAULT 'unlikely',
      ai_analysis TEXT,
      flagged_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'new',
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE SET NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}

// Wrapper that mimics better-sqlite3 API using sql.js
function getDb() {
  if (!db) throw new Error('Database not initialized — call await ensureDb() first');
  return {
    prepare(sql) {
      return {
        run(...params) {
          db.run(sql, params);
          saveDb();
          const lastId = db.exec('SELECT last_insert_rowid() as id')[0];
          const changes = db.getRowsModified();
          return {
            lastInsertRowid: lastId ? lastId.values[0][0] : 0,
            changes,
          };
        },
        get(...params) {
          const stmt = db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            stmt.free();
            const row = {};
            cols.forEach((c, i) => row[c] = vals[i]);
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const results = [];
          const stmt = db.prepare(sql);
          stmt.bind(params);
          while (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const row = {};
            cols.forEach((c, i) => row[c] = vals[i]);
            results.push(row);
          }
          stmt.free();
          return results;
        },
      };
    },
  };
}

async function ensureDb() {
  await initPromise();
  return getDb();
}

module.exports = { getDb, ensureDb, saveDb };
