const https = require('https');

const EBAY_API_BASE = 'https://api.ebay.com/buy/browse/v1';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getEbayToken() {
  const clientId = process.env.EBAY_APP_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET || '';
  if (!clientId) return null;

  return new Promise((resolve, reject) => {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const postData = 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope';

    const options = {
      hostname: 'api.ebay.com',
      path: '/identity/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.access_token || null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
}

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function searchEbay(keywords, city, radiusMiles) {
  const token = await getEbayToken();
  if (!token) {
    console.log('eBay: No API key configured, skipping');
    return [];
  }

  const results = [];

  for (let i = 0; i < keywords.length; i++) {
    if (i > 0) await delay(2500);

    const keyword = keywords[i];
    const params = new URLSearchParams({
      q: keyword,
      limit: '20',
    });

    try {
      const { status, data } = await fetchUrl(
        `${EBAY_API_BASE}/item_summary/search?${params}`,
        { 'Authorization': `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' }
      );

      if (status === 200) {
        const parsed = JSON.parse(data);
        const items = parsed.itemSummaries || [];

        for (const item of items) {
          results.push({
            platform: 'ebay',
            listing_id: item.itemId,
            url: item.itemWebUrl,
            title: item.title,
            description: item.shortDescription || '',
            price: item.price ? `${item.price.currency} ${item.price.value}` : 'Unknown',
            location: item.itemLocation ? `${item.itemLocation.city || ''}, ${item.itemLocation.stateOrProvince || ''}` : '',
            images: item.thumbnailImages ? item.thumbnailImages.map(i => i.imageUrl) : (item.image ? [item.image.imageUrl] : []),
          });
        }
      }
    } catch (err) {
      console.error('eBay search error for keyword:', keyword, err.message);
    }
  }

  // Deduplicate by listing_id
  const seen = new Set();
  return results.filter(r => {
    if (seen.has(r.listing_id)) return false;
    seen.add(r.listing_id);
    return true;
  });
}

module.exports = { searchEbay };
