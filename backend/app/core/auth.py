"""Authentication utilities for JWT token handling."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from app.core.config import settings


# Use pbkdf2_sha256 to avoid optional native backend issues across local environments.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


class TokenData(BaseModel):
    """JWT token payload."""
    user_id: str
    org_id: str



def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)



def get_password_hash(password: str) -> str:
    """Hash a password for storage."""
    return pwd_context.hash(password)


def create_access_token(user_id: str, org_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = {"user_id": user_id, "org_id": org_id}
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def verify_token(token: str) -> TokenData:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("user_id")
        org_id: str = payload.get("org_id")
        if user_id is None or org_id is None:
            raise JWTError("Invalid token payload")
        return TokenData(user_id=user_id, org_id=org_id)
    except JWTError:
        raise JWTError("Invalid or expired token")
