"""Parse Photon / Nominatim-style GeoJSON into address suggestions."""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from app.modules.org.geo import city_is_required

GEOCODE_DISPLAY_LIMIT = 3

_POI_CLASSES = frozenset(
    {"amenity", "shop", "tourism", "office", "leisure", "craft", "building"}
)
_STREET_CLASSES = frozenset({"place", "highway"})
_STREET_TYPES = frozenset({"house", "houses", "residential", "living_street"})

_PRIMARY_CITY_FIELDS = ("city", "town", "village")
_DISTRICT_CITY_FIELDS = (
    "city_district",
    "suburb",
    "district",
    "neighbourhood",
    "quarter",
    "hamlet",
)
_REGION_FIELDS = ("state", "county", "region", "state_district")


def _text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _first(props: dict[str, Any], keys: tuple[str, ...] | list[str]) -> str:
    for key in keys:
        text = _text(props.get(key))
        if text:
            return text
    return ""


def _street_from_photon(props: dict[str, Any]) -> str:
    number = _first(props, ("housenumber", "house_number"))
    street = _first(props, ("street",))
    name = _first(props, ("name",))
    road = street or name
    if number and street:
        return f"{number} {street}"
    if number and road:
        return f"{number} {road}"
    return street


def _city_from_photon(props: dict[str, Any], country_code: str) -> str:
    for key in _PRIMARY_CITY_FIELDS:
        text = _text(props.get(key))
        if text:
            return text
    allow_district = not city_is_required(country_code or None)
    if allow_district:
        for key in _DISTRICT_CITY_FIELDS:
            text = _text(props.get(key))
            if text:
                return text
    return ""


def _region_from_photon(props: dict[str, Any]) -> str:
    return _first(props, _REGION_FIELDS)


def _preference(osm_class: str, osm_type: str, address_type: str) -> str:
    cls = osm_class.strip().lower()
    typ = osm_type.strip().lower()
    kind = address_type.strip().lower()
    if (
        cls in _STREET_CLASSES
        or typ in _STREET_TYPES
        or kind in {"house", "road", "street"}
    ):
        return "street"
    if cls in _POI_CLASSES or kind in _POI_CLASSES or kind in {"amenity", "shop"}:
        return "poi"
    return "street"


def _normalize_key(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value)
    folded = "".join(ch for ch in folded if not unicodedata.combining(ch))
    folded = folded.lower()
    folded = re.sub(r"[^a-z0-9]+", " ", folded)
    return re.sub(r"\s+", " ", folded).strip()


def _label_poi(label: str, name: str = "") -> str:
    if re.search(r"\(poi\)", label, flags=re.I):
        return label
    poi_name = name.strip()
    if poi_name and label.startswith(poi_name):
        return f"{poi_name} (POI){label[len(poi_name):]}"
    if poi_name:
        return f"{poi_name} (POI), {label}"
    comma = label.find(",")
    if comma > 0:
        return f"{label[:comma]} (POI){label[comma:]}"
    return f"{label} (POI)"


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def parse_photon_results(payload: Any) -> list[dict[str, str]]:
    root = _as_dict(payload)
    features = root.get("features")
    if not isinstance(features, list):
        features = []

    ranked: list[dict[str, Any]] = []
    for feature in features:
        props = _as_dict(_as_dict(feature).get("properties"))
        name = _text(props.get("name"))
        street = _street_from_photon(props)
        country_code = _first(props, ("countrycode", "countryCode")).upper()
        city = _city_from_photon(props, country_code)
        state = _region_from_photon(props)
        postal_code = _first(props, ("postcode", "postalcode"))
        label_parts = [street or name, city, state, postal_code]
        label = ", ".join(part for part in label_parts if part)
        if not label and not city:
            continue
        ranked.append(
            {
                "label": label or name,
                "street": street or name,
                "city": city,
                "state": state,
                "postalCode": postal_code,
                "countryCode": country_code,
                "name": name,
                "preference": _preference(
                    _first(props, ("osm_key", "osmkey")),
                    _first(props, ("osm_value", "osmvalue")),
                    _text(props.get("type")),
                ),
            }
        )

    streets = [row for row in ranked if row["preference"] == "street"]
    chosen = streets if streets else ranked
    only_poi = not streets
    places: list[dict[str, str]] = []
    for row in chosen:
        place = {
            "label": str(row["label"]),
            "street": str(row["street"]),
            "city": str(row["city"]),
            "state": str(row["state"]),
            "postalCode": str(row["postalCode"]),
            "countryCode": str(row["countryCode"]),
        }
        if only_poi and row["preference"] == "poi":
            place["label"] = _label_poi(place["label"], str(row.get("name") or ""))
        places.append(place)

    seen: set[str] = set()
    deduped: list[dict[str, str]] = []
    for place in places:
        key = _normalize_key(place["label"]) or _normalize_key(
            " ".join(
                [
                    place["street"],
                    place["city"],
                    place["state"],
                    place["postalCode"],
                    place["countryCode"],
                ]
            )
        )
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(place)
        if len(deduped) >= GEOCODE_DISPLAY_LIMIT:
            break
    return deduped
