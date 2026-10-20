"""Editing email wording: validation, safe rendering, saving, resetting, previews."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.mail import templates as t
from app.modules.notifications import service as svc


@pytest.fixture(autouse=True)
def _clean_overrides():
    t.set_overrides({})
    yield
    t.set_overrides({})


def test_edited_wording_is_used_when_rendering() -> None:
    t.set_overrides({"leave.approved": ("Great news, {employee_name}", "Your {leave_type} is approved for {dates}.")})
    email = t.render("leave.approved", employee_name="Durga", leave_type="Sick Leave", dates="Oct 5")
    assert email.subject == "Great news, Durga"
    assert email.text_body == "Your Sick Leave is approved for Oct 5.\n"


def test_default_wording_is_used_when_nothing_was_edited() -> None:
    assert t.render("leave.approved", employee_name="Durga", dates="Oct 5").subject == "[EAOVA] Leave approved (Oct 5)"


def test_rendering_never_interprets_anything_but_placeholders() -> None:
    t.set_overrides({"leave.approved": ("{employee_name.__class__} {0} { } {{x}}", "{employee_name!r} {employee_name:>99}")})
    email = t.render("leave.approved", employee_name="Durga")
    # Unknown placeholder forms stay as typed text; no formatting or attribute access happens.
    assert "Durga" not in email.subject.replace("{employee_name.__class__}", "")
    assert "<class" not in email.subject


def test_values_are_not_expanded_again() -> None:
    email = t.render("leave.approved", employee_name="{dates}", dates="Oct 5")
    assert "Hi {dates}," in email.text_body


def test_subject_stays_on_one_line() -> None:
    email = t.render("leave.approved", employee_name="Durga\r\nBcc: x@evil.com", dates="Oct 5")
    assert "\n" not in email.subject and "\r" not in email.subject


@pytest.mark.parametrize(
    ("subject", "body", "fragment"),
    [
        ("", "Hi {employee_name}", "subject cannot be empty"),
        ("Hi\nthere", "Hi {employee_name}", "single line"),
        ("x" * 201, "Hi", "at most 200"),
        ("Hi", "  ", "message cannot be empty"),
        ("Hi", "y" * 5001, "at most 5000"),
        ("Hi {salary}", "Body", "{salary}"),
        ("Hi", "Body {nope}", "{nope}"),
        ("Hi", "Body {employee name}", "curly brace"),
        ("Hi", "Body } stray", "curly brace"),
    ],
)
def test_bad_wording_is_rejected_with_a_clear_message(subject: str, body: str, fragment: str) -> None:
    with pytest.raises(t.TemplateError) as exc:
        t.validate_wording("leave.approved", subject, body)
    assert fragment in str(exc.value)


def test_valid_wording_is_cleaned_and_accepted() -> None:
    subject, body = t.validate_wording(
        "leave.approved", "  Approved {dates}  ", "Hi {employee_name},\r\n\r\nEnjoy your {leave_type}!  "
    )
    assert subject == "Approved {dates}"
    assert body == "Hi {employee_name},\n\nEnjoy your {leave_type}!"


def test_fixed_layout_and_unknown_emails_cannot_be_edited() -> None:
    with pytest.raises(t.TemplateError):
        t.validate_wording("asset.assigned", "Hi", "Body")
    with pytest.raises(t.TemplateError):
        t.validate_wording("nope", "Hi", "Body")


def test_every_editable_email_has_sample_values_for_all_placeholders() -> None:
    for template in t.TEMPLATES.values():
        if not template.editable:
            continue
        values = t.sample_values(template.key, "https://hrms.example.com/")
        assert set(values) == set(template.placeholders)
        email = t.render_wording(template.key, template.subject, template.body, **values)
        assert "{" not in email.subject and "{" not in email.text_body


def _actor() -> dict:
    return {"firstName": "Meena", "lastName": "P"}


@pytest.mark.asyncio
async def test_saving_stores_the_wording_and_reloads_the_cache() -> None:
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    db.add = MagicMock()
    with patch("app.modules.notifications.service.load_overrides", AsyncMock(return_value={"leave.approved": ("S {dates}", "B {employee_name}")})):
        out = await svc.save_template(db, _actor(), "leave.approved", " S {dates} ", "B {employee_name}")
    saved = db.add.call_args.args[0]
    assert (saved.subject, saved.body, saved.updated_by) == ("S {dates}", "B {employee_name}", "Meena P")
    assert out["customized"] is True and out["updatedBy"] == "Meena P"
    assert t.effective_wording("leave.approved") == ("S {dates}", "B {employee_name}")


@pytest.mark.asyncio
async def test_saving_again_updates_the_existing_row() -> None:
    row = SimpleNamespace(template_key="leave.approved", subject="Old", body="Old", updated_by="X", updated_date=datetime.now(UTC))
    db = AsyncMock()
    db.get = AsyncMock(return_value=row)
    db.add = MagicMock()
    with patch("app.modules.notifications.service.load_overrides", AsyncMock(return_value={})):
        await svc.save_template(db, _actor(), "leave.approved", "New {dates}", "New body")
    db.add.assert_not_called()
    assert (row.subject, row.body) == ("New {dates}", "New body")


@pytest.mark.asyncio
async def test_saving_bad_wording_is_a_400_and_changes_nothing() -> None:
    db = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await svc.save_template(db, _actor(), "leave.approved", "Hi", "Body {nope}")
    assert exc.value.status_code == 400 and "{nope}" in exc.value.detail
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_unknown_email_is_a_404() -> None:
    with pytest.raises(HTTPException) as exc:
        await svc.save_template(AsyncMock(), _actor(), "nope", "Hi", "Body")
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_reset_deletes_the_row_and_returns_the_default() -> None:
    row = SimpleNamespace(template_key="leave.approved")
    db = AsyncMock()
    db.get = AsyncMock(return_value=row)
    t.set_overrides({"leave.approved": ("X", "Y")})
    with patch("app.modules.notifications.service.load_overrides", AsyncMock(return_value={})):
        out = await svc.reset_template(db, "leave.approved")
    db.delete.assert_awaited_once_with(row)
    assert out["customized"] is False and out["subject"] == out["defaultSubject"]
    assert t.effective_wording("leave.approved") == (t.TEMPLATES["leave.approved"].subject, t.TEMPLATES["leave.approved"].body)


def test_preview_fills_examples_without_saving() -> None:
    out = svc.preview_template("leave.approved", "Approved {dates}", "Hi {employee_name}, enjoy your {leave_type}.")
    assert out["subject"] == "Approved 2026-10-05 – 2026-10-07"
    assert out["body"] == "Hi Alex Morgan, enjoy your Personal Leave.\n"
    assert t.effective_wording("leave.approved")[0] != "Approved {dates}"


def test_preview_of_bad_wording_is_a_400() -> None:
    with pytest.raises(HTTPException) as exc:
        svc.preview_template("leave.approved", "Hi", "{nope}")
    assert exc.value.status_code == 400
