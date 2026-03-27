const { getDb } = require('./schema');

// Items
function createItem({ name, category, description, photos, structured_profile, city, search_radius, scan_frequency }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO items (name, category, description, photos, structured_profile, city, search_radius, scan_frequency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    name,
    category || null,
    description || null,
    JSON.stringify(photos || []),
    JSON.stringify(structured_profile || {}),
    city || null,
    search_radius || 25,
    scan_frequency || 'daily'
  );
  return getItem(result.lastInsertRowid);
}

function getItem(id) {
  const db = getDb();
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (item) {
    item.photos = JSON.parse(item.photos);
    item.structured_profile = JSON.parse(item.structured_profile);
  }
  return item;
}

function getAllItems() {
  const db = getDb();
  const items = db.prepare('SELECT * FROM items ORDER BY created_at DESC').all();
  return items.map(item => ({
    ...item,
    photos: JSON.parse(item.photos),
    structured_profile: JSON.parse(item.structured_profile),
  }));
}

function updateItem(id, fields) {
  const db = getDb();
  const allowed = ['name', 'category', 'description', 'photos', 'structured_profile', 'city', 'search_radius', 'scan_frequency', 'active', 'status'];
  const updates = [];
  const values = [];
  for (const [key, val] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      updates.push(`${key} = ?`);
      if (key === 'photos' || key === 'structured_profile') {
        values.push(JSON.stringify(val));
      } else {
        values.push(val);
      }
    }
  }
  if (updates.length === 0) return getItem(id);
  values.push(id);
  db.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getItem(id);
}

function deleteItem(id) {
  const db = getDb();
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
}

// Scans
function createScan({ item_id, platform, listings_found, matches_flagged }) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO scans (item_id, platform, listings_found, matches_flagged)
    VALUES (?, ?, ?, ?)
  `).run(item_id, platform, listings_found || 0, matches_flagged || 0);
  return db.prepare('SELECT * FROM scans WHERE id = ?').get(result.lastInsertRowid);
}

function updateScan(id, fields) {
  const db = getDb();
  const allowed = ['listings_found', 'matches_flagged'];
  const updates = [];
  const values = [];
  for (const [key, val] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      updates.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (updates.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE scans SET ${updates.join(', ')} WHERE id = ?`).run(...values);
}

function getScansForItem(item_id) {
  const db = getDb();
  return db.prepare('SELECT * FROM scans WHERE item_id = ? ORDER BY ran_at DESC').all(item_id);
}

// Listings
function createListing({ item_id, scan_id, platform, listing_id, url, title, description, price, location, images, match_score, ai_analysis }) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO listings (item_id, scan_id, platform, listing_id, url, title, description, price, location, images, match_score, ai_analysis)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item_id, scan_id || null, platform, listing_id || null, url || null,
    title || null, description || null, price || null, location || null,
    JSON.stringify(images || []), match_score || 'unlikely', ai_analysis || null
  );
  return db.prepare('SELECT * FROM listings WHERE id = ?').get(result.lastInsertRowid);
}

function getListing(id) {
  const db = getDb();
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(id);
  if (listing) {
    listing.images = JSON.parse(listing.images);
    if (listing.ai_analysis && typeof listing.ai_analysis === 'string') {
      try {
        listing.ai_analysis = JSON.parse(listing.ai_analysis);
      } catch {
        /* keep string */
      }
    }
  }
  return listing;
}

function findExistingListing(item_id, platform, listing_id) {
  if (!listing_id) return null;
  const db = getDb();
  return db.prepare(
    'SELECT id FROM listings WHERE item_id = ? AND platform = ? AND listing_id = ?'
  ).get(item_id, platform, String(listing_id));
}

function getListingsForItem(item_id, status) {
  const db = getDb();
  let query = 'SELECT * FROM listings WHERE item_id = ?';
  const params = [item_id];
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ' ORDER BY CASE match_score WHEN \'high\' THEN 1 WHEN \'possible\' THEN 2 ELSE 3 END, flagged_at DESC';
  return db.prepare(query).all(...params).map(l => ({
    ...l,
    images: JSON.parse(l.images),
  }));
}

function updateListing(id, fields) {
  const db = getDb();
  const allowed = ['match_score', 'ai_analysis', 'status'];
  const updates = [];
  const values = [];
  for (const [key, val] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      updates.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (updates.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE listings SET ${updates.join(', ')} WHERE id = ?`).run(...values);
}

function getItemStats(item_id) {
  const db = getDb();
  const scanCount = db.prepare('SELECT COUNT(*) as count FROM scans WHERE item_id = ?').get(item_id).count;
  const matchCount = db.prepare("SELECT COUNT(*) as count FROM listings WHERE item_id = ? AND match_score IN ('high', 'possible')").get(item_id).count;
  const lastScan = db.prepare('SELECT ran_at FROM scans WHERE item_id = ? ORDER BY ran_at DESC LIMIT 1').get(item_id);
  return {
    scan_count: scanCount,
    match_count: matchCount,
    last_scanned: lastScan ? lastScan.ran_at : null,
  };
}

// Settings
function getSetting(key) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

function getAllSettings() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

module.exports = {
  createItem, getItem, getAllItems, updateItem, deleteItem,
  createScan, updateScan, getScansForItem,
  createListing, getListing, findExistingListing, getListingsForItem, updateListing, getItemStats,
  getSetting, setSetting, getAllSettings,
};
