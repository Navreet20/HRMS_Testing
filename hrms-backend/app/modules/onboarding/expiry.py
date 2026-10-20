"""Daily document expiry + checklist regression + notification windows."""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.awaiting import (ComplianceDocument, OnboardingChecklistItem)
from app.modules.onboarding.enums import ChecklistItemStatus, ComplianceDocumentStatus
from app.modules.onboarding import service as ob_service

logger = logging.getLogger(__name__)

NOTIFY_WINDOWS_DAYS = (90, 60, 30)


async def run_document_expiry(session: AsyncSession, *, today: date | None = None) -> dict:
    """
    Mark expired compliance docs, flip parent checklist items back to PENDING,
    and collect notification candidates at 90/60/30 days out.
    """
    day = today or datetime.now(UTC).date()
    expired_count = 0
    reset_items: set = set()
    notifications: list[dict] = []

    # Expire past-due approved docs
    result = await session.execute(
        select(ComplianceDocument).where(
            ComplianceDocument.status == ComplianceDocumentStatus.APPROVED,
            ComplianceDocument.expiry_date.is_not(None),
            ComplianceDocument.expiry_date < day,
        )
    )
    for doc in result.scalars().all():
        doc.status = ComplianceDocumentStatus.EXPIRED
        expired_count += 1
        if doc.checklist_item_id is not None:
            item = await session.get(OnboardingChecklistItem, doc.checklist_item_id)
            if item is not None and item.status == ChecklistItemStatus.APPROVED:
                item.status = ChecklistItemStatus.PENDING
                item.completed_at = None
                reset_items.add(item.onboarding_id)
                onboarding = await ob_service.load_onboarding(session, item.onboarding_id)
                await ob_service.recompute_status(session, onboarding, actor=None)

    # Upcoming expiry notifications
    for days in NOTIFY_WINDOWS_DAYS:
        target = day + timedelta(days=days)
        upcoming = await session.execute(
            select(ComplianceDocument).where(
                ComplianceDocument.status == ComplianceDocumentStatus.APPROVED,
                ComplianceDocument.expiry_date == target,
            )
        )
        for doc in upcoming.scalars().all():
            notifications.append(
                {
                    "documentId": str(doc.id),
                    "employeeId": str(doc.employee_id),
                    "expiryDate": doc.expiry_date.isoformat() if doc.expiry_date else None,
                    "daysUntilExpiry": days,
                }
            )
            logger.info(
                "Document %s for employee %s expires in %s days",
                doc.id,
                doc.employee_id,
                days,
            )

    await session.flush()
    return {
        "expiredCount": expired_count,
        "onboardingsRecomputed": len(reset_items),
        "notificationsQueued": len(notifications),
        "notifications": notifications,
    }
