# Shelf — Claude Code Notes

## What This Project Is

Shelf is a two-part buyer intelligence system for WooCommerce stores:
1. **Central platform** (Next.js + FastAPI) — store owners sign up, get an API key, view intelligence dashboards
2. **WordPress plugin** (PHP) — collects product data, search queries, cart events, active user counts and sends them to the central API

## Hard Rules

- Do not add Stripe, billing, or subscription logic anywhere
- Shopify platform option exists in the UI but is disabled ("Coming Soon") — do not implement it
- Plugin must work with WooCommerce 7.0+ and WordPress 6.0+
- All plugin-to-API communication uses `X-Shelf-API-Key` header only
- LLM calls use `llama-3.3-70b-versatile` via Groq SDK (`groq` Python package) — not Claude/OpenAI
- No user-facing email sending in MVP
- No outreach automation — data collection and intelligence only

## Architecture

```
WordPress Store
  └── Shelf WooCommerce Plugin (PHP)
        ├── Hooks: WooCommerce product catalog, WP search, cart events, WC Analytics
        ├── Admin page: WP Admin → Shelf → Insights
        └── POSTs data → Central API (X-Shelf-API-Key header)

Central API (FastAPI) — shelf-api/
  ├── POST /auth/signup
  ├── GET  /auth/verify          (X-Shelf-API-Key)
  ├── POST /ingest/products
  ├── POST /ingest/searches
  ├── POST /ingest/cart-events
  ├── POST /ingest/activity
  ├── GET  /insights/{store_id}/demand
  ├── GET  /insights/{store_id}/store
  └── GET  /insights/{store_id}/activity

Main App (Next.js) — shelf-app/
  ├── /signup → /onboarding → /dashboard
  └── Dark theme, DM Mono + Syne fonts, amber accent #F59E0B
```

## Auth Flow

- Signup page collects email + password only → stores credentials in sessionStorage temporarily
- Onboarding Step 1 collects store details → on submit, makes the actual POST /auth/signup with all fields combined
- API returns `token`, `api_key`, `store_id` (snake_case) → frontend normalizes to camelCase

## API Field Names

The FastAPI backend uses snake_case. The frontend normalizes responses in `lib/api.ts`:
- `api_key` → `apiKey`
- `store_id` → `storeId`

Request bodies are sent in snake_case to match the Pydantic schemas.

## Design

Colors follow the Palda design system in `shelf-app/.claude/designer/SKILL.md` (light off-white surfaces, lime accent). Only the color palette is inherited here — other rules (fonts, no gradients, no heavy shadows) remain project-specific.

- Background: `#FAFAF7` (`--background`, warm off-white) — `oklch(0.982 0.004 106)`
- Accent: `#C4F542` (`--lime`) — `oklch(0.92 0.2 122)`
- Accent soft (filled badges): `#E3F5B4` (`--lime-soft`) — `oklch(0.95 0.09 122)`
- Accent mist (tinted panels / hover): `#F0FBDD` (`--lime-mist`) — `oklch(0.975 0.045 124)`
- Ink (icons, dark chips, text on lime): `#1F241E` (`--ink` / `--foreground`) — `oklch(0.21 0.008 145)`
- Card surface: `#FFFFFF` (`--card`)
- Muted text: `#6E756B` (`--muted-foreground`) — `oklch(0.53 0.012 145)`
- Border (hairline): `#E7E7E2` (`--border`) — `oklch(0.918 0.006 106)`
- Destructive (errors only): `#D84A3B` (`--destructive`) — `oklch(0.577 0.245 27.325)`
- Fonts: `DM Mono` for data/numbers, `Syne` for headings (unchanged for the app; marketing surfaces per designer skill use Plus Jakarta Sans + Instrument Serif)
- Charts: Recharts, lime accent
- No gradients, no purple, no pill buttons (project override — designer skill uses pills on marketing site only)

## LLM Gap Generation (demand insights)

Uses Groq SDK with `llama-3.3-70b-versatile`. Receives top 20 zero-result searches, trending keywords from trend_cache, and the store's product catalog. Returns a JSON array of gap signals.

## Google Trends Worker

Celery task, runs daily per store. Uses `pytrends` library. Caches results in `trend_cache` table.

## Environment

- API: `shelf-api/.env` — DATABASE_URL, REDIS_URL, GROQ_API_KEY, JWT_SECRET
- App: `shelf-app/.env.local` — NEXT_PUBLIC_API_URL
- Plugin: stored in `wp_options` as `shelf_api_key`, set via the plugin settings page
