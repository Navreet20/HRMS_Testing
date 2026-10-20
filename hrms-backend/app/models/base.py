"""SQLAlchemy declarative base for all ORM models."""

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, mapped_column


class Base(DeclarativeBase):
    """Shared base for every module's models. Constraint and index names are written out on each table
    (uq_, ix_, fk_, ck_); primary keys keep the PostgreSQL default name (<table>_pkey)."""


def uuid_pk():
    """uuid primary key named id, filled by the database."""
    return mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
