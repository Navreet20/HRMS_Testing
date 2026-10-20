"""Shared activity log: one table for every module.
Append-only, enforced by a trigger (see APPEND_ONLY_SQL below): an UPDATE, DELETE or TRUNCATE is refused with an
error. The one exception is the retention job, which deletes old rows after SET LOCAL app.allow_log_purge = 'on'.
entity_id cannot be a real foreign key (it points to many tables), so the service must write the right id.
details is capped at 4 KB, refuses a few known sensitive field names, and the code in app/activity_writer.py lets
through only the fields listed there. Never store the full value of a sensitive field; log only that it was
viewed or changed."""
import datetime as dt
import uuid

from sqlalchemy import DDL, CheckConstraint, DateTime, ForeignKey, Index, String, event, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, uuid_pk


# Field names that must never appear as a key of details. A backstop only: the database cannot recognise a secret
# stored under an innocent name, which is why app/activity_writer.py also allows only a reviewed list of fields.
SENSITIVE_KEYS = ("password", "token", "secret", "api_key", "national_id", "national_id_number", "ssn", "passport",
                  "passport_number", "bank_account", "account_number", "routing_number", "tax_id",
                  "national_id_number_encrypted", "national_id_last4", "date_of_birth")
_KEYS_SQL = ", ".join(f"'{k}'" for k in SENSITIVE_KEYS)

# One statement each. Installed by create_all (after_create below) and again, harmlessly, by schema_ensure.
APPEND_ONLY_SQL = (
    """CREATE OR REPLACE FUNCTION activity_log_block_change() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' AND current_setting('app.allow_log_purge', true) = 'on' THEN
        RETURN OLD;  -- the retention job, which sets the flag inside its own transaction
    END IF;
    RAISE EXCEPTION USING MESSAGE = 'activity_log is append-only: ' || TG_OP || ' is not allowed', ERRCODE = '23001';
END;
$$ LANGUAGE plpgsql""",
    "DROP TRIGGER IF EXISTS trg_activity_log_append_only ON activity_log",
    """CREATE TRIGGER trg_activity_log_append_only BEFORE UPDATE OR DELETE ON activity_log
    FOR EACH ROW EXECUTE FUNCTION activity_log_block_change()""",
    "DROP TRIGGER IF EXISTS trg_activity_log_no_truncate ON activity_log",
    """CREATE TRIGGER trg_activity_log_no_truncate BEFORE TRUNCATE ON activity_log
    FOR EACH STATEMENT EXECUTE FUNCTION activity_log_block_change()""",
)


class ActivityLog(Base):
    __tablename__ = "activity_log"
    __table_args__ = (
        # Keeps details small: changed fields and context ids, never a copy of a whole record.
        CheckConstraint("details IS NULL OR octet_length(details::text) <= 4096", name="ck_activity_log_details_size"),
        CheckConstraint(f"details IS NULL OR NOT jsonb_exists_any(details, ARRAY[{_KEYS_SQL}])",
                        name="ck_activity_log_details_no_sensitive_keys"),
        # History of one record, newest first.
        Index("ix_activity_log_entity", "entity_type", "entity_id", "occurred_at"),
        # Admin log screen: newest first, with an optional from-to date range.
        Index("ix_activity_log_occurred", "occurred_at"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    occurred_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    actor_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("employees.id", name="fk_activity_log_actor_employee_id"))  # NULL = the system
    action: Mapped[str] = mapped_column(String(40))
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[uuid.UUID] = mapped_column()
    details: Mapped[dict | None] = mapped_column(JSONB)
    # Random id made once per API call, shared by all rows that call writes. NOT a foreign key.
    request_id: Mapped[uuid.UUID | None] = mapped_column()


for _statement in APPEND_ONLY_SQL:
    event.listen(ActivityLog.__table__, "after_create", DDL(_statement))
