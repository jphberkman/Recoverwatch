const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const {
  createItem,
  getItem,
  getAllItems,
  updateItem,
  deleteItem,
  getItemStats,
  getListingsForItem,
} = require('../db/queries');
const { generateItemProfile, generateDescriptionOnlyProfile } = require('../ai/matcher');
const { writeCaseFilePdf } = require('../pdf/caseFile');
const { scanItem } = require('../scanner');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads', 'items');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `item_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// Get all items with stats
router.get('/', (req, res) => {
  try {
    const items = getAllItems();
    const itemsWithStats = items.map(item => ({
      ...item,
      stats: getItemStats(item.id),
    }));
    res.json(itemsWithStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Description-only item (no photos)
router.post('/describe-only', async (req, res) => {
  try {
    const body = req.body;
    const {
      name,
      category,
      description,
      city,
      search_radius,
      scan_frequency,
      item_type,
      material,
      color,
      era,
      distinguishing_marks,
      engravings_initials,
      unique_features,
    } = body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const narrative = [
      description,
      item_type && `Type: ${item_type}`,
      material && `Material: ${material}`,
      color && `Color: ${color}`,
      era && `Era/age: ${era}`,
      distinguishing_marks && `Distinguishing marks: ${distinguishing_marks}`,
      engravings_initials && `Engravings/initials: ${engravings_initials}`,
      unique_features && `Unique features: ${unique_features}`,
    ].filter(Boolean).join('\n\n');

    let profile = {};
    try {
      profile = await generateDescriptionOnlyProfile({
        name,
        item_type,
        material,
        color,
        era,
        distinguishing_marks,
        engravings_initials,
        unique_features,
        description: narrative,
      });
    } catch (err) {
      console.error('describe-only profile:', err.message);
      profile = { search_keywords: [name], summary: narrative };
    }

    const item = createItem({
      name,
      category,
      description: narrative,
      photos: [],
      structured_profile: profile,
      city,
      search_radius: parseInt(search_radius, 10) || 25,
      scan_frequency: scan_frequency || 'daily',
    });

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export case file PDF
router.get('/:id/export-pdf', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const item = getItem(id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const listings = getListingsForItem(id);
    writeCaseFilePdf(res, item, listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single item with stats and listings
router.get('/:id', (req, res) => {
  try {
    const item = getItem(parseInt(req.params.id));
    if (!item) return res.status(404).json({ error: 'Item not found' });
    item.stats = getItemStats(item.id);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create item with optional photo uploads
router.post('/', upload.array('photos', 3), async (req, res) => {
  try {
    const { name, category, description, city, search_radius, scan_frequency, structured_profile } = req.body;

    // Process uploaded photos
    const photos = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Resize image
        const resizedPath = file.path.replace(/(\.[^.]+)$/, '_resized$1');
        await sharp(file.path)
          .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toFile(resizedPath);

        // Replace original with resized
        fs.unlinkSync(file.path);
        fs.renameSync(resizedPath, file.path);

        photos.push(`uploads/items/${path.basename(file.path)}`);
      }
    }

    const item = createItem({
      name,
      category,
      description,
      photos,
      structured_profile: structured_profile ? JSON.parse(structured_profile) : {},
      city,
      search_radius: parseInt(search_radius) || 25,
      scan_frequency: scan_frequency || 'daily',
    });

    // Generate AI profile in background
    generateItemProfile(item).then(profile => {
      updateItem(item.id, { structured_profile: profile });
    }).catch(err => {
      console.error('Failed to generate item profile:', err.message);
    });

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update item
router.put('/:id', upload.array('photos', 3), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = getItem(id);
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    const updates = {};
    const fields = ['name', 'category', 'description', 'city', 'scan_frequency', 'active', 'status'];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates[field] = field === 'active' ? parseInt(req.body[field]) : req.body[field];
      }
    }
    if (req.body.search_radius) updates.search_radius = parseInt(req.body.search_radius);

    if (req.files && req.files.length > 0) {
      const newPhotos = [];
      for (const file of req.files) {
        const resizedPath = file.path.replace(/(\.[^.]+)$/, '_resized$1');
        await sharp(file.path)
          .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toFile(resizedPath);
        fs.unlinkSync(file.path);
        fs.renameSync(resizedPath, file.path);
        newPhotos.push(`uploads/items/${path.basename(file.path)}`);
      }
      updates.photos = [...existing.photos, ...newPhotos];
    }

    const item = updateItem(id, updates);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete item
router.delete('/:id', (req, res) => {
  try {
    deleteItem(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger scan for an item
router.post('/:id/scan', async (req, res) => {
  try {
    const item = getItem(parseInt(req.params.id));
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Run scan asynchronously
    scanItem(item).then(result => {
      console.log(`Scan complete for item ${item.id}:`, result);
    }).catch(err => {
      console.error(`Scan failed for item ${item.id}:`, err.message);
    });

    res.json({ message: 'Scan started', item_id: item.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark item as recovered
router.post('/:id/recover', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!getItem(id)) return res.status(404).json({ error: 'Item not found' });
    const item = updateItem(id, { status: 'recovered', active: 0 });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
