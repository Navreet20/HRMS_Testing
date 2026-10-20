"""ESS-DATA-2 profile update request service."""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.modules.employee.service import EmployeeService


@pytest.mark.asyncio
async def test_create_profile_update_request_rejects_disallowed_field() -> None:
    session = AsyncMock()
    svc = EmployeeService()
    with pytest.raises(HTTPException) as exc:
        await svc.create_profile_update_request(
            session,
            {"employeeId": str(uuid4())},
            {"fieldChanged": "maritalStatus", "newValue": "Married"},
        )
    assert exc.value.status_code == 400
    assert "fieldChanged" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_create_profile_update_request_persists_old_and_new() -> None:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    employee_id = uuid4()
    emp = MagicMock()
    emp.first_name = "Alex"
    emp.last_name = "Morgan"
    emp.date_of_birth = date(1990, 1, 15)
    emp.nationality = "US"
    emp.email_id = "alex@example.com"
    emp.business_employee_id = "E1"
    emp.employee_code = "E1"

    svc = EmployeeService()
    svc._get = AsyncMock(return_value=emp)  # type: ignore[method-assign]

    with patch(
        "app.modules.employee.profile_update_notify.notify_hr_profile_update_request",
        new_callable=AsyncMock,
    ) as notify:
        payload = await svc.create_profile_update_request(
            session,
            {"employeeId": str(employee_id)},
            {"fieldChanged": "firstName", "newValue": "Jordan"},
        )

    assert payload["fieldChanged"] == "firstName"
    assert payload["oldValue"] == "Alex"
    assert payload["newValue"] == "Jordan"
    assert payload["status"] == "Open"
    assert payload["employeeId"] == str(employee_id)
    assert session.add.call_count == 2  # the request, then its timeline entry
    notify.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_profile_update_request_requires_employee_id() -> None:
    session = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await EmployeeService().create_profile_update_request(
            session, {}, {"fieldChanged": "firstName", "newValue": "A"}
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_list_own_profile_update_requests() -> None:
    session = AsyncMock()
    employee_id = uuid4()
    row = MagicMock()
    row.id = uuid4()
    row.employee_id = employee_id
    row.field_changed = "nationality"
    row.old_value = "US"
    row.new_value = "CA"
    row.status = "Open"
    row.requested_date = None
    row.created_date = None
    row.updated_date = None
    result = MagicMock()
    result.scalars.return_value.all.return_value = [row]
    session.execute = AsyncMock(return_value=result)

    items = await EmployeeService().list_own_profile_update_requests(
        session, {"employeeId": str(employee_id)}
    )
    assert len(items) == 1
    assert items[0]["fieldChanged"] == "nationality"
    assert items[0]["newValue"] == "CA"


def _name_emp(*, first: str = "Alex", last: str = "Morgan") -> MagicMock:
    emp = MagicMock()
    emp.first_name = first
    emp.last_name = last
    emp.date_of_birth = date(1990, 1, 15)
    emp.nationality = "US"
    emp.email_id = "alex@example.com"
    emp.business_employee_id = "E1"
    emp.employee_code = "E1"
    return emp


@pytest.mark.asyncio
async def test_create_profile_update_rejects_case_only_name_change() -> None:
    session = AsyncMock()
    employee_id = uuid4()
    svc = EmployeeService()
    svc._get = AsyncMock(return_value=_name_emp(first="nagalla"))  # type: ignore[method-assign]

    with pytest.raises(HTTPException) as exc:
        await svc.create_profile_update_request(
            session,
            {"employeeId": str(employee_id)},
            {"fieldChanged": "firstName", "newValue": "NAGALLA"},
        )
    assert exc.value.status_code == 400
    assert "ignoring case and spaces" in str(exc.value.detail)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("current", "new_value"),
    [
        ("Nagalla", " Nagalla"),
        ("Nagalla", "Nagalla "),
        ("Nagalla", "  Nagalla  "),
        ("Nagalla Na", "Nagalla  Na"),
    ],
)
async def test_create_profile_update_rejects_space_only_name_change(
    current: str,
    new_value: str,
) -> None:
    session = AsyncMock()
    employee_id = uuid4()
    svc = EmployeeService()
    svc._get = AsyncMock(return_value=_name_emp(first=current))  # type: ignore[method-assign]

    with pytest.raises(HTTPException) as exc:
        await svc.create_profile_update_request(
            session,
            {"employeeId": str(employee_id)},
            {"fieldChanged": "firstName", "newValue": new_value},
        )
    assert exc.value.status_code == 400
    assert "ignoring case and spaces" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_create_profile_update_allows_real_name_change() -> None:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    employee_id = uuid4()
    svc = EmployeeService()
    svc._get = AsyncMock(return_value=_name_emp(first="Alex"))  # type: ignore[method-assign]

    with patch(
        "app.modules.employee.profile_update_notify.notify_hr_profile_update_request",
        new_callable=AsyncMock,
    ):
        payload = await svc.create_profile_update_request(
            session,
            {"employeeId": str(employee_id)},
            {"fieldChanged": "firstName", "newValue": "  Alexa  "},
        )

    assert payload["oldValue"] == "Alex"
    assert payload["newValue"] == "Alexa"


