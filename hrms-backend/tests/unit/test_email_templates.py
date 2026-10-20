"""Notification email templates: rendering, HTML conversion, and the catalog."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.mail.templates import TEMPLATES, bullet_lines, render, text_to_html

_APP = Path(__file__).resolve().parents[2] / "app"


def test_every_editable_template_uses_only_its_placeholders() -> None:
    for template in TEMPLATES.values():
        if not template.editable:
            continue
        used = set(re.findall(r"{(\w+)}", template.subject + template.body))
        assert used <= set(template.placeholders), (template.key, used - set(template.placeholders))


def test_every_editable_template_renders_without_leftover_braces() -> None:
    for template in TEMPLATES.values():
        if not template.editable:
            continue
        email = render(template.key, **{name: f"<{name}>" for name in template.placeholders})
        assert "{" not in email.subject and "{" not in email.text_body
        assert "&lt;" in email.html_body or not template.placeholders  # values are escaped


def test_every_event_sent_in_code_has_a_template() -> None:
    events = set()
    for path in _APP.rglob("*.py"):
        events |= set(re.findall(r'event="([\w.]+)"', path.read_text()))
    assert events, "expected notification events in app code"
    assert events <= set(TEMPLATES), events - set(TEMPLATES)


def test_render_fills_subject_text_and_html() -> None:
    email = render(
        "timesheet.rejected",
        employee_name="Durga",
        week="2026-09-13 – 2026-09-19",
        reason="Fix Friday",
        timesheets_url="http://localhost:3000/employee-portal",
    )
    assert email.subject == "[EAOVA] Timesheet rejected (2026-09-13 – 2026-09-19)"
    assert "Hi Durga," in email.text_body
    assert "- Reason: Fix Friday" in email.text_body
    assert "<li>Reason: Fix Friday</li>" in email.html_body
    assert '<a href="http://localhost:3000/employee-portal">Open Time Sheets</a>' in email.html_body


def test_missing_placeholder_renders_empty() -> None:
    email = render("timesheet.approved", employee_name="Durga")
    assert "Your timesheet for week  was approved." in email.text_body


def test_fixed_layout_templates_are_not_rendered_here() -> None:
    with pytest.raises(ValueError):
        render("asset.assigned")


def test_text_to_html_escapes_and_links() -> None:
    html = text_to_html("Hi <b>you</b>,\n\nSee https://x.com/a?b=1&c=2 now")
    assert "&lt;b&gt;you&lt;/b&gt;" in html
    assert '<a href="https://x.com/a?b=1&amp;c=2">' in html


def test_bullet_lines() -> None:
    assert bullet_lines(["a", "b"]) == "- a\n- b"
