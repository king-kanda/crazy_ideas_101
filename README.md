# Shelf — WooCommerce Buyer Intelligence

Shelf is a two-part buyer intelligence system: a central platform (Next.js + FastAPI) where store owners view demand insights, and a WordPress plugin that collects product, search, cart, and activity data from WooCommerce stores.

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Python | 3.12+ |
| Node.js | 18+ |
| pnpm / yarn / npm | any recent |
| PostgreSQL | 14+ |
| Redis | 6+ |

---

## 1. Central API (`shelf-api`)

### Setup

```bash
cd shelf-api
cp .env.example .env
```

Edit `.env` and fill in real values:

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/shelf
REDIS_URL=redis://localhost:6379
GROQ_API_KEY=<your Groq API key>
JWT_SECRET=<a long random secret>
```

### Run

```bash
bash start.sh
```

The script will:
1. Create a Python virtual environment (`.venv`) if one doesn't exist
2. Install dependencies from `requirements.txt`
3. Start Celery worker + beat scheduler (if Redis is reachable)
4. Start the FastAPI server on **http://localhost:8000**

Database tables are created automatically on first startup via SQLAlchemy.

> **Workers only** — to start Celery separately without the API:
> ```bash
> bash start-workers.sh
> ```

---

## 2. Frontend App (`shelf-app`)

### Setup

```bash
cd shelf-app
cp .env.local.example .env.local   # or create .env.local manually
```

`.env.local` only needs one variable (defaults to localhost if omitted):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Run (development)

```bash
bash start.sh
```

The script detects pnpm / yarn / npm, installs dependencies if needed, and starts the Next.js dev server on **http://localhost:3000**.

### Run (production)

```bash
bash start.sh prod
```

Builds the app then starts the production server.

---

## 3. WordPress Plugin

1. Download **[shelf-woocommerce.zip](https://github.com/king-kanda/crazy_ideas_101/blob/claude/inspiring-lamport-OoZhC/shelf-woocommerce.zip)**
2. In WP Admin go to **Plugins → Add New → Upload Plugin**
3. Upload the zip and activate it
4. Navigate to **Shelf → Settings** in the WP Admin sidebar
5. Paste your API key (shown after onboarding) and click **Save**
6. Set the **API URL** to wherever your `shelf-api` is hosted (defaults to `http://localhost:8000`)

---

## Architecture

```
WordPress Store
  └── Shelf WooCommerce Plugin (PHP)
        ├── Hooks: product catalog, WP search, cart events, WC Analytics
        ├── Admin: WP Admin → Shelf → Insights
        └── POSTs data → Central API (X-Shelf-API-Key header)

shelf-api/  (FastAPI + PostgreSQL + Redis/Celery)
  ├── POST /auth/signup
  ├── GET  /auth/verify
  ├── POST /ingest/products | searches | cart-events | activity
  └── GET  /insights/{store_id}/demand | store | activity

shelf-app/  (Next.js 14)
  └── /signup → /onboarding → /dashboard
```

---

## Environment Variables Reference

### `shelf-api/.env`

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `REDIS_URL` | Redis connection string (`redis://localhost:6379`) |
| `GROQ_API_KEY` | Groq API key for LLM demand gap analysis |
| `JWT_SECRET` | Secret used to sign authentication tokens |

### `shelf-app/.env.local`

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | URL of the running `shelf-api` |
