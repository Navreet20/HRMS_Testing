from collections.abc import AsyncGenerator
import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import AsyncAdaptedQueuePool, NullPool

from app.core.config import get_settings

settings = get_settings()
# AsyncAdaptedQueuePool reuses connections (required for create_async_engine;
# plain QueuePool is sync-only and raises ArgumentError).
# NullPool: pytest (TESTING=1) must use it — pooled connections outlive the
# per-test event loop and raise "Event loop is closed". Also available via
# DB_POOL_CLASS=null for VPN + --reload dead-socket issues.
_testing = os.environ.get("TESTING", "").strip().lower() in {"1", "true", "yes", "on"}
_pool_class = (
    NullPool
    if _testing or settings.db_pool_class == "null"
    else AsyncAdaptedQueuePool
)
_engine_kwargs: dict = {
    "echo": False,
    "connect_args": {"ssl": settings.db_ssl, "timeout": 15, "command_timeout": 30},
    "poolclass": _pool_class,
}
if _pool_class is AsyncAdaptedQueuePool:
    _engine_kwargs.update(
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_pre_ping=settings.db_pool_pre_ping,
        pool_recycle=settings.db_pool_recycle,
        pool_timeout=settings.db_pool_timeout,
    )

engine = create_async_engine(settings.database_url, **_engine_kwargs)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