@pytest.mark.asyncio
async def test_create_profile_update_collapses_spaces_on_store() -> None:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    employee_id = uuid4()
    svc = EmployeeService()
    svc._get = AsyncMock(return_value=_name_emp(last="Morgan"))  # type: ignore[method-assign]

    with patch(
        "app.modules.employee.profile_update_notify.notify_hr_profile_update_request",
        new_callable=AsyncMock,
    ):
        payload = await svc.create_profile_update_request(
            session,
            {"employeeId": str(employee_id)},
            {"fieldChanged": "lastName", "newValue": "  Van  Dyke  "},
        )

    assert payload["oldValue"] == "Morgan"
    assert payload["newValue"] == "Van Dyke"


@pytest.mark.asyncio
async def test_create_free_text_profile_update_request() -> None:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    employee_id = uuid4()
    emp = _name_emp()
    svc = EmployeeService()
    svc._get = AsyncMock(return_value=emp)  # type: ignore[method-assign]

    with patch(
        "app.modules.employee.profile_update_notify.notify_hr_profile_update_request",
        new_callable=AsyncMock,
    ):
        payload = await svc.create_profile_update_request(
            session,
            {"employeeId": str(employee_id)},
            {
                "shortDescription": "Update my professional profile",
                "long_description": "Please add my recently completed certification.",
            },
        )

    row = session.add.call_args_list[0].args[0]
    assert row.employee_id == employee_id
    assert row.submitted_by_employee_id == employee_id
    assert row.field_changed == "general"
    assert row.old_value is None
    assert row.new_value == "Update my professional profile"
    assert payload["shortDescription"] == "Update my professional profile"
    assert payload["longDescription"] == (
        "Please add my recently completed certification."
    )
    assert payload["submittedByEmployeeId"] == str(employee_id)
    assert payload["hasAttachment"] is False


@pytest.mark.asyncio
async def test_create_free_text_profile_update_with_attachment() -> None:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.delete = AsyncMock()
    employee_id = uuid4()
    emp = _name_emp()
    svc = EmployeeService()
    svc._get = AsyncMock(return_value=emp)  # type: ignore[method-assign]

    attachment = MagicMock()
    attachment.filename = "proof.pdf"
    attachment.content_type = "application/pdf"
    attachment.read = AsyncMock(return_value=b"%PDF-1.4 fake")

    storage = MagicMock()
    with (
        patch(
            "app.modules.employee.profile_update_notify.notify_hr_profile_update_request",
            new_callable=AsyncMock,
        ),
        patch(
            "app.core.storage.get_storage",
            return_value=storage,
        ),
    ):
        payload = await svc.create_profile_update_request(
            session,
            {"employeeId": str(employee_id)},
            {
                "shortDescription": "Update address",
                "longDescription": "Please see attached utility bill.",
            },
            attachment=attachment,
        )

    row = session.add.call_args_list[0].args[0]
    assert row.attachment_file_name == "proof.pdf"
    assert row.attachment_object_key is not None
    assert "profile-update-requests/" in row.attachment_object_key
    assert payload["hasAttachment"] is True
    assert payload["attachmentFileName"] == "proof.pdf"
    storage.put_bytes.assert_called_once()
    assert storage.put_bytes.call_args.args[1] == b"%PDF-1.4 fake"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "body",
    [
        {"shortDescription": "", "longDescription": "Details"},
        {"shortDescription": "  ", "longDescription": "Details"},
    ],
)
async def test_create_free_text_profile_update_requires_short_description(
    body: dict,
) -> None:
    with pytest.raises(HTTPException) as exc:
        await EmployeeService().create_profile_update_request(
            AsyncMock(),
            {"employeeId": str(uuid4())},
            body,
        )
    assert exc.value.status_code == 400
    assert "shortDescription" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_create_free_text_profile_update_allows_empty_long_description() -> None:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    employee_id = uuid4()
    emp = _name_emp()
    svc = EmployeeService()
    svc._get = AsyncMock(return_value=emp)  # type: ignore[method-assign]

    with patch(
        "app.modules.employee.profile_update_notify.notify_hr_profile_update_request",
        new_callable=AsyncMock,
    ):
        payload = await svc.create_profile_update_request(
            session,
            {"employeeId": str(employee_id)},
            {
                "shortDescription": "Update my phone number",
                "longDescription": "",
            },
        )

    assert payload["shortDescription"] == "Update my phone number"
    assert payload["longDescription"] in ("", None)

