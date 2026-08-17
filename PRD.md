# Palda Commerce — Product Requirements Document

**Owner:** Okanda (Product) | **Status:** Draft v1 | **Last updated:** 2026-08-17

---

## 1. Vision

Palda Commerce is the always-on layer between a merchant's ads, their inbox, and their checkout. It gives Kenyan e-commerce sellers a WhatsApp-first sales agent that knows their store, a checkout that actually works, and visibility into what's driving sales — without ever promising sales it can't guarantee.

## 2. Problem Statement

Kenyan e-commerce is broken not because the tools don't exist, but because most shops are built to the budget, not the customer or the business. This shows up as:

- **Availability gap** — customers message at odd hours (2AM is common) and go cold by the time a human replies.
- **Broken checkout** — orders get lost in chat threads, stock isn't confirmed live, payment proof is a manual screenshot check.
- **No memory** — every conversation restarts from zero; a 1,000-conversation merchant can't remember any of them.
- **Trust deficit** — buyers default to WhatsApp/social because it's the only channel with a provable human on the other end, but that human doesn't scale.
- **Blind ad spend** — merchants spend on Meta ads with no reliable line from spend to actual sale.
- **Silent cart abandonment** — nobody follows up, or follow-up is a generic templated blast.

## 3. Product Promise (do not exceed this)

> "We don't promise you sales. We make sure you never lose one to a slow reply, a broken checkout, an abandoned cart nobody followed up on, or a conversation that starts from zero."

**Explicitly out of scope for promises:** cross-platform identity resolution without a deterministic link (e.g. matching an IG comment to an unrelated WhatsApp DM). Only claim continuity where a real technical signal exists (Meta `ctwa_clid` / click-to-WhatsApp, IGSID-scoped IG↔Messenger, or a phone/email the customer has already given us).

## 4. Target User

SME e-commerce operators in Kenya (and East Africa) running a WooCommerce storefront, currently taking a meaningful share of orders through WhatsApp/Instagram/Facebook DMs, with 1–20 staff and no dedicated engineering team.

## 5. Foundation

Built on top of **Shelf** (existing buyer-intelligence engine), reusing its WooCommerce connectors for store data (products, stock, orders). This means Auth/store-sync plumbing is largely inherited; net-new work is the layers listed in Section 6.

## 6. Phased Scope

Each phase should ship as a usable increment — no phase should require the next to demo value.

### Phase 1 — AUTH
**Goal:** A merchant can create a Palda Commerce account and securely access their workspace.
- Merchant signup/login (email + password, plus session/JWT handling)
- Workspace concept (one merchant = one workspace, room for multi-user/staff roles later)
- Password reset, basic account settings shell
- **Out of scope this phase:** team roles/permissions beyond owner, SSO

**Success criteria:** A merchant can sign up, log in, land on an empty workspace dashboard.

### Phase 2 — ES Login (Meta Embedded Signup)
**Goal:** A merchant can connect their WhatsApp Business number and Meta assets without leaving Palda.
- Meta Embedded Signup flow (WhatsApp Cloud API) — number provisioning/linking
- Instagram + Facebook Page connection (for DM channels and future ad data)
- Token storage, refresh, and health/status surfacing (is the connection alive?)
- Webhook subscription setup for inbound messages
- **Out of scope this phase:** the chat agent itself (Phase 3+ builds on this), Marketing API (ad data) — flagged as a fast-follow, not blocking

**Success criteria:** A merchant completes ES login and Palda shows "WhatsApp connected" with a live test message round-trip.

### Phase 3 — Storefront (Connectors)
**Goal:** A merchant connects their WooCommerce store and Palda has live product/stock/order data.
- WooCommerce connector (reuse Shelf's existing integration): products, variants, stock levels, orders, order status
- Storefront sync status/health view
- Manual re-sync trigger
- Product catalog surfaced inside Palda (read-only in this phase)
- **Out of scope this phase:** writing back to WooCommerce (e.g. creating orders from Palda) — that lands with the Checkout/Cart Recovery work, which follows this phase

**Success criteria:** A merchant's live catalog and recent orders are visible and accurate inside Palda within minutes of a change in WooCommerce.

### Phase 4 — KB (Knowledge Base)
**Goal:** The chat agent has grounded, current knowledge of the store to answer customers accurately.
- Ingestion of store data into a retrievable knowledge layer: product details, stock, policies (delivery, returns), FAQs merchant defines manually
- Merchant-editable KB entries (for things not derivable from the store, e.g. "we don't ship to X," delivery timelines)
- Retrieval pipeline the agent queries at response time (so answers stay grounded, not hallucinated)
- Versioning/freshness — KB reflects current stock and pricing, not stale snapshots
- **Out of scope this phase:** the full conversational agent UX (that's the natural next phase after KB, not covered in this document's phase list but implied as "Chat Layer")

**Success criteria:** Given a real customer question about a real product, the KB returns accurate, current grounding data — testable independent of the chat UI.

### Phase 5 — Settings
**Goal:** A merchant can configure everything Palda needs to operate correctly for their business.
- Business profile (name, delivery zones, working hours, currency)
- Notification preferences
- Agent behavior settings (tone, escalation thresholds — when to hand off to a human)
- Team/staff access (if beyond single-owner by this point)
- Integration management (view/disconnect WhatsApp, IG, FB, WooCommerce from one place)
- Cart abandonment follow-up configuration (trigger delay, message cadence, opt-out handling)

**Success criteria:** A merchant can fully configure their workspace without engineering support.

## 7. Explicitly Deferred (not in these 5 phases, tracked for later)

- Full conversational chat agent + checkout execution (STK Push, order creation) — depends on KB + Storefront being solid first
- Cart recovery automation logic (the *setting* ships in Phase 5; the *automation* ships once checkout write-back exists)
- Meta Marketing API (ad spend/conversion dashboard)
- Cross-channel identity linking beyond deterministic signals (`ctwa_clid`, IGSID)
- TikTok Shop integration

## 8. Success Metrics (product-level, post-launch)

- Median response time to first customer message (target: near-instant, 24/7)
- % of WhatsApp conversations the agent resolves without escalation
- Cart recovery rate (recovered carts / abandoned carts contacted)
- KB accuracy — spot-checked against live store state
- Merchant time-to-value: signup → first working WhatsApp+storefront connection

## 9. Principles for Every Phase

1. Never claim a capability we can't back technically (see Section 3).
2. Each phase must be independently demoable.
3. Reuse Shelf infrastructure wherever it exists; only build net-new where Shelf doesn't cover it.
4. The agent must know when to hand off to a human — confident escalation is a first-class feature, not an afterthought.