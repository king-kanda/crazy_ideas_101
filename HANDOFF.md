# Palda Commerce — Handoff

Snapshot date: 2026-11-15. Branch: `trunk`. Based on `PRD.md`, `TDD.md`, `todo.md`, and a direct read of the code. Claims below were checked against the code unless marked **(unverified)**.

## 1. TL;DR

- **Phases 1 (Auth), 2 (Meta Embedded Signup) and 3 (Storefront) are built on the backend and dashboard.**
- **Phase 3 is not finished end to end.** The API and dashboard exist, but the WordPress plugin does not send orders or stock yet, so the Orders page will stay empty for real stores.
- **Phase 3 is also uncommitted.** It is staged but not committed (see §6).
- **Phases 4 (KB) and 5 (Settings) are not started.** There is no Qdrant, no KB tables, and no `/settings/*` endpoints.
- **Nothing has been tested against live Meta or a real WooCommerce store.** The only automated tests cover Google Trends.
- **Known bug:** the daily Google Trends Celery task fails on every run (§5).

## 2. How to run it locally

Postgres (`:5432`) and Redis (`:6379`) must be running. Both were already running as system services on this machine.

```bash
cd shelf-api && ./start.sh    # FastAPI :8000 + Celery worker + Celery beat (creates .venv, pip installs)
cd shelf-app && ./start.sh    # Next.js dev :3000
```

