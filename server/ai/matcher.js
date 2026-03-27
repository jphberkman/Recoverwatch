const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function imageToBase64(filePath) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '..', '..', filePath);
  const buffer = fs.readFileSync(absPath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
  return { data: buffer.toString('base64'), media_type: mimeMap[ext] || 'image/jpeg' };
}

async function generateDescriptionOnlyProfile(fields) {
  const client = getClient();
  const {
    name,
    item_type,
    material,
    color,
    era,
    distinguishing_marks,
    engravings_initials,
    unique_features,
    description,
  } = fields;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1536,
    messages: [{
      role: 'user',
      content: `You are helping a theft victim who has no photos of a stolen heirloom or unique item.

Structured details:
- Name / label: ${name || 'Not provided'}
- Item type: ${item_type || 'Not provided'}
- Material: ${material || 'Not provided'}
- Color: ${color || 'Not provided'}
- Approximate era/age: ${era || 'Not provided'}
- Distinguishing marks: ${distinguishing_marks || 'Not provided'}
- Engravings / initials: ${engravings_initials || 'Not provided'}
- Unique features: ${unique_features || 'Not provided'}
- Additional narrative: ${description || 'Not provided'}

Produce a structured search profile as JSON:
{
  "summary": "1-2 sentence summary for investigators",
  "search_keywords": ["8-15 keyword variants including abbreviations, common misspellings, model names, materials"],
  "visual_features": ["what a seller might photograph or describe"],
  "brand": "if inferable",
  "model": "if inferable",
  "color": "normalized",
  "era_notes": "era/age hints",
  "distinguishing_marks": ["list"],
  "engravings_initials": ["normalized"],
  "condition_notes": "optional"
}

Be conservative and thorough — keyword variants are critical for marketplace search.

Return ONLY valid JSON, no markdown.`,
    }],
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return {
      summary: response.content[0].text,
      search_keywords: [name, item_type, material].filter(Boolean),
      visual_features: [],
    };
  }
}

async function generateItemProfile(item) {
  const client = getClient();
  const content = [];

  if (item.photos && item.photos.length > 0) {
    for (const photo of item.photos) {
      try {
        const img = imageToBase64(photo);
        content.push({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } });
      } catch (e) {
        console.error('Failed to load photo:', photo, e.message);
      }
    }
  }

  content.push({
    type: 'text',
    text: `You are helping a theft victim catalog their stolen item for marketplace monitoring.

Item details provided:
- Name: ${item.name || 'Not provided'}
- Category: ${item.category || 'Not provided'}
- Description: ${item.description || 'Not provided'}

Based on the images (if provided) and description, generate a structured profile as JSON:
{
  "summary": "Brief 1-2 sentence description of the item",
  "search_keywords": ["array", "of", "search", "terms", "including", "brand", "model", "variants"],
  "visual_features": ["distinctive visual characteristics"],
  "brand": "brand name if identifiable",
  "model": "model name if identifiable",
  "color": "primary color(s)",
  "condition_notes": "any notable condition details from photos",
  "distinguishing_marks": ["unique features, engravings, damage, etc."]
}

Generate keyword variants that someone reselling might use (misspellings, abbreviations, alternate names). Be thorough — missing a keyword could mean missing the stolen item.

Return ONLY the JSON, no markdown.`
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content }],
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { summary: response.content[0].text, search_keywords: [], visual_features: [] };
  }
}

async function analyzePhotoMatch(itemPhotos, itemDescription, listingImages, listingTitle, listingDescription) {
  const client = getClient();
  const content = [];

  content.push({ type: 'text', text: 'REFERENCE PHOTOS OF STOLEN ITEM:' });

  for (const photo of (itemPhotos || [])) {
    try {
      const img = imageToBase64(photo);
      content.push({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } });
    } catch (e) {
      console.error('Failed to load reference photo:', e.message);
    }
  }

  content.push({ type: 'text', text: 'LISTING PHOTOS TO COMPARE:' });

  for (const photo of (listingImages || [])) {
    try {
      const img = imageToBase64(photo);
      content.push({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } });
    } catch (e) {
      console.error('Failed to load listing photo:', e.message);
    }
  }

  content.push({
    type: 'text',
    text: `You are helping a theft victim identify their stolen property on online marketplaces.

STOLEN ITEM DESCRIPTION: ${itemDescription || 'See reference photos'}

LISTING TITLE: ${listingTitle || 'Unknown'}
LISTING DESCRIPTION: ${listingDescription || 'No description'}

Compare the reference photos of the stolen item with the listing photos. Analyze:
1. Visual similarity (shape, color, size, brand markings, wear patterns)
2. Distinguishing marks or unique features
3. Whether this appears to be the SAME specific item (not just same model)
4. Any suspicious indicators (stock photos, obscured serial numbers, etc.)

Be conservative — it's better to flag a possible match than to miss the stolen item.

Respond as JSON:
{
  "match_score": "high" | "possible" | "unlikely",
  "confidence_pct": 0-100,
  "explanation": "Detailed explanation of your analysis",
  "matching_features": ["list of features that match"],
  "differing_features": ["list of features that differ"],
  "suspicious_indicators": ["any red flags in the listing"]
}

Return ONLY the JSON, no markdown.`
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content }],
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { match_score: 'unlikely', explanation: response.content[0].text };
  }
}

async function analyzeDescriptionMatch(itemProfile, listingTitle, listingDescription) {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are helping a theft victim identify their stolen property on online marketplaces.

STOLEN ITEM PROFILE:
${JSON.stringify(itemProfile, null, 2)}

MARKETPLACE LISTING:
Title: ${listingTitle || 'Unknown'}
Description: ${listingDescription || 'No description'}

Compare the stolen item profile with this marketplace listing. Look for:
1. Matching brand, model, color, material
2. Matching distinguishing marks, engravings, initials
3. Matching era/age indicators
4. Suspicious pricing (below market value)
5. Any specific details from the stolen item description that appear in the listing

Be conservative — flag possible matches so the victim can review.

Respond as JSON:
{
  "match_score": "high" | "possible" | "unlikely",
  "confidence_pct": 0-100,
  "explanation": "Detailed explanation",
  "matching_details": ["specific details that match"],
  "suspicious_indicators": ["any red flags"]
}

Return ONLY the JSON, no markdown.`
    }],
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { match_score: 'unlikely', explanation: response.content[0].text };
  }
}

async function analyzeManualListing(item, listingUrl, listingTitle, listingDescription, listingImages) {
  if (item.photos && item.photos.length > 0 && listingImages && listingImages.length > 0) {
    return analyzePhotoMatch(item.photos, item.description, listingImages, listingTitle, listingDescription);
  }
  return analyzeDescriptionMatch(item.structured_profile, listingTitle, listingDescription);
}

module.exports = {
  generateItemProfile,
  generateDescriptionOnlyProfile,
  analyzePhotoMatch,
  analyzeDescriptionMatch,
  analyzeManualListing,
};
