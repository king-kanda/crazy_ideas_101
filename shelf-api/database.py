import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

db_url = os.environ.get("DATABASE_URL", "")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

engine = create_async_engine(db_url, echo=False, future=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import text
        migrations = [
            "ALTER TABLE stores ADD COLUMN IF NOT EXISTS plugin_site_url TEXT",
            "ALTER TABLE stores ADD COLUMN IF NOT EXISTS demo_loaded BOOLEAN DEFAULT FALSE",
            "ALTER TABLE stores ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE",
            "CREATE INDEX IF NOT EXISTS ix_stores_workspace_id ON stores(workspace_id)",
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE",
            "ALTER TABLE search_events ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE",
            "ALTER TABLE cart_events ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE",
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE",
        ]
        for sql in migrations:
            await conn.execute(text(sql))

    # Idempotent backfill: for every legacy Store without a workspace_id,
    # materialize the implicit Merchant + Workspace so the new tenancy model
    # is populated without touching the plugin or existing dashboards.
    await backfill_workspaces()


async def backfill_workspaces():
    """One-way, idempotent: legacy Store -> Merchant + Workspace + Store.workspace_id.

    Safe to run on every boot. Only touches Store rows where workspace_id IS NULL.
    """
    from sqlalchemy import text
    from models import Merchant, Workspace, Store
    import uuid as _uuid

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT id, owner_email, owner_password_hash, store_name FROM stores WHERE workspace_id IS NULL")
        )
        rows = result.fetchall()
        if not rows:
            return

        for row in rows:
            store_id, email, pw_hash, store_name = row

            # Reuse Merchant by email if one already exists (avoids duplicates
            # when a merchant somehow ended up with two legacy Store rows).
            existing_merchant = await session.execute(
                text("SELECT id FROM merchants WHERE email = :email"),
                {"email": email},
            )
            m_row = existing_merchant.first()
            if m_row:
                merchant_id = m_row[0]
            else:
                merchant = Merchant(
                    id=_uuid.uuid4(),
                    business_name=store_name or "Workspace",
                    email=email,
                    password_hash=pw_hash,
                    status="active",
                )
                session.add(merchant)
                await session.flush()
                merchant_id = merchant.id

            workspace = Workspace(
                id=_uuid.uuid4(),
                merchant_id=merchant_id,
            )
            session.add(workspace)
            await session.flush()

            await session.execute(
                text("UPDATE stores SET workspace_id = :wid WHERE id = :sid"),
                {"wid": workspace.id, "sid": store_id},
            )

        await session.commit()
