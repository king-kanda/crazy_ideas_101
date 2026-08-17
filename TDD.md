# Palda Commerce — Technical Design Document

**Owner:** Okanda (Eng) | **Status:** Draft v1 | **Last updated:** 2026-08-17
**Companion doc:** Palda_Commerce_PRD.md — read that first for scope/why; this doc is the how.

---

## 1. Architecture Overview

Palda Commerce is built as a layer on top of **Shelf**, reusing its WooCommerce connector and buyer-intelligence foundation rather than rebuilding store integration from scratch. Net-new work is: auth surface, Meta Embedded Signup, a retrieval-grounded knowledge base, and a settings/config layer — in that build order.

```
                        ┌────────────────────────┐
                        │      Palda Commerce      │
                        │   (Next.js dashboard)    │
                        └───────────┬──────────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    │               │                │
             ┌──────▼─────┐  ┌──────▼──────┐  ┌──────▼──────┐
             │   AUTH     │  │  ES LOGIN    │  │  STOREFRONT │
             │  (Phase 1) │  │  (Phase 2)   │  │  (Phase 3)  │
             └──────┬─────┘  └──────┬──────┘  └──────┬──────┘
                    │               │                │
                    │        ┌──────▼──────┐   ┌──────▼──────┐
                    │        │ Meta Graph   │   │  Shelf's    │
                    │        │ API (WA/IG/  │   │  WooCommerce│
                    │        │ FB)          │   │  connector  │
                    │        └──────┬──────┘   └──────┬──────┘
                    │               │                │
             ┌──────▼───────────────▼────────────────▼──────┐
             │            KB (Phase 4) — retrieval layer      │
             │  Qdrant (vector) + Postgres (structured facts) │
             └──────────────────────┬──────────────────────┘
                                    │
                        ┌───────────▼───────────┐
                        │   SETTINGS (Phase 5)    │
                        │  config for all above    │
                        └────────────────────────┘
```

## 2. Tech Stack

Consistent with existing stack (Shelf, HireSwam, NexusWave) to minimize new tooling overhead:

