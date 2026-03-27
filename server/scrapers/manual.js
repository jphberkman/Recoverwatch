// Manual listing check — user pastes a URL or listing details
// Used for Facebook Marketplace and other platforms that block scraping

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { analyzeManualListing } = require('../ai/matcher');
const { createListing, createScan } = require('../db/queries');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlink(destPath, () => {});
        downloadImage(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function persistListingImages(imageInputs, itemId) {
  if (!imageInputs || !imageInputs.length) return [];
  const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'listings', String(itemId), 'manual');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const out = [];
  for (let i = 0; i < Math.min(imageInputs.length, 5); i++) {
    const raw = imageInputs[i];
    if (!raw) continue;
    if (typeof raw === 'string' && (raw.startsWith('http://') || raw.startsWith('https://'))) {
      try {
        const filename = `manual_${Date.now()}_${i}.jpg`;
        const destPath = path.join(uploadDir, filename);
        await downloadImage(raw, destPath);
        out.push(`uploads/listings/${itemId}/manual/${filename}`);
        await delay(400);
      } catch (err) {
        console.error('Manual image download failed:', err.message);
      }
    } else if (typeof raw === 'string' && !raw.includes('://')) {
      out.push(raw);
    }
  }
  return out;
}

async function checkManualListing(item, { url, title, description, images }) {
  const localImages = await persistListingImages(images, item.id);

  const scan = createScan({
    item_id: item.id,
    platform: 'manual',
    listings_found: 1,
    matches_flagged: 0,
  });

  const analysis = await analyzeManualListing(
    item,
    url,
    title,
    description,
    localImages.length ? localImages : images
  );

  const listing = createListing({
    item_id: item.id,
    scan_id: scan.id,
    platform: detectPlatform(url),
    listing_id: url || `manual_${Date.now()}`,
    url,
    title,
    description,
    price: null,
    location: null,
    images: localImages.length ? localImages : (images || []),
    match_score: analysis.match_score || 'unlikely',
    ai_analysis: JSON.stringify(analysis),
  });

  return { listing, analysis };
}

function detectPlatform(url) {
  if (!url) return 'manual';
  if (url.includes('facebook.com') || url.includes('fb.com')) return 'facebook';
  if (url.includes('ebay.com')) return 'ebay';
  if (url.includes('craigslist.org')) return 'craigslist';
  if (url.includes('offerup.com')) return 'offerup';
  if (url.includes('mercari.com')) return 'mercari';
  return 'manual';
}

module.exports = { checkManualListing };
