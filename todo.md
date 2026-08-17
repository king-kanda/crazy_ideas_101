# Palda Commerce — Build TODO

Derived from `PRD.md`, `TDD.md`, and the current Shelf codebase (`shelf-api/`, `shelf-app/`, `shelf-woocommerce/`).

Palette (from `shelf-app/.claude/designer/SKILL.md`, mirrored in `CLAUDE.md`): background `#FAFAF7` (off-white), accent `#C4F542` (lime), ink `#1F241E`, border `#E7E7E2`, card `#FFFFFF`.

---

## Foundation / Rename & Refactor
- [x] Rebrand `shelf-app` / `shelf-api` → Palda Commerce (UI strings, package name, FastAPI title, Celery app name, localStorage/cache-key prefixes). Header `X-Shelf-API-Key` and demo-data strings intentionally kept for plugin compat.
  - [ ] Follow-up: rename directories `shelf-app/` → `palda-commerce-app/`, `shelf-api/` → `palda-commerce-api/` (touches Procfile, start scripts, CI — do as a dedicated PR).
- [x] Introduce `workspace_id` as the tenancy key everywhere; migrate current single-tenant `Store` model to `merchants` + `workspaces` + `stores` per TDD.md:58-63 and TDD.md:105-111.
- [x] Add app-level encryption helper for tokens/secrets (used by Meta + WooCommerce credentials).
- [x] Structured logging + `sync_jobs` visibility surface (TDD §4).
- [x] Adopt Palda design-system colors in `CLAUDE.md` (off-white / lime / ink) — sourced from `shelf-app/.claude/designer/SKILL.md`.
- [x] Adopt Tailwind v4 + shadcn/ui (`new-york` style, `radix` base, `lucide` icons) with Palda tokens wired into `@theme inline`. Legacy `.card` / `.stat-value` classes kept only until each page migrates.
- [x] Shell: shadcn `Sidebar` (`collapsible="icon"`), grouped nav pre-staging every phase (Workspace / Storefront / Business Intelligence / Integrations / Settings), avatar dropdown footer, sticky header with `SidebarTrigger` + page title + last-sync + `ThemeToggle`.
- [x] Overview → real BI dashboard (`app/dashboard/page.tsx`) built on shadcn `Card`/`Badge`/`Chart`/`Skeleton`. Surfaces storefront, messaging, demand, ads-attribution, KB, cart recovery, and integrations health in one view. Phase 2/4/5 panels honestly render "Not connected / Deferred / Phase N" instead of fabricating numbers — enforces PRD §3 (no capability we can't back).
  - *Why:* PRD calls out blind ad spend, silent cart abandonment, and no memory as the core problems. The Overview needs to be the single place a merchant sees whether Palda is measuring each of those — even before the underlying phase ships — so status is legible from day one.
- [x] Rename sidebar group "Insights" → "Business Intelligence" so Demand / Store Health / Activity live under the BI umbrella that Overview now anchors.

## Phase 1 — AUTH
- [ ] New tables: `merchants`, `workspaces`, `sessions` (current `Store` conflates all three).
- [ ] Endpoints: `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/reset-password`, `POST /auth/reset-password/confirm`, `GET /workspace/me`.
- [ ] JWT session issuance + argon2/bcrypt hashing.
- [ ] Rate-limit signup/login (TDD.md:74).
- [ ] Password reset email delivery (transactional).
- [ ] Frontend: rework `(auth)/login`, `(auth)/signup`, add reset-password pages, empty workspace dashboard shell.

## Phase 2 — ES Login (Meta Embedded Signup)
- [ ] Tables: `meta_connections`, `webhook_subscriptions` (TDD.md:80-84).
- [ ] Meta App registration + App Review kickoff (long lead — start now).
- [ ] Frontend: Embedded Signup JS SDK integration; "Connect WhatsApp / IG / Facebook" flow.
- [ ] Endpoints: `POST /integrations/meta/es-callback`, `GET /integrations/meta/status`, `DELETE /integrations/meta/{platform}`.
- [ ] Webhook receivers: `POST /webhooks/whatsapp|instagram|facebook` — signature verify, enqueue to Celery, 200 fast, idempotent.
- [ ] Celery task `meta_token_health_check` (hourly).
- [ ] Token encryption at rest; never returned in API responses.

## Phase 3 — Storefront (Connectors)
- [ ] Resolve TDD.md:192 open question: shared Shelf service vs. re-auth. Decide before build.
- [ ] Tables: `stores`, `products`, `orders`, `sync_jobs` scoped to `workspace_id`.
- [ ] Extend WooCommerce plugin/ingest to include orders + stock levels + variants.
- [ ] Endpoints: `POST /integrations/woocommerce/connect`, `GET /integrations/woocommerce/status`, `POST /integrations/woocommerce/resync`, `GET /catalog/products`, `GET /orders`.
- [ ] Celery: initial full sync + incremental sync via WC webhooks; polling fallback for cheap hosts.
- [ ] Debounced "Re-sync now" button.
- [ ] Frontend: catalog view + orders view (read-only), sync health panel.

## Phase 4 — KB (Knowledge Base)
- [ ] Provision Qdrant; add embedding provider (OpenRouter/Gemini per TDD.md:52).
- [ ] Tables: `kb_entries`, `kb_manual_entries`.
- [ ] Reindex pipeline: on product/order sync, enqueue `kb_reindex`; upsert to Qdrant with `workspace_id` filter.
- [ ] Endpoints: `POST /kb/manual`, `GET /kb/manual`, `POST /kb/query` with freshness timestamps.
- [ ] Frontend: manual FAQ CRUD + internal "Test the KB" query tool.

## Phase 5 — Settings
- [ ] Tables: `workspace_settings`, `agent_settings`, `cart_recovery_settings` (TDD.md:154-160).
- [ ] Endpoints: `GET/PUT /settings/business`, `/settings/agent`, `/settings/cart-recovery`, `GET /settings/integrations`.
- [ ] Structured `escalation_rules` schema (machine-actionable, not free text).
- [ ] Cart recovery UI with explicit "Not yet active — waiting on checkout write-back" state.
- [ ] Aggregated integrations health page (Meta + WooCommerce single view).

## Cross-Cutting (all phases)
- [ ] Enforce `workspace_id` filter in every query (multi-tenancy audit).
- [ ] Idempotency keys / dedupe for all webhook handlers (Meta + WC).
- [ ] EAT timezone default, KES currency default — not hardcoded.
- [ ] Celery + RabbitMQ infra (currently Redis-backed; TDD says RabbitMQ — confirm).
- [ ] CI/CD on DigitalOcean per TDD §2.
