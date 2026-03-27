const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'recoverwwatch.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
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
    );

    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      ran_at TEXT DEFAULT (datetime('now')),
      listings_found INTEGER DEFAULT 0,
      matches_flagged INTEGER DEFAULT 0,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );

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
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

module.exports = { getDb };