@pytest.mark.asyncio
async def test_create_free_text_profile_update_on_behalf() -> None:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    actor_id = uuid4()
    subject_id = uuid4()
    requester = _name_emp(first="Riley", last="Requester")
    subject = _name_emp(first="Sam", last="Subject")
    svc = EmployeeService()
    svc._get = AsyncMock(side_effect=[subject, requester])  # type: ignore[method-assign]

    with patch(
        "app.modules.employee.profile_update_notify.notify_hr_profile_update_request",
        new_callable=AsyncMock,
    ) as notify:
        payload = await svc.create_profile_update_request(
            session,
            {"employeeId": str(actor_id)},
            {
                "short_description": "Correct Sam's profile",
                "longDescription": "The subject employee asked me to raise this.",
                "requestedForEmployeeId": str(subject_id),
            },
        )

    row = session.add.call_args_list[0].args[0]
    assert row.employee_id == subject_id
    assert row.submitted_by_employee_id == actor_id
    assert payload["employeeId"] == str(subject_id)
    assert payload["submittedByEmployeeId"] == str(actor_id)
    notify.assert_awaited_once_with(
        employee=subject,
        requester=requester,
        request=row,
    )


@pytest.mark.asyncio
async def test_employee_directory_search_returns_active_employee_choices() -> None:
    session = AsyncMock()
    employee_id = uuid4()
    row = MagicMock()
    row.employee_id = employee_id
    row.first_name = "Alex"
    row.last_name = "Morgan"
    row.business_employee_id = "EMP10001"
    row.employee_code = "LEGACY1"
    result = MagicMock()
    result.scalars.return_value.all.return_value = [row]
    session.execute = AsyncMock(return_value=result)

    payload = await EmployeeService().employee_directory_search(session, "al")

    assert payload == [
        {
            "id": str(employee_id),
            "firstName": "Alex",
            "lastName": "Morgan",
            "employeeId": "EMP10001",
        }
    ]
    statement = session.execute.await_args.args[0]
    assert '"EMPLOYEE"."STATUS"' in str(statement)
    assert "ACTIVE" in statement.compile().params.values()
    assert "LIMIT" in str(statement)


@pytest.mark.asyncio
async def test_complete_profile_update_request_marks_completed_and_notifies() -> None:
    session = AsyncMock()
    request_id = uuid4()
    subject_id = uuid4()
    raiser_id = uuid4()

    subject = MagicMock()
    subject.first_name = "Venkata"
    subject.last_name = "Subject"
    subject.email_id = "subject@example.com"
    subject.business_employee_id = "E2"
    subject.employee_code = "E2"

    raiser = MagicMock()
    raiser.first_name = "Sai"
    raiser.last_name = "Raiser"
    raiser.email_id = "raiser@example.com"
    raiser.business_employee_id = "E1"
    raiser.employee_code = "E1"

    row = MagicMock()
    row.id = request_id
    row.employee_id = subject_id
    row.submitted_by_employee_id = raiser_id
    row.status = "Open"
    row.employee = subject
    row.submitted_by_employee = raiser
    row.field_changed = "general"
    row.old_value = None
    row.new_value = "Update address"
    row.short_description = "Update address"
    row.long_description = "Please update home address"
    row.attachment_file_name = None
    row.requested_date = None
    row.updated_date = None

    result = MagicMock()
    result.scalar_one_or_none.return_value = row
    session.execute = AsyncMock(return_value=result)
    session.flush = AsyncMock()

    svc = EmployeeService()
    svc._require_functional_queue_access = MagicMock()  # type: ignore[method-assign]

    with patch(
        "app.modules.employee.profile_update_notify.notify_profile_update_completed",
        new_callable=AsyncMock,
    ) as notify:
        payload = await svc.complete_profile_update_request(
            session,
            {"employeeId": str(uuid4())},
            request_id,
            {"changesSummary": "Updated home address on file"},
        )

    assert row.status == "Completed"
    assert payload["status"] == "Completed"
    notify.assert_awaited_once()
    assert notify.await_args.kwargs["changes_summary"] == (
        "Updated home address on file"
    )
    assert notify.await_args.kwargs["requester"] is raiser
    assert notify.await_args.kwargs["subject"] is subject


