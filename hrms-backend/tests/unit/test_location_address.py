from types import SimpleNamespace

from app.core.serialize import (
    location_address_label,
    personal_address_label,
    preferred_personal_address,
)


def test_location_address_label_joins_address_parts() -> None:
    location = SimpleNamespace(
        address_line_1="400 Congress Ave",
        address_line_2="Suite 200",
        city="Austin",
        state="TX",
        zip="78701",
        country="US",
        location_name="Austin Office",
    )
    assert location_address_label(location) == (
        "400 Congress Ave, Suite 200, Austin, TX, 78701, US"
    )


def test_location_address_label_falls_back_to_name() -> None:
    location = SimpleNamespace(
        address_line_1="  ",
        address_line_2=None,
        city="",
        state=None,
        zip=None,
        country=None,
        location_name="HQ - New York",
    )
    assert location_address_label(location) == "HQ - New York"


def test_location_address_label_none() -> None:
    assert location_address_label(None) is None


def test_personal_address_label_from_address_row() -> None:
    address = SimpleNamespace(
        address_line1="718 Green Hill Manor Drive",
        address_line2=None,
        city="Franklin Township",
        state="NJ",
        zip_code="08823",
        country="US",
    )
    assert personal_address_label(address) == (
        "718 Green Hill Manor Drive, Franklin Township, NJ, 08823, US"
    )


def test_personal_address_label_from_contact_dict() -> None:
    contact = {
        "addressLine1": "26 Cabot Way",
        "addressLine2": "",
        "city": "Franklin Township",
        "state": "NJ",
        "postalCode": "08823",
        "country": "US",
    }
    assert personal_address_label(contact) == (
        "26 Cabot Way, Franklin Township, NJ, 08823, US"
    )


def test_preferred_personal_address_picks_home() -> None:
    office = SimpleNamespace(
        address_line1="4105 US-1",
        city="Monmouth Junction",
        address_type="OFFICE",
        status="ACTIVE",
    )
    home = SimpleNamespace(
        address_line1="718 Green Hill Manor Drive",
        city="Franklin Township",
        address_type="HOME",
        status="ACTIVE",
    )
    picked = preferred_personal_address([office, home])
    assert picked is home