- **Backend:** FastAPI (Python), Celery + RabbitMQ for async jobs (sync jobs, webhook processing, KB re-indexing)
- **Frontend:** Next.js + TypeScript, Tailwind
- **DB:** PostgreSQL (structured data — merchants, orders, settings, KB facts), Qdrant (vector store for KB retrieval), Redis (session/cache, Celery broker backing)
- **Auth:** JWT-based session auth, password hashing via argon2/bcrypt
- **Integrations:** Meta Graph API (WhatsApp Cloud API, Embedded Signup, Instagram Messaging, Facebook Messenger), WooCommerce REST API (via Shelf's existing connector — do not re-implement)
- **Infra:** DigitalOcean (consistent with Seyyo/Wayyo infra), Docker, GitHub Actions CI/CD
- **LLM/Retrieval:** Gemini Flash or GPT-class via OpenRouter for generation; Qdrant for RAG retrieval (consistent with HireSwam's Maya stack)

## 3. Phase-by-Phase Technical Design

### Phase 1 — AUTH

**Data model:**
```
merchants (id, business_name, email, password_hash, created_at, status)
workspaces (id, merchant_id FK, timezone, currency, created_at)
sessions (id, merchant_id FK, token, expires_at)
```

**Endpoints:**
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/reset-password` / `POST /auth/reset-password/confirm`
- `GET /workspace/me` — returns current workspace shell

**Notes:**
- One workspace per merchant at launch; schema leaves room for `workspace_members` table later without migration pain — don't build the table yet, just don't paint into a corner (avoid a hard 1:1 assumption in code where a workspace_id is threaded everywhere rather than merchant_id).
- Rate-limit login/signup endpoints from day one (brute force is a real risk on a public auth endpoint).

### Phase 2 — ES Login (Meta Embedded Signup)

**Data model:**
```
meta_connections (id, workspace_id FK, platform [whatsapp|instagram|facebook],
                   external_id, access_token_encrypted, refresh_token_encrypted,
                   status [connected|expired|revoked], connected_at, last_checked_at)
webhook_subscriptions (id, meta_connection_id FK, subscribed_fields, verified_at)
```

**Flow:**
1. Merchant clicks "Connect WhatsApp" → Embedded Signup JS SDK flow (Meta-hosted).
2. On success, Meta returns an auth code → backend exchanges for access token via Graph API.
3. Backend registers webhook subscription for the WhatsApp Business Account (messages, message status).
4. Token stored encrypted at rest (application-level encryption, not just DB-level — this is a credential that grants messaging on the merchant's behalf).
5. Background job (`meta_token_health_check`, hourly) verifies token validity and flips `status` if expired/revoked, surfaced in Settings (Phase 5).

**Endpoints:**
- `POST /integrations/meta/es-callback` — handles Embedded Signup callback
- `GET /integrations/meta/status` — connection health per platform
- `DELETE /integrations/meta/{platform}` — disconnect
- `POST /webhooks/whatsapp` / `POST /webhooks/instagram` / `POST /webhooks/facebook` — inbound message receivers (verify signature, enqueue to Celery, return 200 fast — Meta will retry/timeout aggressively otherwise)

**Key risk to design around:** Meta App Review is required for production-level WhatsApp/IG permissions (per NexusWave's prior experience with multi-cycle submissions) — build against the sandbox/test number early, budget review-cycle time before this phase can go to real merchants.

### Phase 3 — Storefront (Connectors)

**Reuse:** Shelf's existing WooCommerce connector for auth (REST API keys) and data pull. Do not reimplement.

**Data model (Palda-side, mirrors/caches Shelf data for Commerce-specific use):**
```
stores (id, workspace_id FK, platform [woocommerce], site_url, connected_at, sync_status)
products (id, store_id FK, external_id, name, price, stock_qty, variants JSON, updated_at)
orders (id, store_id FK, external_id, status, total, customer_ref, created_at)
sync_jobs (id, store_id FK, started_at, finished_at, status, error)
```

**Flow:**
1. Merchant enters WooCommerce site URL + REST API keys (or reuses Shelf's existing stored connection if the merchant already has one there — check for this first to avoid asking twice).
2. Initial full sync (Celery job) pulls products, stock, recent orders.
3. Incremental sync via WooCommerce webhooks (`product.updated`, `order.created`, `order.updated`) where available; fallback to polling on a schedule if webhook delivery isn't reliable for a given store setup.
4. Manual "Re-sync now" button hits the same job, debounced.

**Endpoints:**
- `POST /integrations/woocommerce/connect`
- `GET /integrations/woocommerce/status`
- `POST /integrations/woocommerce/resync`
- `GET /catalog/products` (read-only for this phase)
- `GET /orders` (read-only for this phase)

**Explicitly not built here:** any endpoint that writes back to WooCommerce (order creation, stock decrement). That's scoped to the future Checkout phase and should not be started early — write-back correctness (double-booking stock, race conditions on checkout) deserves its own design pass, not a bolt-on here.

### Phase 4 — KB (Knowledge Base)

**Goal:** grounded retrieval, not a hallucinating agent guessing about stock or policy.

**Data model:**
```
kb_entries (id, workspace_id FK, source [product|policy|manual_faq], source_ref_id,
            content TEXT, embedding_id (Qdrant ref), updated_at)
kb_manual_entries (id, workspace_id FK, question, answer, created_by, updated_at)
```

**Pipeline:**
1. On product/order sync (Phase 3 jobs), enqueue `kb_reindex` for changed products — regenerate the text chunk (name, price, stock, description, variant info) and upsert into Qdrant with `workspace_id` as a filter field (hard multi-tenancy boundary — never let one merchant's KB leak into another's retrieval, filter at the query layer, not just at ingestion).
2. Manual FAQ entries go through the same embedding pipeline on save.
3. Retrieval endpoint takes a query + workspace_id, returns top-k grounding chunks with a freshness timestamp attached — the eventual chat agent must be able to tell "this stock figure is 3 minutes old" vs stale.

**Endpoints:**
- `POST /kb/manual` (create/update FAQ entry)
- `GET /kb/manual`
- `POST /kb/query` (internal — used by the future chat agent; also useful as a standalone "test the KB" tool in the dashboard for merchants/QA)

**Design constraint:** KB must be independently testable without the chat UI existing yet — Phase 4's success criteria (per PRD) is retrieval accuracy, not conversation quality. Build a simple internal query tool in the dashboard to validate this before the chat layer is built on top of it.

### Phase 5 — Settings

**Data model:**
```
workspace_settings (workspace_id FK, business_name, delivery_zones JSON,
                     working_hours JSON, currency, notification_prefs JSON)
agent_settings (workspace_id FK, tone, escalation_threshold, escalation_rules JSON)
cart_recovery_settings (workspace_id FK, enabled, trigger_delay_minutes,
                         max_followups, message_template, opt_out_respected BOOLEAN)
```

**Notes:**
- `escalation_rules` should be structured enough to eventually drive real agent behavior (e.g. "hand off if customer sentiment is negative," "hand off for orders above X amount") — even though the agent itself isn't built in these 5 phases, don't design a settings schema that can only hold free text; it needs to be machine-actionable later.
- `cart_recovery_settings` ships as configuration in this phase per PRD; the automation that reads it and actually fires messages depends on checkout write-back existing (deferred, see PRD Section 7) — build the settings UI/schema now, wire the automation later. Don't let this become a dead setting that silently does nothing; surface a clear "not yet active" state in the UI if the backing automation isn't live when this phase ships.

**Endpoints:**
- `GET/PUT /settings/business`
- `GET/PUT /settings/agent`
- `GET/PUT /settings/cart-recovery`
- `GET /settings/integrations` (aggregated status view across Meta + WooCommerce connections — single source of truth for "what's connected and healthy")

## 4. Cross-Cutting Concerns (apply across all phases)

- **Multi-tenancy:** every table with merchant-owned data carries `workspace_id`; every query filters on it. No shared-fate bugs across merchants — this is a hard requirement, not a nice-to-have, given this is a business tool handling customer data and payment context.
- **Secrets/tokens:** Meta and WooCommerce credentials are encrypted at rest, never logged, never returned in API responses after initial save.
- **Idempotency:** all webhook handlers (Meta, WooCommerce) must be idempotent — Meta and WooCommerce both retry on timeout, duplicate delivery will happen.
- **Observability:** structured logging + job status visibility from Phase 1 onward (sync_jobs, meta connection health) — merchants and support need to see "why isn't this working" without an engineer reading logs.
- **Kenya-specific:** timezone handling (EAT default), currency (KES default, but don't hardcode — East Africa expansion is the stated ambition).

## 5. Build Sequencing Rationale

AUTH → ES Login → Storefront → KB → Settings is deliberate:

1. **AUTH** first because nothing else has an owner without it.
2. **ES Login** before Storefront because the messaging channel is the product's core differentiator (per PRD) and has the longest external lead time (Meta App Review) — start that clock early.
3. **Storefront** before KB because KB has nothing to ground itself in without product/stock data.
4. **KB** before Settings' agent-behavior config because escalation rules need something to escalate *from* — validate retrieval quality before building the configuration surface around agent behavior.
5. **Settings** last because it's the aggregation/config layer over everything built in Phases 1–4 — building it earlier means guessing at what needs to be configurable.

## 6. Open Technical Questions (resolve before/during build, not after)

- Does Palda Commerce read Shelf's existing WooCommerce connection directly (shared service) or re-authenticate independently? Shared service is less duplication but couples release cycles — decide before Phase 3 starts.
- Webhook reliability fallback for WooCommerce stores on shared/cheap hosting (common in this market) — polling cadence needs a sane default when webhooks are unreliable.
- Token refresh strategy for long-lived Meta tokens — confirm current Meta token lifetime policy before Phase 2 (this shifts periodically on Meta's side).