@pytest.mark.asyncio
async def test_complete_profile_update_request_rejects_already_completed() -> None:
    session = AsyncMock()
    request_id = uuid4()
    row = MagicMock()
    row.id = request_id
    row.status = "Completed"
    result = MagicMock()
    result.scalar_one_or_none.return_value = row
    session.execute = AsyncMock(return_value=result)

    svc = EmployeeService()
    svc._require_functional_queue_access = MagicMock()  # type: ignore[method-assign]

    with pytest.raises(HTTPException) as exc:
        await svc.complete_profile_update_request(
            session,
            {"employeeId": str(uuid4())},
            request_id,
            {},
        )
    assert exc.value.status_code == 400
    assert "already completed" in str(exc.value.detail).lower()


@pytest.mark.asyncio
async def test_decide_profile_update_request_approves() -> None:
    session = AsyncMock()
    request_id = uuid4()
    row = MagicMock()
    row.id = request_id
    row.status = "Open"
    row.employee_id = uuid4()
    row.submitted_by_employee_id = None
    row.employee = MagicMock()
    row.employee.first_name = "Ada"
    row.employee.last_name = "Lovelace"
    row.employee.email_id = "ada@example.com"
    row.employee.business_employee_id = "E1"
    row.employee.employee_code = "E1"
    row.submitted_by_employee = None
    row.field_changed = "general"
    row.old_value = None
    row.new_value = "Update"
    row.short_description = "Update"
    row.long_description = None
    row.attachment_file_name = None
    row.requested_date = None
    row.created_date = None
    row.updated_date = None
    result = MagicMock()
    result.scalar_one_or_none.return_value = row
    session.execute = AsyncMock(return_value=result)
    session.flush = AsyncMock()

    svc = EmployeeService()
    svc._require_functional_queue_access = MagicMock()  # type: ignore[method-assign]

    with patch(
        "app.modules.employee.profile_update_notify.notify_profile_update_completed",
        new_callable=AsyncMock,
    ) as notify, patch(
        "app.modules.employee.request_decision_notify.notify_request_decision",
        new_callable=AsyncMock,
    ):
        payload = await svc.decide_profile_update_request(
            session,
            {"employeeId": str(uuid4())},
            request_id,
            {"action": "approve"},
        )

    assert row.status == "Approved"
    assert payload["status"] == "Approved"
    notify.assert_awaited_once()


@pytest.mark.asyncio
async def test_decide_profile_update_request_requires_reject_notes() -> None:
    svc = EmployeeService()
    svc._require_functional_queue_access = MagicMock()  # type: ignore[method-assign]
    with pytest.raises(HTTPException) as exc:
        await svc.decide_profile_update_request(
            AsyncMock(),
            {"employeeId": str(uuid4())},
            uuid4(),
            {"action": "reject"},
        )
    assert exc.value.status_code == 400
    assert "notes" in str(exc.value.detail).lower()



@pytest.mark.asyncio
async def test_structured_profile_update_keeps_reason() -> None:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    svc = EmployeeService()
    svc._get = AsyncMock(return_value=_name_emp(last="Morgan"))  # type: ignore[method-assign]

    with patch(
        "app.modules.employee.profile_update_notify.notify_hr_profile_update_request",
        new_callable=AsyncMock,
    ):
        payload = await svc.create_profile_update_request(
            session,
            {"employeeId": str(uuid4())},
            {
                "fieldChanged": "lastName",
                "newValue": "Rao",
                "longDescription": "  Name change after marriage.  ",
            },
        )

    assert payload["fieldChanged"] == "lastName"
    assert payload["oldValue"] == "Morgan"
    assert payload["newValue"] == "Rao"
    assert payload["longDescription"] == "Name change after marriage."


def _attachment_row(employee_id, submitted_by):
    row = MagicMock()
    row.employee_id = employee_id
    row.submitted_by_employee_id = submitted_by
    row.attachment_object_key = "profile/abc.pdf"
    row.attachment_file_name = "certificate.pdf"
    return row


def _session_returning(row):
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = row
    session.execute = AsyncMock(return_value=result)
    return session


@pytest.mark.asyncio
async def test_own_attachment_download_allowed_for_requester() -> None:
    me = uuid4()
    session = _session_returning(_attachment_row(uuid4(), me))
    key, name = await EmployeeService().own_profile_update_attachment_object(
        session, {"employeeId": str(me)}, uuid4()
    )
    assert key == "profile/abc.pdf"
    assert name == "certificate.pdf"


@pytest.mark.asyncio
async def test_own_attachment_download_hidden_from_other_employees() -> None:
    session = _session_returning(_attachment_row(uuid4(), uuid4()))
    with pytest.raises(HTTPException) as exc:
        await EmployeeService().own_profile_update_attachment_object(
            session, {"employeeId": str(uuid4())}, uuid4()
        )
    assert exc.value.status_code == 404
