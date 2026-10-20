"""Deciding requests: saved comments, Assets integration, profile apply, emails."""

from __future__ import annotations

import uuid
from contextlib import ExitStack
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.employee import request_decision_notify as notify_mod
from app.modules.employee import request_decisions as rd

ACTOR = {"employeeId": str(uuid4()), "firstName": "Meena", "lastName": "P", "email": "meena@x.com"}


def _asset_request(kind: str, **overrides) -> SimpleNamespace:
    base = dict(
        id=uuid4(),
        employee_id=uuid4(),
        request_type=kind,
        system_asset_id=uuid4() if kind != "new" else None,
        requested_category_id=uuid4() if kind == "new" else None,
        new_asset_details="Dock",
        fulfilled_system_asset_id=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _stack(*patches):
    stack = ExitStack()
    for p in patches:
        stack.enter_context(p)
    return stack


def test_record_decision_keeps_comment_who_and_when() -> None:
    row = SimpleNamespace()
    rd.record_decision(row, ACTOR, "  Wrong project  ")
    assert row.decision_note == "Wrong project"
    assert row.decided_by_name == "Meena P"
    assert str(row.decided_by_employee_id) == ACTOR["employeeId"]
    assert row.decided_date is not None
    rd.record_decision(row, ACTOR, "")
    assert row.decision_note is None


@pytest.mark.asyncio
async def test_approving_a_new_request_assigns_the_chosen_asset() -> None:
    request = _asset_request("new")
    new_id = uuid4()
    allocate = AsyncMock()
    with _stack(
        patch.object(rd, "require_assets_full_access", AsyncMock()),
        patch.object(rd, "_category_of", AsyncMock(return_value=request.requested_category_id)),
        patch.object(rd, "_asset_code", AsyncMock(return_value="EAO-LAP-0007")),
        patch.object(rd.assets_service, "allocate_asset", allocate),
    ):
        outcome = await rd.fulfil_asset_request(
            AsyncMock(), ACTOR, request, {"assignSystemAssetId": str(new_id)}
        )
    assert outcome == "Asset EAO-LAP-0007 assigned"
    assert request.fulfilled_system_asset_id == new_id
    allocate.assert_awaited_once()
    assert allocate.await_args.args[3] == {"employeeId": str(request.employee_id)}


@pytest.mark.asyncio
async def test_new_request_needs_an_asset_from_the_requested_category() -> None:
    request = _asset_request("new")
    allocate = AsyncMock()
    with _stack(
        patch.object(rd, "require_assets_full_access", AsyncMock()),
        patch.object(rd, "_category_of", AsyncMock(return_value=uuid4())),
        patch.object(rd.assets_service, "allocate_asset", allocate),
    ):
        with pytest.raises(HTTPException) as wrong:
            await rd.fulfil_asset_request(
                AsyncMock(), ACTOR, request, {"assignSystemAssetId": str(uuid4())}
            )
        with pytest.raises(HTTPException) as missing:
            await rd.fulfil_asset_request(AsyncMock(), ACTOR, request, {})
    assert "category" in str(wrong.value.detail)
    assert "Choose the asset" in str(missing.value.detail)
    allocate.assert_not_awaited()


@pytest.mark.asyncio
async def test_approving_a_swap_returns_the_old_asset_and_assigns_the_new() -> None:
    request = _asset_request("swap")
    new_id = uuid4()
    allocation = SimpleNamespace(allocation_id=uuid4())
    swap = AsyncMock()
    category = uuid4()
    with _stack(
        patch.object(rd, "require_assets_full_access", AsyncMock()),
        patch.object(rd, "_category_of", AsyncMock(return_value=category)),
        patch.object(rd, "_open_allocation", AsyncMock(return_value=allocation)),
        patch.object(rd, "_asset_code", AsyncMock(side_effect=["OLD-1", "NEW-2"])),
        patch.object(rd.assets_service, "swap_asset", swap),
    ):
        outcome = await rd.fulfil_asset_request(
            AsyncMock(),
            ACTOR,
            request,
            {
                "assignSystemAssetId": str(new_id),
                "reasonForReturn": "Broken",
                "conditionAtReturn": "Poor",
            },
        )
    assert outcome == "Asset OLD-1 swapped for NEW-2"
    assert request.fulfilled_system_asset_id == new_id
    sent = swap.await_args.args[3]
    assert sent["systemAssetId"] == str(new_id)
    assert sent["reasonForReturn"] == "Broken"


@pytest.mark.asyncio
async def test_approving_a_lost_report_marks_the_asset_lost_with_the_employees_details() -> None:
    request = _asset_request("reportLostStolen", new_asset_details="Left in a cab")
    report = AsyncMock()
    with _stack(
        patch.object(rd, "require_assets_full_access", AsyncMock()),
        patch.object(rd, "_open_allocation", AsyncMock()),
        patch.object(rd, "_asset_code", AsyncMock(return_value="EAO-LAP-0003")),
        patch.object(rd.assets_service, "report_lost", report),
    ):
        outcome = await rd.fulfil_asset_request(
            AsyncMock(), ACTOR, request, {"reason": "Stolen"}
        )
    assert outcome == "Asset EAO-LAP-0003 recorded as lost"
    args = report.await_args.args
    assert args[2] == request.system_asset_id
    assert args[3] == {"reason": "Stolen", "notes": "Left in a cab"}


@pytest.mark.asyncio
async def test_fulfilling_needs_assets_full_access() -> None:
    session = AsyncMock()
    with patch.object(rd, "resolve_module_access_level", AsyncMock(return_value="read_only")):
        with pytest.raises(HTTPException) as exc:
            await rd.require_assets_full_access(session, ACTOR)
    assert exc.value.status_code == 403
    with patch.object(rd, "resolve_module_access_level", AsyncMock(return_value="full_access")):
        await rd.require_assets_full_access(session, ACTOR)


def _employee(dob: date | None = None, first: str = "Rima") -> SimpleNamespace:
    return SimpleNamespace(
        employee_id=uuid4(),
        first_name=first,
        last_name="Rigo",
        date_of_birth=dob,
        nationality="IN",
        employee_code="C1",
        business_employee_id="EMP00007",
        updated_date=None,
        updated_by=None,
    )


def _session_with(employee):
    result = MagicMock()
    result.scalar_one_or_none.return_value = employee
    session = MagicMock()
    session.execute = AsyncMock(return_value=result)
    session.add = MagicMock()
    return session


@pytest.mark.asyncio
async def test_approving_a_structured_profile_change_updates_the_employee_and_audits_it() -> None:
    employee = _employee()
    request = SimpleNamespace(
        id=uuid4(), employee_id=employee.employee_id, field_changed="lastName",
        old_value="Rigo", new_value="Rigo-Patel",
    )
    session = _session_with(employee)
    assert await rd.apply_profile_change(session, ACTOR, request) is True
    assert employee.last_name == "Rigo-Patel"
    assert employee.updated_by == "Meena P"
    audit = session.add.call_args.args[0]
    assert (audit.field_name, audit.old_value, audit.new_value) == ("lastName", "Rigo", "Rigo-Patel")
    assert audit.changed_by == "Meena P"


@pytest.mark.asyncio
async def test_date_of_birth_is_stored_as_a_date() -> None:
    employee = _employee(dob=date(1988, 1, 9))
    request = SimpleNamespace(
        id=uuid4(), employee_id=employee.employee_id, field_changed="dateOfBirth",
        old_value="1988-01-09", new_value="1988-01-19",
    )
    assert await rd.apply_profile_change(_session_with(employee), ACTOR, request) is True
    assert employee.date_of_birth == date(1988, 1, 19)


@pytest.mark.asyncio
async def test_free_text_and_already_applied_changes_are_left_alone() -> None:
    employee = _employee()
    general = SimpleNamespace(
        id=uuid4(), employee_id=employee.employee_id, field_changed="general",
        old_value=None, new_value="Update my address",
    )
    session = _session_with(employee)
    assert await rd.apply_profile_change(session, ACTOR, general) is False
    same = SimpleNamespace(
        id=uuid4(), employee_id=employee.employee_id, field_changed="firstName",
        old_value="Rima", new_value="Rima",
    )
    assert await rd.apply_profile_change(session, ACTOR, same) is False
    session.add.assert_not_called()


def _person(email: str | None, first: str) -> SimpleNamespace:
    return SimpleNamespace(first_name=first, last_name="X", email_id=email)


@pytest.mark.asyncio
async def test_decision_emails_go_to_requester_subject_and_other_managers() -> None:
    sent: list[tuple[str, str]] = []

    async def fake_send(**kwargs):
        sent.append((kwargs["to_email"], kwargs["event"]))

    with _stack(
        patch.object(notify_mod, "send_email", fake_send),
        patch.object(
            notify_mod,
            "notification_recipients",
            AsyncMock(return_value=["assets@x.com", "meena@x.com", "ross@x.com"]),
        ),
        patch.object(notify_mod, "get_settings", lambda: SimpleNamespace(smtp_enabled=True)),
    ):
        await notify_mod.notify_request_decision(
            kind="asset",
            decision="approved",
            requester=_person("ross@x.com", "Ross"),
            subject=_person("rima@x.com", "Rima"),
            request_id=uuid4(),
            request_type="New asset",
            summary="Laptop",
            decided_by="Meena P",
            decided_by_email="meena@x.com",
            outcome="Asset EAO-LAP-0007 assigned",
        )
    assert ("ross@x.com", "asset_request.approved") in sent
    assert ("rima@x.com", "asset_request.approved") in sent
    assert ("assets@x.com", "request.decided") in sent
    # The person who decided, and people already told, get no copy.
    assert all(addr != "meena@x.com" for addr, _ in sent)
    assert ("ross@x.com", "request.decided") not in sent


@pytest.mark.asyncio
async def test_rejection_email_carries_the_reason_and_profile_approvals_send_no_duplicate() -> None:
    bodies: list[str] = []
    events: list[str] = []

    async def fake_send(**kwargs):
        bodies.append(kwargs["text_body"])
        events.append(kwargs["event"])

    common = dict(
        kind="profile",
        requester=_person("ross@x.com", "Ross"),
        subject=_person("ross@x.com", "Ross"),
        request_id=uuid4(),
        request_type="Profile update",
        summary="lastName: Rigo → Rigo-Patel",
        decided_by="Meena P",
    )
    with _stack(
        patch.object(notify_mod, "send_email", fake_send),
        patch.object(notify_mod, "notification_recipients", AsyncMock(return_value=[])),
        patch.object(notify_mod, "get_settings", lambda: SimpleNamespace(smtp_enabled=True)),
    ):
        await notify_mod.notify_request_decision(
            decision="rejected", comment="Certificate is unreadable", **common
        )
        assert events == ["profile_update.rejected"]
        assert "Certificate is unreadable" in bodies[0]

        events.clear()
        await notify_mod.notify_request_decision(
            decision="approved", send_to_requester=False, **common
        )
        assert events == []


@pytest.mark.asyncio
async def test_a_mail_failure_never_breaks_the_decision() -> None:
    with _stack(
        patch.object(notify_mod, "get_settings", lambda: SimpleNamespace(smtp_enabled=True)),
        patch.object(notify_mod, "notification_recipients", AsyncMock(side_effect=RuntimeError("db down"))),
    ):
        await notify_mod.notify_request_decision(
            kind="asset", decision="approved", requester=None, subject=None,
            request_id=uuid4(), request_type="Swap", summary="x", decided_by="M",
        )


@pytest.mark.asyncio
async def test_out_of_stock_category_cannot_be_requested() -> None:
    from app.modules.employee.service import EmployeeService

    category_id = uuid4()
    category = SimpleNamespace(category_id=category_id, category_name="Laptop")
    cat_result = MagicMock()
    cat_result.scalar_one_or_none.return_value = category
    session = AsyncMock()
    session.execute = AsyncMock(return_value=cat_result)
    with patch.object(rd, "in_stock_count", AsyncMock(return_value=0)):
        with pytest.raises(HTTPException) as exc:
            await EmployeeService().create_asset_request(
                session,
                {"employeeId": str(uuid4())},
                {"requestType": "new", "categoryId": str(category_id), "newAssetDetails": "Need one"},
            )
    assert exc.value.status_code == 400
    assert "No Laptop is in stock" in str(exc.value.detail)


def _added_events(session) -> list[tuple[str, str | None]]:
    from app.models.awaiting import (WorkflowEvent)

    return [
        (call.args[0].event, call.args[0].comment)
        for call in session.add.call_args_list
        if isinstance(call.args[0], WorkflowEvent)
    ]


@pytest.mark.asyncio
async def test_a_new_request_starts_its_timeline() -> None:
    from app.models.awaiting import (AssetRequest)

    session = MagicMock()
    session.add = MagicMock()
    row = SimpleNamespace(id=uuid4())
    await rd.log_submission(session, "asset_request", AssetRequest, row, ACTOR, None)
    assert _added_events(session) == [("submitted", None)]


@pytest.mark.asyncio
async def test_resubmitting_a_rejected_request_links_old_and_new() -> None:
    from app.models.awaiting import (AssetRequest)

    actor_id = uuid.UUID(ACTOR["employeeId"])
    old = SimpleNamespace(
        id=uuid4(), employee_id=actor_id, submitted_by_employee_id=actor_id, status="Rejected"
    )
    result = MagicMock()
    result.scalar_one_or_none.return_value = old
    session = MagicMock()
    session.execute = AsyncMock(return_value=result)
    session.add = MagicMock()
    new = SimpleNamespace(id=uuid4())

    await rd.log_submission(session, "asset_request", AssetRequest, new, ACTOR, str(old.id))

    events = _added_events(session)
    assert [name for name, _ in events] == ["resubmitted", "resubmitted"]
    assert str(old.id) in (events[0][1] or "")
    assert str(new.id) in (events[1][1] or "")


@pytest.mark.asyncio
@pytest.mark.parametrize("old_status", ["Approved", "Open"])
async def test_only_your_own_rejected_request_can_be_resubmitted(old_status: str) -> None:
    from app.models.awaiting import (AssetRequest)

    actor_id = uuid.UUID(ACTOR["employeeId"])
    someone_else = uuid4()
    cases = [
        SimpleNamespace(id=uuid4(), employee_id=actor_id, submitted_by_employee_id=actor_id, status=old_status),
        SimpleNamespace(id=uuid4(), employee_id=someone_else, submitted_by_employee_id=someone_else, status="Rejected"),
        None,
    ]
    for old in cases:
        result = MagicMock()
        result.scalar_one_or_none.return_value = old
        session = MagicMock()
        session.execute = AsyncMock(return_value=result)
        session.add = MagicMock()
        with pytest.raises(HTTPException) as exc:
            await rd.log_submission(
                session, "asset_request", AssetRequest, SimpleNamespace(id=uuid4()), ACTOR, str(uuid4())
            )
        assert exc.value.status_code == 400
        session.add.assert_not_called()


def test_decisions_are_logged_with_their_comment() -> None:
    session = MagicMock()
    session.add = MagicMock()
    row = SimpleNamespace(id=uuid4())
    rd.log_decision(session, "profile_update", row, ACTOR, approved=False, note="Unreadable scan")
    rd.log_decision(session, "profile_update", row, ACTOR, approved=True, note=None)
    assert _added_events(session) == [("rejected", "Unreadable scan"), ("approved", None)]


@pytest.mark.asyncio
async def test_manage_counts_only_ask_for_what_the_person_can_manage() -> None:
    from app.modules.employee.service import EmployeeService

    svc = EmployeeService()
    svc.managing_option = AsyncMock(  # type: ignore[method-assign]
        return_value={
            "hasDirectReports": True,
            "canManageTimesheets": False,
            "canManageLeaves": False,
            "canManageProfileUpdates": False,
            "canManageAssetRequests": False,
            "canManageItRequests": False,
        }
    )
    with patch("app.modules.timesheet.week_service.count_waiting", AsyncMock(return_value=3)), patch(
        "app.modules.leave_approvals.service.count_waiting", AsyncMock(return_value=4)
    ):
        counts = await svc.manage_counts(AsyncMock(), ACTOR)
    # A manager with direct reports sees timesheets and leaves, but no requests queue.
    assert counts == {"timesheets": 3, "leaves": 4, "requests": 0}


async def _run_notify(**overrides):
    sent: list[tuple[str, str]] = []

    async def fake_send(**kwargs):
        sent.append((kwargs["to_email"], kwargs["event"]))

    base = dict(
        kind="asset",
        decision="approved",
        requester=_person("ross@x.com", "Ross"),
        subject=_person("ross@x.com", "Ross"),
        request_id=uuid4(),
        request_type="New asset",
        summary="Laptop",
        decided_by="Meena P",
        decided_by_email="meena@x.com",
    )
    base.update(overrides)
    with _stack(
        patch.object(notify_mod, "send_email", fake_send),
        patch.object(
            notify_mod,
            "notification_recipients",
            AsyncMock(return_value=["assets@x.com"]),
        ),
        patch.object(notify_mod, "get_settings", lambda: SimpleNamespace(smtp_enabled=True)),
    ):
        await notify_mod.notify_request_decision(**base)
    return sent


@pytest.mark.asyncio
async def test_a_request_for_yourself_gets_one_decision_email_not_two() -> None:
    sent = await _run_notify(decision="rejected", comment="Out of budget")
    to_ross = [event for address, event in sent if address == "ross@x.com"]
    assert to_ross == ["asset_request.rejected"]


@pytest.mark.asyncio
async def test_when_assets_already_emailed_the_employee_there_is_no_second_email() -> None:
    sent = await _run_notify(subject_already_emailed=True)
    assert all(address != "ross@x.com" for address, _ in sent)
    # The other managers still hear that it was handled.
    assert ("assets@x.com", "request.decided") in sent


@pytest.mark.asyncio
async def test_on_behalf_the_requester_is_still_told_when_assets_emailed_the_employee() -> None:
    sent = await _run_notify(
        requester=_person("ross@x.com", "Ross"),
        subject=_person("rima@x.com", "Rima"),
        subject_already_emailed=True,
    )
    assert ("ross@x.com", "asset_request.approved") in sent
    assert all(address != "rima@x.com" for address, _ in sent)


@pytest.mark.asyncio
async def test_a_lost_report_does_not_copy_managers_who_already_got_the_lost_email() -> None:
    sent = await _run_notify(subject_already_emailed=True, managers_already_emailed=True)
    assert sent == []