- API docs: http://localhost:8000/docs. Health check: `GET /health`.
- `shelf-api/start-workers.sh` runs only the workers, with logs in `shelf-api/logs/`.
- API env (`shelf-api/.env`): the local file only has `DATABASE_URL`, `REDIS_URL`, `GROQ_API_KEY`, `JWT_SECRET`. Meta needs `TOKEN_ENCRYPTION_KEY`, `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION`, `META_REDIRECT_URI`, `META_WEBHOOK_VERIFY_TOKEN`. These are listed in `.env.example`.
- App env (`shelf-app/.env.local`): `.env.local.example` also lists `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and the `NEXT_PUBLIC_META_*` values. Google OAuth setup is documented in `shelf-app/docs/google-oauth.md`.
- Verified today: `pytest` gives 30 passed (all in `tests/test_trends.py`), and `tsc --noEmit` is clean.
- Schema changes happen in `init_db()` at boot, with additive and idempotent backfills. **There is no Alembic.** Treat that as a risk for production (§7).

## 3. What is built

### Foundation
- Rebrand to Palda Commerce in UI strings, the FastAPI title and the Celery app name.
- Tenancy model: `merchants` → `workspaces` → `stores`. Merchant-owned tables carry `workspace_id`.
- Fernet token encryption in `crypto.py`. Production must set `TOKEN_ENCRYPTION_KEY`. Without it, the key is derived from `JWT_SECRET`.
- UI: Tailwind v4 and shadcn/ui, with a grouped sidebar. `/dashboard` is a business-intelligence overview. Panels for phases that aren't built say so instead of showing made-up numbers.

### Phase 1 — Auth (complete except email)
- Endpoints: `/auth/signup`, `/login`, `/oauth` (Google), `/logout`, `/reset-password`, `/reset-password/confirm`, `GET /workspace/me`, `POST /workspace/store`.
- Rate limiting on signup, login and reset. Argon2 hashing, with legacy bcrypt hashes rehashed on login.
- Frontend: login, signup, reset pages, Google sign-in through Auth.js v5, empty-workspace state, and onboarding.
- Legacy Shelf routes still work: the plugin's `X-Shelf-API-Key` header and the `/insights/*` routes.

### Phase 2 — Meta Embedded Signup (backend and UI built, unproven against Meta)
- Tables: `meta_connections`, `webhook_subscriptions`, `webhook_events`.
- Endpoints: `POST /integrations/meta/es-callback`, `GET /integrations/meta/status`, `DELETE /integrations/meta/{platform}`, `GET/POST /webhooks/{platform}`.
- Webhook receiver: hub challenge verification, `X-Hub-Signature-256` check, dedupe on `(platform, event_id)`, then a Celery task is queued.
- Hourly `meta_token_health_check` task. It does not auto-refresh tokens.
- UI: `/dashboard/integrations/meta` with connect and disconnect buttons.

### Phase 3 — Storefront (API and dashboard built, plugin not)
- Tables: `orders`, `order_items`, `sync_jobs`, plus new columns on `products` and `stores`.
- Endpoints: `POST /ingest/orders`, `POST /ingest/stock`, `GET /integrations/woocommerce/status`, `POST .../resync` (60s debounce), `GET .../resync-flag`, `GET /products`, `GET /orders`.
- UI: `/dashboard/catalog`, `/dashboard/orders`, `/dashboard/integrations/woocommerce`.
- Design decision: the plugin owns the WooCommerce connection through the store's API key. There is no shared service with Shelf.

### Legacy Shelf intelligence (pre-existing, working)
- Plugin v1.5.2 sends products (hourly), searches, cart events and activity.
- `/insights/{store_id}/demand|store|activity` pages, Groq (`llama-3.3-70b-versatile`) gap analysis, Google Trends worker, and a demo-data loader under `/labs`.

## 4. What is not built

### Blocking Phase 3 (plugin work in `shelf-woocommerce/`)
- The plugin has no hooks for `woocommerce_new_order`, `woocommerce_order_status_changed`, `woocommerce_product_set_stock` or `woocommerce_variation_set_stock`. It never calls `/ingest/orders` or `/ingest/stock`.
- The plugin does not poll `/integrations/woocommerce/resync-flag`, so the dashboard's "Re-sync now" button has no effect. The server only flips a flag.
- Variants and attributes are not synced.
- There is no polling-fallback Celery task for stores with unreliable WooCommerce webhooks.
- The plugin zip at the repo root (`shelf-woocommerce.zip`) will need rebuilding and a version bump after these changes.

### Phase 2 gaps
- **No webhook subscription is registered with Meta.** `es_callback` stores the token and nothing else. The `WebhookSubscription` model exists but is never written, so inbound messages will not reach us from Meta's side until the WABA is subscribed. TDD §3 step 3 requires this.
- The PRD success criterion "live test message round-trip" has no implementation.
- `process_webhook_event` only marks events processed. The handlers are marked TODO for Phases 4 and 5.
- Expiring tokens are only flagged. There is no refresh flow. Meta's current token lifetime policy was an open TDD question and has not been checked.
- Meta App Review is recorded as done in `todo.md` ("user-confirmed"). I could not verify this.

### Phase 1 gaps
- Password reset email is not sent. The token comes back as `dev_token` in the response, which is deliberate under the "no email in MVP" rule.
- **Logout does not revoke the token.** `/auth/logout` writes an audit row, but nothing checks the `sessions` table when a JWT is presented. A token stays valid until it expires.

### Phase 4 — KB (nothing started)
- Qdrant, an embedding provider, `kb_entries`, `kb_manual_entries`, the reindex pipeline, `/kb/*` endpoints, and the dashboard FAQ and "Test the KB" UI. The sidebar item `/dashboard/kb` is a "Soon" badge.
- Note: CLAUDE.md says LLM calls use Groq only. The TDD mentions Gemini/OpenRouter for embeddings and generation. Decide which applies before starting.

### Phase 5 — Settings (nothing started)
- Tables `workspace_settings`, `agent_settings`, `cart_recovery_settings`, the `/settings/*` endpoints, and the structured `escalation_rules` schema.
- The aggregated integrations health page, the cart recovery UI with its "not yet active" state, and team/staff access.
- Sidebar routes `/dashboard/settings/agent`, `/cart-recovery` and `/team` are marked "Soon" and have no pages. `/dashboard/inbox` is also "Soon".

### Cross-cutting (open in `todo.md`)
- **No multi-tenancy audit has been done.** `insights.py` and `labs.py` contain no `workspace_id` references; they scope by store through the JWT or API key. This is probably fine but is not proven.
- Webhook idempotency exists for Meta. WooCommerce webhook handling does not exist yet.
- EAT timezone and KES currency defaults are not applied. The TDD says to avoid hardcoding them.
- **Celery uses Redis as the broker. The TDD specifies RabbitMQ.** Confirm which to use.
- No CI/CD, no Docker, no DigitalOcean setup. The repo still carries Heroku files (`Procfile`, `runtime.txt`).
- The directory rename (`shelf-app/` → `palda-commerce-app/`, `shelf-api/` → `palda-commerce-api/`) is deferred to its own PR.

## 5. Known issues

1. **Trends worker fails every run.** `workers/trends.py:345` (`_run_fetch_for_store`) hits `RuntimeError: ... attached to a different loop`.
   - The cause is that the module-level async SQLAlchemy engine (asyncpg) is reused across fresh event loops inside Celery tasks.
   - Likely fixes: build the engine inside the task, or use `NullPool` for the worker. `workers/meta_events.py` already uses a sync engine, which is another option.
   - Effect: Google Trends data goes stale, which weakens Demand insights.
2. **`DeprecationWarning`:** `datetime.utcnow()` is used throughout (tests flag `trends.py:329`). It works today but is scheduled for removal.
3. **CORS is `allow_origins=["*"]` with `allow_credentials=True`** in `main.py`. Restrict this before production.
4. **JWT defaults:** `JWT_SECRET` falls back to `"change-me-in-production"` if unset. Fail startup instead in production.
5. **Celery beat state file:** `shelf-api/celerybeat-schedule` is a local file written next to the code. It is not tracked today, but add it to `.gitignore` explicitly.

## 6. Repo state

- The latest commit is `d5710cf` (Phase 2). The Phase 3 work is **staged but not committed**: `catalog.py`, `integrations_woocommerce.py`, the changes to `ingest.py`, `models.py`, `schemas.py`, `database.py` and `main.py`, three new dashboard pages, `AppSidebar.tsx`, `lib/api.ts` and `todo.md`.
- `.claude/` is untracked. Decide whether to commit it or ignore it.
- `.env` and `.env.local` are not tracked.
- The current branch is `trunk`. The git status snapshot lists `claude/inspiring-lamport-OoZhC` as the PR base branch.

## 7. Suggested next steps (in order)

1. Commit the Phase 3 work. Review the staged diff first, since it was not reviewed in this pass.
2. Fix the Celery event-loop bug (§5.1) so scheduled jobs actually run.
3. Finish the Phase 3 plugin work (§4): order and stock hooks, the resync-flag poll, variants. Test against a real WooCommerce site. Then check the PRD criterion that data appears "within minutes".
4. Subscribe the WABA to webhooks in `es_callback`, and test with the Meta sandbox number (including a test-message round trip).
5. Make logout meaningful: check the `sessions` table (or a revocation list) when validating JWTs.
6. Add tests for auth, ingest, catalog and the Meta webhook (signature, dedupe). Right now only Trends is covered.
7. Do the multi-tenancy audit, and decide on Alembic before the next schema change.
8. Start Phase 4 after settling the embeddings/LLM provider question (Groq-only rule vs the TDD's OpenRouter).
9. Settle infrastructure: RabbitMQ vs Redis, Docker, CI, and DigitalOcean vs the current Heroku files.

## 8. Hard rules to keep (from `CLAUDE.md`)

- No Stripe, billing or subscription logic.
- Shopify stays "Coming Soon". Do not implement it.
- Plugin must work with WooCommerce 7.0+ and WordPress 6.0+.
- Plugin-to-API traffic uses the `X-Shelf-API-Key` header only.
- LLM calls use Groq with `llama-3.3-70b-versatile`.
- No user-facing email sending in the MVP and no outreach automation.
- UI: Palda palette (off-white, lime, ink), no gradients, no purple, no pill buttons. Prefer shadcn primitives (Card, Badge, Chart) over the legacy `.card` and `.stat-value` classes.
