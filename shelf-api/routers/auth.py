import uuid
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Store
from schemas import SignupRequest, LoginRequest, SignupResponse, VerifyResponse
from auth import hash_password, verify_password, create_jwt, get_store_from_api_key

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


@router.get("/verify", response_model=VerifyResponse)
async def verify(store: Store = Depends(get_store_from_api_key)):
    return VerifyResponse(
        verified=True,
        store_name=store.store_name,
        store_id=str(store.id),
    )
