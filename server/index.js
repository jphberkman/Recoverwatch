try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
} catch (e) {
  console.log('No .env file found, using environment variables');
}

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

// Health check — register FIRST so it always works
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'recoverwatch', port: PORT });
});

// Ensure uploads directory exists
const uploadsRoot = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot, { recursive: true });
if (!fs.existsSync(path.join(uploadsRoot, 'items'))) fs.mkdirSync(path.join(uploadsRoot, 'items'), { recursive: true });
app.use('/uploads', express.static(uploadsRoot));

// Serve client
const clientDist = path.join(__dirname, '..', 'client', 'dist');
console.log('Client dist path:', clientDist, 'exists:', fs.existsSync(clientDist));

// Start server immediately, then init DB async
app.listen(PORT, '0.0.0.0', () => {
  console.log(`RecoverWatch listening on 0.0.0.0:${PORT}`);
});

// Async init
(async () => {
  try {
    // Init database
    console.log('Initializing database...');
    const { ensureDb } = require('./db/schema');
    await ensureDb();
    console.log('Database ready');

    // Mount API routes
    app.use('/api/items', require('./routes/items'));
    app.use('/api/listings', require('./routes/listings'));
    app.use('/api/settings', require('./routes/settings'));
    console.log('API routes mounted');

    // Serve React app (must be after API routes)
    if (fs.existsSync(path.join(clientDist, 'index.html'))) {
      app.use(express.static(clientDist));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
        res.sendFile(path.join(clientDist, 'index.html'));
      });
      console.log('Serving client from', clientDist);
    } else {
      console.warn('No client build found at', clientDist);
      app.get('/', (req, res) => {
        res.send('<h1>RecoverWatch API is running</h1><p>Client build not found. Run npm run build.</p>');
      });
    }

    // Cron
    const cron = require('node-cron');
    const { scanItem } = require('./scanner');
    const { getAllItems, getItemStats } = require('./db/queries');

    cron.schedule('0 * * * *', async () => {
      const items = getAllItems().filter(i => i.active);
      if (items.length === 0) return;
      console.log(`[cron] Scanning ${items.length} item(s)`);
      for (const item of items) {
        try { await scanItem(item); } catch (err) {
          console.error(`[cron] Failed item ${item.id}:`, err.message);
        }
      }
    });

    console.log('RecoverWatch fully initialized');
  } catch (err) {
    console.error('STARTUP ERROR:', err);
  }
})();
