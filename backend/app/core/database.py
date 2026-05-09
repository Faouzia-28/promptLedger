from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.models import Base

# Async engine for FastAPI/web operations
engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

# Sync engine for Celery tasks (lazy-loaded to avoid import errors in API)
_sync_engine = None
_sync_session_factory = None


def _init_sync_engine():
	"""Initialize sync engine on first use."""
	global _sync_engine, _sync_session_factory
	if _sync_engine is None:
		sync_db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
		_sync_engine = create_engine(sync_db_url, echo=False, pool_pre_ping=True)
		_sync_session_factory = sessionmaker(bind=_sync_engine)
	return _sync_session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


def get_sync_db():
	"""Get sync database session for Celery tasks (lazy-loads sync engine)."""
	session_factory = _init_sync_engine()
	return session_factory()
