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
      headers: {
        'User-Agent': 'RecoverWatch/1.0',
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (location) {
          fetchUrl(location, headers).then(resolve).catch(reject);
          return;
        }
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.end();
  });
}

// --- RSS fallback (no API key needed) ---

function parseEbayRss(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const getTag = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 'is');
      const m = itemXml.match(r);
      return m ? m[1].trim() : '';
    };

    const title = getTag('title');
    const link = getTag('link');
    const description = getTag('description');

    // Extract price from title (eBay RSS often has "Item Name - $XX.XX")
    const priceMatch = title.match(/[\$£€][\d,.]+/) || description.match(/[\$£€][\d,.]+/);
    const price = priceMatch ? priceMatch[0] : 'Unknown';

    // Extract images from description HTML
    const images = [];
    const imgRegex = /src=["']([^"']+)["']/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(description)) !== null) {
      if (imgMatch[1].includes('ebayimg.com')) {
        images.push(imgMatch[1]);
      }
    }

    // Generate a listing_id from the link
    const idMatch = link.match(/\/itm\/(\d+)/);
    const listingId = idMatch ? idMatch[1] : link;

    items.push({
      platform: 'ebay',
      listing_id: listingId,
      url: link,
      title: title.replace(/\s*-\s*[\$£€][\d,.]+$/, '').trim(),
      description: description.replace(/<[^>]+>/g, '').substring(0, 500),
      price,
      location: '',
      images,
    });
  }

  return items;
}

async function searchEbayRss(keywords) {
  const results = [];

  for (let i = 0; i < keywords.length; i++) {
    if (i > 0) await delay(3000);

    const keyword = keywords[i];
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&_rss=1`;

    try {
      const { status, data } = await fetchUrl(url);
      if (status === 200) {
        const items = parseEbayRss(data);
        results.push(...items);
      }
    } catch (err) {
      console.error('eBay RSS search error for keyword:', keyword, err.message);
    }
  }

  // Deduplicate
  const seen = new Set();
  return results.filter(r => {
    if (seen.has(r.listing_id)) return false;
    seen.add(r.listing_id);
    return true;
  });
}

// --- API search (requires credentials) ---

async function searchEbayApi(keywords, token) {
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
      console.error('eBay API search error for keyword:', keyword, err.message);
    }
  }

  const seen = new Set();
  return results.filter(r => {
    if (seen.has(r.listing_id)) return false;
    seen.add(r.listing_id);
    return true;
  });
}

// --- Main entry: tries API first, falls back to RSS ---

async function searchEbay(keywords, city, radiusMiles) {
  const token = await getEbayToken();

  if (token) {
    console.log('eBay: Using Browse API');
    return searchEbayApi(keywords, token);
  }

  console.log('eBay: No API key — using public RSS feed');
  return searchEbayRss(keywords);
}

module.exports = { searchEbay };
