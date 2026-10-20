"""Re-export the one declarative Base (defined in app.models.base) for older import sites."""
from app.models.base import Base

__all__ = ["Base"]
