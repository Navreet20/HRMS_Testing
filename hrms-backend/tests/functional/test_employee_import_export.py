from app.modules.employee.import_export import (
    build_template_csv,
    employees_to_csv,
    parse_employee_csv,
)


def test_build_template_has_required_headers():
    text = build_template_csv().decode("utf-8-sig")
    header = text.splitlines()[0]
    assert "firstName" in header
    assert "emailId" in header
    assert "department" in header


def test_parse_valid_csv():
    rows, errors = parse_employee_csv(build_template_csv())
    assert errors == []
    assert len(rows) == 1
    assert rows[0]["emailId"] == "ada.lovelace@example.com"


def test_parse_missing_required_column():
    data = b"firstName,lastName\nAda,Lovelace\n"
    rows, errors = parse_employee_csv(data)
    assert rows == []
    assert errors
    assert "Missing required" in errors[0]["message"]


def test_parse_row_validation():
    data = (
        b"firstName,lastName,emailId,department\n"
        b",Lovelace,bad-email,Engineering\n"
        b"Ada,Lovelace,ada@example.com,Engineering\n"
    )
    rows, errors = parse_employee_csv(data)
    assert len(rows) == 1
    assert len(errors) == 1
    assert errors[0]["row"] == 2


def test_employees_to_csv_round_trip_headers():
    csv_bytes = employees_to_csv(
        [
            {
                "firstName": "Ada",
                "lastName": "Lovelace",
                "emailId": "ada@example.com",
                "department": "Engineering",
            }
        ]
    )
    rows, errors = parse_employee_csv(csv_bytes)
    assert errors == []
    assert rows[0]["firstName"] == "Ada"


def test_parse_empty_role_is_allowed():
    data = (
        b"firstName,lastName,emailId,department,role\n"
        b"Ada,Lovelace,ada@example.com,HR,\n"
    )
    rows, errors = parse_employee_csv(data)
    assert errors == []
    assert rows[0]["department"] == "HR"
    assert rows[0]["role"] == ""
