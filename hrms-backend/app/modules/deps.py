from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import CurrentUser

# scope="function": commit before the response is sent, so a client that reads
# right after a write sees it. Every Depends(get_db) must use the same scope or
# one request opens two sessions.
DbSession = Annotated[AsyncSession, Depends(get_db, scope="function")]
