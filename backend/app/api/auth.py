"""Authentication endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.core.auth import (
    create_access_token, 
    verify_password, 
    get_password_hash,
    verify_token,
)
from app.models.models import Organization, User
import uuid


router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    """Registration request."""
    org_name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    """Login request."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """User info response."""
    id: str
    email: str
    role: str
    org_id: str


class TokenResponse(BaseModel):
    """Token response."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RegistrationResponse(BaseModel):
    """Registration response includes token and user."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


async def get_current_user(
    authorization: str = Header(None), 
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Dependency to extract and validate current user from token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    
    token = authorization.replace("Bearer ", "", 1)
    
    try:
        token_data = verify_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    
    # Verify user still exists in DB
    stmt = select(User).where(User.id == uuid.UUID(token_data.user_id))
    result = await db.execute(stmt)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    return {"user_id": str(user.id), "org_id": str(user.org_id), "user": user}


def require_roles(*allowed_roles: str):
    """Dependency factory that enforces user role membership."""

    async def _require_role(current: dict = Depends(get_current_user)) -> dict:
        role = getattr(current.get("user"), "role", None)
        normalized_allowed = {r.lower() for r in allowed_roles}
        if role is None or role.lower() not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current

    return _require_role


@router.post("/register", response_model=RegistrationResponse)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new organization and user."""
    # Check if email already exists
    stmt = select(User).where(User.email == request.email)
    result = await db.execute(stmt)
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    base_slug = request.org_name.strip().lower().replace(" ", "-") or "org"
    slug_stmt = select(Organization.id).where(Organization.slug == base_slug)
    slug_exists = await db.execute(slug_stmt)
    slug = base_slug if not slug_exists.scalars().first() else f"{base_slug}-{uuid.uuid4().hex[:8]}"

    # Create organization
    org = Organization(
        id=uuid.uuid4(),
        name=request.org_name,
        slug=slug,
    )
    db.add(org)
    await db.flush()
    
    # Create user
    user = User(
        id=uuid.uuid4(),
        org_id=org.id,
        email=request.email,
        hashed_password=get_password_hash(request.password),
        role="admin",
    )
    db.add(user)
    await db.commit()
    
    # Create token
    access_token = create_access_token(str(user.id), str(org.id))
    user_resp = UserResponse(id=str(user.id), email=user.email, role=user.role, org_id=str(user.org_id))
    return {"access_token": access_token, "token_type": "bearer", "user": user_resp}


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    stmt = select(User).where(User.email == request.email)
    result = await db.execute(stmt)
    user = result.scalars().first()
    
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    access_token = create_access_token(str(user.id), str(user.org_id))
    user_resp = UserResponse(id=str(user.id), email=user.email, role=user.role, org_id=str(user.org_id))
    return {"access_token": access_token, "token_type": "bearer", "user": user_resp}


@router.get("/me", response_model=UserResponse)
async def get_me(current: dict = Depends(get_current_user)):
    """Get current user info."""
    user = current["user"]
    return UserResponse(
        id=str(user.id),
        email=user.email,
        role=user.role,
        org_id=str(user.org_id),
    )
