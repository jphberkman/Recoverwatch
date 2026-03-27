const https = require('https');
const http = require('http');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchRss(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseRssItems(xml) {
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

    // Extract images from description HTML
    const images = [];
    const imgRegex = /src=["']([^"']+)["']/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(description)) !== null) {
      images.push(imgMatch[1]);
    }

    items.push({
      platform: 'craigslist',
      listing_id: link,
      url: link,
      title,
      description: description.replace(/<[^>]+>/g, '').substring(0, 500),
      price: extractPrice(title),
      location: '',
      images,
    });
  }

  return items;
}

function extractPrice(title) {
  const match = title.match(/\$[\d,]+/);
  return match ? match[0] : 'Unknown';
}

function cityToCraigslistSubdomain(city) {
  if (!city) return '';
  const c = city.trim().toLowerCase();
  const fromUrl = c.match(/https?:\/\/([a-z0-9]+)\.craigslist\.org/i);
  if (fromUrl) return fromUrl[1];
  return c.replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

async function searchCraigslist(keywords, city) {
  if (!city) {
    console.log('Craigslist: No city configured, skipping');
    return [];
  }

  const citySlug = cityToCraigslistSubdomain(city);
  if (!citySlug) {
    console.log('Craigslist: Could not derive subdomain from city');
    return [];
  }
  const results = [];

  for (let i = 0; i < keywords.length; i++) {
    if (i > 0) await delay(3000);

    const keyword = keywords[i];
    const url = `https://${citySlug}.craigslist.org/search/sss?format=rss&query=${encodeURIComponent(keyword)}`;

    try {
      const xml = await fetchRss(url);
      const items = parseRssItems(xml);
      results.push(...items);
    } catch (err) {
      console.error('Craigslist search error for keyword:', keyword, err.message);
    }
  }

  // Deduplicate by URL
  const seen = new Set();
  return results.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

module.exports = { searchCraigslist };
