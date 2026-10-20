"""Every notification email's wording, in one place.

Each template has a key (also the queued email's ``event``), a name and
description for Company Setup → Notifications, the placeholders it uses, and a
subject and body written as plain text with ``{placeholders}``. The HTML
version is generated from the body: blank lines separate paragraphs, lines
starting with "- " become a bulleted list, "Label: https://…" lines become a
link, and other links are made clickable. Keeping the body as plain text is
what lets HR edit these later without touching HTML.

``editable=False`` marks the few emails with a fixed table layout (asset
assignment and return); they are listed here but rendered by their module.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from html import escape
from typing import Any, Final

BRAND: Final = "EAOVA"


@dataclass(frozen=True)
class EmailTemplate:
    key: str
    name: str
    description: str
    recipients: str
    placeholders: tuple[str, ...]
    subject: str
    body: str
    editable: bool = True


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    text_body: str
    html_body: str


def _t(key, name, description, recipients, placeholders, subject, body, editable=True):
    return EmailTemplate(key, name, description, recipients, tuple(placeholders), subject, body, editable)


TEMPLATES: Final[dict[str, EmailTemplate]] = {
    t.key: t
    for t in (
        _t(
            "employee.invite",
            "Employee invite",
            "Sent when HR invites a new employee.",
            "The invited employee",
            ("employee_name", "company", "sign_in_url", "work_email", "from_name"),
            "You're invited to join {company} on EAOVA",
            "Hi {employee_name},\n\n"
            "{company} has invited you to EAOVA HRMS.\n\n"
            "Open {sign_in_url} and choose Sign in with Microsoft, using your work "
            "account {work_email}. There is no separate password to set.\n\n"
            "If you were not expecting this email, you can ignore it.\n\n"
            "— {from_name}",
        ),
        _t(
            "leave.submitted",
            "Leave submitted",
            "A leave request is submitted or resubmitted for approval.",
            "The employee's reporting manager",
            ("employee_name", "employee_code", "action", "leave_type", "dates", "days", "review_url"),
            "[EAOVA] {employee_name} {action} a leave request ({dates})",
            "{employee_name} ({employee_code}) {action} a leave request for approval.\n\n"
            "- Type: {leave_type}\n"
            "- Dates: {dates}\n"
            "- Days: {days}\n\n"
            "Open leave review: {review_url}",
        ),
        _t(
            "leave.approved",
            "Leave approved",
            "A leave request is approved.",
            "The employee",
            ("employee_name", "leave_type", "dates", "days", "leaves_url"),
            "[EAOVA] Leave approved ({dates})",
            "Hi {employee_name},\n\n"
            "Your {leave_type} request for {dates} ({days} days) was approved.\n\n"
            "Open Leaves: {leaves_url}",
        ),
        _t(
            "leave.rejected",
            "Leave rejected",
            "A leave request is rejected, including after it was approved.",
            "The employee",
            ("employee_name", "previously", "leave_type", "dates", "reason", "leaves_url"),
            "[EAOVA] Leave rejected ({dates})",
            "Hi {employee_name},\n\n"
            "Your {previously}{leave_type} request for {dates} was rejected.\n\n"
            "- Reason: {reason}\n\n"
            "You can submit a corrected request from Leaves: {leaves_url}",
        ),
        _t(
            "timesheet.submitted",
            "Timesheet submitted",
            "A weekly timesheet is submitted or resubmitted for approval.",
            "The employee's reporting manager",
            ("employee_name", "employee_code", "week", "review_url"),
            "[EAOVA] {employee_name} submitted timesheet ({week})",
            "{employee_name} ({employee_code}) submitted a timesheet for approval.\n\n"
            "- Week: {week}\n\n"
            "Open timesheet review: {review_url}",
        ),
        _t(
            "timesheet.approved",
            "Timesheet approved",
            "A weekly timesheet is approved.",
            "The employee",
            ("employee_name", "week", "timesheets_url"),
            "[EAOVA] Timesheet approved ({week})",
            "Hi {employee_name},\n\n"
            "Your timesheet for week {week} was approved.\n\n"
            "Open Time Sheets: {timesheets_url}",
        ),
        _t(
            "timesheet.rejected",
            "Timesheet rejected",
            "A weekly timesheet is rejected.",
            "The employee",
            ("employee_name", "week", "reason", "timesheets_url"),
            "[EAOVA] Timesheet rejected ({week})",
            "Hi {employee_name},\n\n"
            "Your timesheet for week {week} was rejected.\n\n"
            "- Reason: {reason}\n\n"
            "Open Time Sheets: {timesheets_url}",
        ),
        _t(
            "timesheet.reminder",
            "Timesheet reminder",
            "Weekly reminder about timesheets not yet submitted.",
            "Employees with outstanding weeks",
            ("employee_name", "weeks", "timesheets_url"),
            "[EAOVA] Reminder: submit outstanding timesheets",
            "Hi {employee_name},\n\n"
            "Please submit your outstanding timesheet(s) for the following week(s):\n\n"
            "{weeks}\n\n"
            "Open Time Sheets: {timesheets_url}",
        ),
        _t(
            "timesheet.review_reminder",
            "Timesheet review reminder",
            "Reminder about submitted timesheets still waiting for review.",
            "Reporting managers with timesheets to review",
            ("manager_name", "timesheets", "manage_url"),
            "[EAOVA] Reminder: timesheets waiting for your review",
            "Hi {manager_name},\n\n"
            "The following submitted timesheet(s) are still waiting for review:\n\n"
            "{timesheets}\n\n"
            "Open Manage: {manage_url}",
        ),
        _t(
            "onboarding.document_uploaded",
            "Onboarding document uploaded",
            "A new hire uploads an onboarding document.",
            "Employees → Onboarding full access (else Admins, else Superadmins)",
            ("employee_name", "employee_code", "document", "version", "work_email", "employees_url"),
            "[EAOVA] {employee_name} uploaded {document} (v{version})",
            '{employee_name} ({employee_code}) submitted onboarding document "{document}" '
            "version {version}.\n\n"
            "- Official email: {work_email}\n\n"
            "Open employees directory: {employees_url}",
        ),
        _t(
            "profile_update.requested",
            "Profile update requested",
            "An employee (or someone on their behalf) asks to change profile details.",
            "Employee Portal → Manage full access (else Admins, else Superadmins)",
            ("submitted_line", "summary_subject", "requester_email", "subject_email", "details", "request_id", "employees_url"),
            "[EAOVA] Profile update request: {summary_subject}",
            "{submitted_line}\n\n"
            "- Requester email: {requester_email}\n"
            "- Subject email: {subject_email}\n"
            "{details}\n"
            "- Request id: {request_id}\n\n"
            "Open employees: {employees_url}",
        ),
        _t(
            "profile_update.on_behalf",
            "Profile update on your behalf",
            "Someone submits a profile update request on an employee's behalf.",
            "The employee the request is about",
            ("requester_name", "requester_code", "details", "request_id"),
            "[EAOVA] Profile update request submitted on your behalf",
            "{requester_name} ({requester_code}) submitted a profile update request on "
            "your behalf.\n\n"
            "{details}\n"
            "- Request id: {request_id}",
        ),
        _t(
            "profile_update.completed",
            "Profile update completed",
            "A profile update request is marked Completed.",
            "The person who submitted it",
            ("request_id", "summary", "changes"),
            "[EAOVA] Request completed: {summary}",
            "Your profile update request has been marked Completed.\n\n"
            "- Request id: {request_id}\n"
            "- Summary: {summary}\n"
            "- Changes: {changes}",
        ),
        _t(
            "profile_update.completed_subject",
            "Profile update completed (about you)",
            "A request someone made on an employee's behalf is marked Completed.",
            "The employee the request is about",
            ("employee_name", "request_id", "summary", "changes"),
            "[EAOVA] Request completed: {summary}",
            "A profile update request about {employee_name} has been marked Completed.\n\n"
            "- Request id: {request_id}\n"
            "- Summary: {summary}\n"
            "- Changes: {changes}",
        ),
        _t(
            "asset_request.submitted",
            "Asset request",
            "An employee requests an asset or reports a problem with one.",
            "Assets full access (else Admins, else Superadmins)",
            ("employee_name", "employee_code", "work_email", "request_type", "category", "asset", "details", "request_id", "assets_url"),
            "[EAOVA] {employee_name} submitted asset request ({request_type})",
            "{employee_name} ({employee_code}) submitted an asset request.\n\n"
            "- Official email: {work_email}\n"
            "- Request type: {request_type}\n"
            "- Category: {category}\n"
            "- Asset: {asset}\n"
            "- New asset details: {details}\n"
            "- Request id: {request_id}\n\n"
            "Open assets: {assets_url}",
        ),
        _t(
            "asset_request.approved",
            "Asset request approved",
            "An asset request is approved and carried out in Assets.",
            "Whoever raised it, the employee it is for, and the other asset managers",
            ("requester_name", "subject_name", "request_type", "summary", "outcome", "decided_by", "comment"),
            "[EAOVA] Asset request approved: {request_type}",
            "The asset request below was approved by {decided_by}.\n\n"
            "- Requested by: {requester_name}\n"
            "- For: {subject_name}\n"
            "- Request: {request_type}\n"
            "- Details: {summary}\n"
            "- Result: {outcome}",
        ),
        _t(
            "asset_request.rejected",
            "Asset request rejected",
            "An asset request is rejected with a reason.",
            "Whoever raised it, the employee it is for, and the other asset managers",
            ("requester_name", "subject_name", "request_type", "summary", "decided_by", "comment"),
            "[EAOVA] Asset request rejected: {request_type}",
            "The asset request below was rejected by {decided_by}.\n\n"
            "- Requested by: {requester_name}\n"
            "- For: {subject_name}\n"
            "- Request: {request_type}\n"
            "- Details: {summary}\n"
            "- Reason: {comment}",
        ),
        _t(
            "profile_update.rejected",
            "Profile update rejected",
            "A profile update request is rejected with a reason.",
            "Whoever raised it, the employee it is for, and the other managers of profile updates",
            ("requester_name", "subject_name", "request_type", "summary", "decided_by", "comment"),
            "[EAOVA] Profile update request rejected",
            "The profile update request below was rejected by {decided_by}.\n\n"
            "- Requested by: {requester_name}\n"
            "- For: {subject_name}\n"
            "- Change: {summary}\n"
            "- Reason: {comment}",
        ),
        _t(
            "request.decided",
            "Request decided (copy for managers)",
            "Tells the other managers that a request was approved or rejected, so nobody handles it twice.",
            "The other people who manage that kind of request",
            ("decision", "requester_name", "subject_name", "request_type", "summary", "decided_by", "comment", "outcome"),
            "[EAOVA] {request_type} request {decision}",
            "{decided_by} {decision} a request.\n\n"
            "- Requested by: {requester_name}\n"
            "- For: {subject_name}\n"
            "- Request: {request_type}\n"
            "- Details: {summary}\n"
            "- Result: {outcome}\n"
            "- Comment: {comment}",
        ),
        _t(
            "it_request.submitted",
            "IT request",
            "An employee raises an IT request.",
            "Assets full access until an IT permission exists (else Admins, else Superadmins)",
            ("employee_name", "employee_code", "work_email", "category", "details", "request_id", "app_url"),
            "[EAOVA] {employee_name} submitted IT request ({category})",
            "{employee_name} ({employee_code}) submitted an IT request.\n\n"
            "- Official email: {work_email}\n"
            "- Category: {category}\n"
            "- Details: {details}\n"
            "- Request id: {request_id}\n\n"
            "Open app: {app_url}",
        ),
        _t(
            "asset.lost",
            "Asset reported lost",
            "An asset is recorded as lost or stolen.",
            "The employee who held it, and Assets full access (else Admins, else Superadmins)",
            ("asset_id", "category", "model", "employee_name", "detail", "notes", "recorded_by"),
            "[EAOVA] Asset reported lost: {asset_id}",
            "Asset {asset_id} has been recorded as lost.\n\n"
            "- Category: {category}\n"
            "- Model: {model}\n"
            "- Last held by: {employee_name}\n"
            "- {detail}\n"
            "- Note: {notes}\n"
            "- Recorded by: {recorded_by}",
        ),
        _t(
            "asset.found",
            "Asset found",
            "A lost asset is found and its next status is set.",
            "The employee who held it, and Assets full access (else Admins, else Superadmins)",
            ("asset_id", "category", "model", "employee_name", "detail", "notes", "recorded_by"),
            "[EAOVA] Asset found: {asset_id}",
            "Asset {asset_id} has been found.\n\n"
            "- Category: {category}\n"
            "- Model: {model}\n"
            "- Last held by: {employee_name}\n"
            "- {detail}\n"
            "- Note: {notes}\n"
            "- Recorded by: {recorded_by}",
        ),
        _t(
            "asset.assigned",
            "Asset assigned",
            "An asset is assigned to an employee (fixed table layout).",
            "The employee",
            (),
            "[company] Asset assigned to you — asset id",
            "",
            editable=False,
        ),
        _t(
            "asset.swapped",
            "Asset swapped",
            "An asset is swapped for another: one email covers the return and the new asset (fixed table layout).",
            "The employee",
            (),
            "[company] Asset swapped — old asset id to new asset id",
            "",
            editable=False,
        ),
        _t(
            "asset.returned",
            "Asset return recorded",
            "An asset return is recorded (fixed table layout).",
            "The employee",
            (),
            "[company] Asset return recorded — asset id",
            "",
            editable=False,
        ),
    )
}


_PLACEHOLDER = re.compile(r"\{(\w+)\}")

SUBJECT_MAX = 200
BODY_MAX = 5000

# Wording edited in Company Setup → Notifications: key → (subject, body). Filled
# from the database at startup, refreshed every minute and after each save, so
# ``render`` stays synchronous. Nothing here means the built-in default.
_overrides: dict[str, tuple[str, str]] = {}


class TemplateError(ValueError):
    """An edited template that cannot be saved; the message is shown to the editor."""


def set_overrides(rows: dict[str, tuple[str, str]]) -> None:
    global _overrides
    _overrides = dict(rows)


def effective_wording(key: str) -> tuple[str, str]:
    """The (subject, body) in use: the edited wording, else the default."""
    template = TEMPLATES[key]
    return _overrides.get(key, (template.subject, template.body))


def _fill(text: str, values: dict[str, str]) -> str:
    """Replace ``{name}`` with its value. Unknown names become empty; nothing else in
    the text is interpreted, so any wording renders safely."""
    return _PLACEHOLDER.sub(lambda m: values.get(m.group(1), ""), text)


def validate_wording(key: str, subject: str, body: str) -> tuple[str, str]:
    """Check an edited subject and body; return them cleaned, or raise ``TemplateError``."""
    template = TEMPLATES.get(key)
    if template is None:
        raise TemplateError("That email does not exist.")
    if not template.editable:
        raise TemplateError("This email has a fixed layout and cannot be edited.")
    subject = (subject or "").strip()
    body = (body or "").replace("\r\n", "\n").strip()
    if not subject:
        raise TemplateError("The subject cannot be empty.")
    if "\n" in subject:
        raise TemplateError("The subject must be a single line.")
    if len(subject) > SUBJECT_MAX:
        raise TemplateError(f"The subject can be at most {SUBJECT_MAX} characters.")
    if not body:
        raise TemplateError("The message cannot be empty.")
    if len(body) > BODY_MAX:
        raise TemplateError(f"The message can be at most {BODY_MAX} characters.")
    allowed = set(template.placeholders)
    available = ", ".join("{" + name + "}" for name in template.placeholders) or "none"
    for label, text in (("subject", subject), ("message", body)):
        unknown = [name for name in _PLACEHOLDER.findall(text) if name not in allowed]
        if unknown:
            raise TemplateError(
                f"The {label} uses {{{unknown[0]}}}, which this email does not have. "
                f"You can use: {available}."
            )
        if "{" in _PLACEHOLDER.sub("", text) or "}" in _PLACEHOLDER.sub("", text):
            raise TemplateError(
                f"The {label} has a curly brace that is not part of a placeholder. "
                "Placeholders look like {employee_name}."
            )
    return subject, body


_SAMPLE_VALUES: Final[dict[str, str]] = {
    "employee_name": "Alex Morgan",
    "employee_code": "EMP00042",
    "manager_name": "Sam Rivera",
    "requester_name": "Sam Rivera",
    "requester_code": "EMP00007",
    "action": "submitted",
    "previously": "",
    "leave_type": "Personal Leave",
    "dates": "2026-10-05 – 2026-10-07",
    "days": "3",
    "reason": "Please check Friday's hours.",
    "week": "2026-09-27 – 2026-10-03",
    "weeks": "- 2026-09-20 – 2026-09-26\n- 2026-09-27 – 2026-10-03",
    "timesheets": "- Alex Morgan: 2026-09-27 – 2026-10-03",
    "document": "Passport",
    "version": "2",
    "work_email": "alex.morgan@yourcompany.com",
    "requester_email": "sam.rivera@yourcompany.com",
    "subject_email": "alex.morgan@yourcompany.com",
    "company": "Your Company",
    "from_name": BRAND,
    "submitted_line": "Alex Morgan (EMP00042) submitted a profile update request.",
    "summary_subject": "Alex Morgan (First name)",
    "summary": "Update my name",
    "changes": "First name changed to Alexander.",
    "details": "- Field: First name\n- Current value: Alex\n- Requested value: Alexander",
    "request_id": "3f2a9c1e",
    "request_type": "New",
    "category": "Laptop",
    "asset": "COG-LAP-0001",
}


def sample_values(key: str, base_url: str) -> dict[str, str]:
    """Example values for every placeholder of a template, for previews."""
    base = base_url.rstrip("/")
    values: dict[str, str] = {}
    for name in TEMPLATES[key].placeholders:
        if name.endswith("_url"):
            values[name] = f"{base}/employee-portal" if name != "sign_in_url" else base
        else:
            values[name] = _SAMPLE_VALUES.get(name, f"[{name}]")
    return values


_LINK_LINE = re.compile(r"^(?P<label>[^:]{1,80}):\s*(?P<url>https?://\S+)$")
_URL = re.compile(r"(https?://[^\s<]+)")


def _linkify(escaped: str) -> str:
    return _URL.sub(lambda m: f'<a href="{m.group(1)}">{m.group(1)}</a>', escaped)


def text_to_html(text: str) -> str:
    """Plain-text body → simple HTML (paragraphs, bullet lists, links)."""
    parts: list[str] = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = [line.rstrip() for line in block.splitlines() if line.strip()]
        if not lines:
            continue
        if all(line.lstrip().startswith("- ") for line in lines):
            items = "".join(
                f"<li>{_linkify(escape(line.lstrip()[2:]))}</li>" for line in lines
            )
            parts.append(f"<ul>{items}</ul>")
            continue
        rendered: list[str] = []
        for line in lines:
            match = _LINK_LINE.match(line.strip())
            if match:
                url = escape(match.group("url"), quote=True)
                rendered.append(f'<a href="{url}">{escape(match.group("label"))}</a>')
            else:
                rendered.append(_linkify(escape(line)))
        parts.append(f"<p>{'<br>'.join(rendered)}</p>")
    return "".join(parts)


def render(key: str, **values: Any) -> RenderedEmail:
    """Fill a template's placeholders and build the text and HTML versions."""
    template = TEMPLATES[key]
    if not template.editable:
        raise ValueError(f"Template {key} has a fixed layout; its module renders it")
    return render_wording(key, *effective_wording(key), **values)


def render_wording(key: str, subject_text: str, body_text: str, **values: Any) -> RenderedEmail:
    """Render given wording (used for previews of unsaved edits) with these values."""
    filled = {name: "" if value is None else str(value) for name, value in values.items()}
    subject = " ".join(_fill(subject_text, filled).split())
    text = _fill(body_text, filled).strip() + "\n"
    return RenderedEmail(subject=subject, text_body=text, html_body=text_to_html(text))


def bullet_lines(items: list[str]) -> str:
    """Several values as "- item" lines, for list placeholders (weeks, details)."""
    return "\n".join(f"- {item}" for item in items)
