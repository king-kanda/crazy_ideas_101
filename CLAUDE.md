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

- Background: `#0F1117`
- Accent: `#F59E0B` (amber/orange)
- Fonts: `DM Mono` for data/numbers, `Syne` for headings
- Cards: `#1E2130` border, no heavy shadows
- Charts: Recharts, amber accent
- No gradients, no purple, no pill buttons

## LLM Gap Generation (demand insights)

Uses Groq SDK with `llama-3.3-70b-versatile`. Receives top 20 zero-result searches, trending keywords from trend_cache, and the store's product catalog. Returns a JSON array of gap signals.

## Google Trends Worker

Celery task, runs daily per store. Uses `pytrends` library. Caches results in `trend_cache` table.

## Environment

- API: `shelf-api/.env` — DATABASE_URL, REDIS_URL, GROQ_API_KEY, JWT_SECRET
- App: `shelf-app/.env.local` — NEXT_PUBLIC_API_URL
- Plugin: stored in `wp_options` as `shelf_api_key`, set via the plugin settings page
