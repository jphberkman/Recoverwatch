const { searchEbay } = require('./scrapers/ebay');
const { searchCraigslist } = require('./scrapers/craigslist');
const { analyzePhotoMatch, analyzeDescriptionMatch } = require('./ai/matcher');
const {
  getAllItems,
  createScan,
  updateScan,
  createListing,
  findExistingListing,
} = require('./db/queries');
const { notifyPotentialMatch } = require('./notify');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const LISTING_DELAY_MS = 2500;

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

async function downloadListingImages(images, itemId) {
  const uploadDir = path.join(__dirname, '..', 'uploads', 'listings', String(itemId));
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const localPaths = [];
  for (let i = 0; i < Math.min(images.length, 3); i++) {
    try {
      const ext = '.jpg';
      const filename = `listing_${Date.now()}_${i}${ext}`;
      const destPath = path.join(uploadDir, filename);
      await downloadImage(images[i], destPath);
      localPaths.push(`uploads/listings/${itemId}/${filename}`);
      await delay(500);
    } catch (err) {
      console.error('Failed to download listing image:', err.message);
    }
  }
  return localPaths;
}

async function scanItem(item) {
  console.log(`Scanning for item: ${item.name} (ID: ${item.id})`);

  const profile = typeof item.structured_profile === 'string'
    ? JSON.parse(item.structured_profile)
    : item.structured_profile;

  const keywords = profile.search_keywords && profile.search_keywords.length > 0
    ? profile.search_keywords.slice(0, 8)
    : [item.name];

  const ebayScan = createScan({
    item_id: item.id,
    platform: 'ebay',
    listings_found: 0,
    matches_flagged: 0,
  });
  const clScan = createScan({
    item_id: item.id,
    platform: 'craigslist',
    listings_found: 0,
    matches_flagged: 0,
  });

  let ebayResults = [];
  let clResults = [];

  try {
    ebayResults = await searchEbay(keywords, item.city, item.search_radius);
  } catch (err) {
    console.error('eBay scan failed:', err.message);
  }

  await delay(2500);

  try {
    clResults = await searchCraigslist(keywords, item.city);
  } catch (err) {
    console.error('Craigslist scan failed:', err.message);
  }

  let ebayMatches = 0;
  let clMatches = 0;

  for (const result of ebayResults) {
    if (findExistingListing(item.id, result.platform, result.listing_id)) continue;

    await delay(LISTING_DELAY_MS);

    let localImages = [];
    if (result.images && result.images.length > 0) {
      localImages = await downloadListingImages(result.images, item.id);
    }

    const hasPhotos = item.photos && item.photos.length > 0;
    let analysis;
    if (hasPhotos && localImages.length > 0) {
      analysis = await analyzePhotoMatch(
        item.photos, item.description,
        localImages, result.title, result.description
      );
    } else if (hasPhotos) {
      analysis = await analyzePhotoMatch(
        item.photos, item.description,
        [], result.title, result.description
      );
    } else {
      analysis = await analyzeDescriptionMatch(
        profile, result.title, result.description
      );
    }

    const matchScore = analysis.match_score || 'unlikely';
    if (matchScore === 'high' || matchScore === 'possible') ebayMatches++;

    const aiStr = typeof analysis === 'string' ? analysis : JSON.stringify(analysis);

    createListing({
      item_id: item.id,
      scan_id: ebayScan.id,
      platform: result.platform,
      listing_id: result.listing_id,
      url: result.url,
      title: result.title,
      description: result.description,
      price: result.price,
      location: result.location,
      images: localImages.length > 0 ? localImages : (result.images || []),
      match_score: matchScore,
      ai_analysis: aiStr,
    });

    if (matchScore === 'high' || matchScore === 'possible') {
      await notifyPotentialMatch({
        itemName: item.name,
        platform: result.platform,
        title: result.title,
        url: result.url,
        matchScore,
      });
    }
  }

  for (const result of clResults) {
    if (findExistingListing(item.id, result.platform, result.listing_id)) continue;

    await delay(LISTING_DELAY_MS);

    let localImages = [];
    if (result.images && result.images.length > 0) {
      localImages = await downloadListingImages(result.images, item.id);
    }

    const hasPhotos = item.photos && item.photos.length > 0;
    let analysis;
    if (hasPhotos && localImages.length > 0) {
      analysis = await analyzePhotoMatch(
        item.photos, item.description,
        localImages, result.title, result.description
      );
    } else if (hasPhotos) {
      analysis = await analyzePhotoMatch(
        item.photos, item.description,
        [], result.title, result.description
      );
    } else {
      analysis = await analyzeDescriptionMatch(
        profile, result.title, result.description
      );
    }

    const matchScore = analysis.match_score || 'unlikely';
    if (matchScore === 'high' || matchScore === 'possible') clMatches++;

    const aiStr = typeof analysis === 'string' ? analysis : JSON.stringify(analysis);

    createListing({
      item_id: item.id,
      scan_id: clScan.id,
      platform: result.platform,
      listing_id: result.listing_id,
      url: result.url,
      title: result.title,
      description: result.description,
      price: result.price,
      location: result.location,
      images: localImages.length > 0 ? localImages : (result.images || []),
      match_score: matchScore,
      ai_analysis: aiStr,
    });

    if (matchScore === 'high' || matchScore === 'possible') {
      await notifyPotentialMatch({
        itemName: item.name,
        platform: result.platform,
        title: result.title,
        url: result.url,
        matchScore,
      });
    }
  }

  updateScan(ebayScan.id, {
    listings_found: ebayResults.length,
    matches_flagged: ebayMatches,
  });
  updateScan(clScan.id, {
    listings_found: clResults.length,
    matches_flagged: clMatches,
  });

  const totalMatches = ebayMatches + clMatches;
  console.log(`Scan complete for "${item.name}": eBay ${ebayResults.length} listings (${ebayMatches} matches), CL ${clResults.length} (${clMatches} matches)`);
  return { total: ebayResults.length + clResults.length, matches: totalMatches };
}

async function scanAllActiveItems() {
  const items = getAllItems().filter(i => i.active);
  console.log(`Starting scan for ${items.length} active items`);

  for (const item of items) {
    try {
      await scanItem(item);
    } catch (err) {
      console.error(`Scan failed for item ${item.id}:`, err.message);
    }
  }
}

module.exports = { scanItem, scanAllActiveItems };
