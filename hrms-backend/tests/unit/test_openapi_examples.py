from app.core.openapi_examples import REQUEST_EXAMPLES
from app.main import create_app


def _json_body_operations(schema: dict) -> set[tuple[str, str]]:
    found = set()
    for path, operations in schema["paths"].items():
        for method, operation in operations.items():
            content = operation.get("requestBody", {}).get("content", {})
            if "application/json" in content:
                found.add((method.upper(), path))
    return found


def test_every_example_targets_an_existing_json_body() -> None:
    schema = create_app().openapi()
    unknown = set(REQUEST_EXAMPLES) - _json_body_operations(schema)
    assert not unknown, f"Examples for routes without a JSON body: {sorted(unknown)}"


def test_every_json_body_has_an_example() -> None:
    schema = create_app().openapi()
    for method, path in _json_body_operations(schema):
        content = schema["paths"][path][method.lower()]["requestBody"]["content"]
        assert "example" in content["application/json"], f"{method} {path} has no example"
