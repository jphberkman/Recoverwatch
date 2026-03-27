const express = require('express');
const { getAllSettings, setSetting, getSetting } = require('../db/queries');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const settings = getAllSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      setSetting(key, String(value));
    }
    res.json(getAllSettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
