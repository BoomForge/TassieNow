# TassieNow

TassieNow is a zero-cost-first Tasmanian tourism and local discovery directory for locals and visitors.

## Current stage

Bootstrap MVP. The first seed catalogue is intentionally small while the discovery and validation pipeline is developed.

## Local development

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Quality/build check:

```bash
npm run build
```

## Cloudflare Pages deployment

Connect this repository to Cloudflare Pages using these settings:

- **Production branch:** `main`
- **Framework preset:** Astro
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Root directory:** leave blank / repository root
- **Environment variables:** none required for the first deployment

Cloudflare will automatically rebuild the public site after changes land on `main`.

## Data model

The canonical bootstrap catalogue lives in `src/data/places.json`. Each record has a stable slug, location, categories, coordinates, official/source URL, status and last-checked date.

Run `npm run validate:data` to catch missing fields, duplicate slugs, invalid URLs and obviously non-Tasmanian coordinates before deployment.

## Principles

- Zero hosting/database cost until demand justifies spending.
- Portable data rather than platform lock-in.
- Factual listings with source provenance.
- No scraping Google Maps or copying business marketing text.
- Automation handles mechanical work; uncertain claims are reviewed rather than guessed.
- Basic business inclusion will remain free; future monetisation can sit around discovery rather than gatekeeping it.
