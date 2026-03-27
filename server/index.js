require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const cron = require('node-cron');
const { ensureDb } = require('./db/schema');

const PORT = process.env.PORT || 3001;

async function start() {
  // Initialize database first
  await ensureDb();

  const itemsRouter = require('./routes/items');
  const listingsRouter = require('./routes/listings');
  const settingsRouter = require('./routes/settings');
  const { scanItem } = require('./scanner');
  const { getAllItems, getItemStats } = require('./db/queries');

  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '2mb' }));

  // Ensure uploads directory exists
  const uploadsRoot = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot, { recursive: true });
  const itemsUploadDir = path.join(uploadsRoot, 'items');
  if (!fs.existsSync(itemsUploadDir)) fs.mkdirSync(itemsUploadDir, { recursive: true });

  app.use('/uploads', express.static(uploadsRoot));

  app.use('/api/items', itemsRouter);
  app.use('/api/listings', listingsRouter);
  app.use('/api/settings', settingsRouter);

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'recoverwatch' });
  });

  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RecoverWatch API listening on 0.0.0.0:${PORT}`);
  });

  // Cron
  function msForFrequency(freq) {
    const f = (freq || 'daily').toLowerCase();
    if (f === '6h' || f === '6') return 6 * 60 * 60 * 1000;
    if (f === '12h' || f === '12') return 12 * 60 * 60 * 1000;
    return 24 * 60 * 60 * 1000;
  }

  function shouldScanItem(item) {
    if (!item.active) return false;
    const stats = getItemStats(item.id);
    if (!stats.last_scanned) return true;
    const last = new Date(stats.last_scanned).getTime();
    const interval = msForFrequency(item.scan_frequency);
    return Date.now() - last >= interval;
  }

  cron.schedule('0 * * * *', async () => {
    const items = getAllItems().filter(shouldScanItem);
    if (items.length === 0) return;
    console.log(`[cron] Scheduled scan for ${items.length} item(s)`);
    for (const item of items) {
      try {
        await scanItem(item);
      } catch (err) {
        console.error(`[cron] Scan failed for item ${item.id}:`, err.message);
      }
    }
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
