import uuid
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Store
from schemas import (
    SignupRequest, LoginRequest, SignupResponse, VerifyResponse,
    RegenerateKeyResponse, StoreProfileResponse, UpdateProfileRequest,
)
from auth import hash_password, verify_password, create_jwt, get_store_from_api_key, get_store_from_jwt

router = APIRouter()


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(Store).where(Store.owner_email == body.email)
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    new_api_key = str(uuid.uuid4())
    store = Store(
        owner_email=body.email,
        owner_password_hash=hash_password(body.password),
        store_name=body.store_name,
        store_url=body.store_url,
        niche=body.niche,
        location_country=body.location_country,
        location_city=body.location_city,
        api_key=new_api_key,
    )
    db.add(store)
    await db.commit()
    await db.refresh(store)

    token = create_jwt(str(store.id), store.owner_email)
    return SignupResponse(token=token, api_key=new_api_key, store_id=str(store.id))


@router.post("/login", response_model=SignupResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Store).where(Store.owner_email == body.email))
    store = result.scalars().first()
    if not store or not verify_password(body.password, store.owner_password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    token = create_jwt(str(store.id), store.owner_email)
    return SignupResponse(token=token, api_key=store.api_key, store_id=str(store.id))


@router.post("/regenerate-key", response_model=RegenerateKeyResponse)
async def regenerate_key(
    db: AsyncSession = Depends(get_db),
    store: Store = Depends(get_store_from_jwt),
):
    store.api_key = str(uuid.uuid4())
    db.add(store)
    await db.commit()
    return RegenerateKeyResponse(api_key=store.api_key)


@router.get("/verify", response_model=VerifyResponse)
async def verify(store: Store = Depends(get_store_from_api_key)):
    return VerifyResponse(
        verified=True,
        store_name=store.store_name,
        store_id=str(store.id),
    )


@router.get("/profile", response_model=StoreProfileResponse)
async def get_profile(store: Store = Depends(get_store_from_jwt)):
    return StoreProfileResponse(
        store_name=store.store_name,
        store_url=store.store_url,
        niche=store.niche,
        location_country=store.location_country,
        location_city=store.location_city,
        plugin_site_url=store.plugin_site_url,
    )


@router.patch("/profile", response_model=StoreProfileResponse)
async def update_profile(
    body: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    store: Store = Depends(get_store_from_jwt),
):
    result = await db.execute(select(Store).where(Store.id == store.id))
    db_store = result.scalars().first()
    if not db_store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    if body.store_name is not None:
        db_store.store_name = body.store_name
    if body.store_url is not None:
        db_store.store_url = body.store_url
    if body.niche is not None:
        db_store.niche = body.niche
    if body.location_country is not None:
        db_store.location_country = body.location_country
    if body.location_city is not None:
        db_store.location_city = body.location_city

    db.add(db_store)
    await db.commit()
    await db.refresh(db_store)

    return StoreProfileResponse(
        store_name=db_store.store_name,
        store_url=db_store.store_url,
        niche=db_store.niche,
        location_country=db_store.location_country,
        location_city=db_store.location_city,
        plugin_site_url=db_store.plugin_site_url,
    )
