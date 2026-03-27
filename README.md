# RecoverWatch

Full-stack app for monitoring online marketplaces for items reported as stolen. **React + Vite + Tailwind** frontend, **Express + SQLite** backend, **Claude** for image and text matching, **eBay Browse API** and **Craigslist RSS** for automated checks, plus a **manual “paste a listing”** flow for Facebook Marketplace and other blocked sites.

## Prerequisites

- Node.js 18+
- [Anthropic API key](https://console.anthropic.com/) (`ANTHROPIC_API_KEY`)
- [eBay Developer](https://developer.ebay.com/) account (optional but recommended for live searches)

## Setup

1. **Install dependencies**

   ```bash
   cd recoverwwatch
   npm install
   cd client && npm install && cd ..
   ```

2. **Environment**

   Copy `.env.example` to `.env` in the `recoverwwatch` folder:

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   | Variable | Description |
   |----------|-------------|
   | `ANTHROPIC_API_KEY` | Required for AI profiles and match analysis |
   | `EBAY_APP_ID` | eBay Application ID (OAuth **Client ID**) |
   | `EBAY_CLIENT_SECRET` | eBay **Cert ID** (Client Secret) used with the App ID for OAuth2 client-credentials |
   | `PORT` | API port (default `3001`) |

3. **eBay Browse API credentials**

   - Register at [developer.ebay.com](https://developer.ebay.com/).
   - Create a **Developer** application and copy the **App ID (Client ID)** and **Cert ID (Client Secret)**.
   - Under **OAuth** → **Application Keys**, use the **Production** keys for live API calls (or Sandbox for testing).
   - The Browse API uses OAuth2 `client_credentials` with scope `https://api.ebay.com/oauth/api_scope`.

   Without `EBAY_APP_ID` / `EBAY_CLIENT_SECRET`, eBay searches are skipped and the app still runs (Craigslist RSS + manual paste still work).

4. **Run in development**

   ```bash
   npm run dev
   ```

   - API: `http://localhost:3001`
   - UI: `http://localhost:5173` (Vite proxies `/api` and `/uploads` to the API)

5. **Production**

   ```bash
   npm run start
   ```

   Builds the client and serves it from Express on `PORT`.

## Craigslist city

RSS URLs use the **Craigslist subdomain** (`https://{city}.craigslist.org/...`). Enter the subdomain as the city when registering an item, **e.g.** `sfbay`, `newyork`, `losangeles`. You can also paste a full Craigslist URL; the server extracts the subdomain.

## Database & uploads

- SQLite DB file: `recoverwwatch/recoverwwatch.db` (created automatically).
- Uploaded photos: `recoverwwatch/uploads/`.

## Email alerts (optional)

In **Settings**, set `notification_email` and SMTP fields. If SMTP is not configured, the server **logs** alert text to the console instead of sending mail.

## Project layout

```
recoverwwatch/
  client/          # Vite React SPA
  server/
    routes/        # Express routes
    scrapers/      # ebay.js, craigslist.js, manual.js
    ai/            # matcher.js (Claude)
    db/            # schema.js, queries.js
    pdf/           # case file PDF export
  uploads/         # item + listing images (local evidence)
  .env.example
  README.md
```

## Legal / ethics

- **eBay:** Official Browse API only (no HTML scraping).
- **Craigslist:** Public RSS feeds; rate limiting and delays are applied in the scanner.
- **Facebook Marketplace:** No automated scraping; users paste URLs manually.
- Match scores are **assistive**; always verify listings and involve law enforcement when appropriate.

## License

Use at your own risk for legitimate recovery efforts only.
