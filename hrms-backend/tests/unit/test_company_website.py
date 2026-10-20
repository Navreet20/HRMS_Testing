from app.modules.company.website import normalize_company_website


def test_normalize_company_website_accepts_host_only_and_www() -> None:
    assert normalize_company_website("https://cognivance.com") == "https://cognivance.com"
    assert normalize_company_website("www.cognivance.com") == "https://www.cognivance.com"
    assert normalize_company_website("cognivance.com") == "https://cognivance.com"
    assert normalize_company_website("http://www.cognivance.com/about") == (
        "http://www.cognivance.com/about"
    )


def test_normalize_company_website_rejects_nonsense() -> None:
    for raw in ("asdf", "hello world", "ops@eaova.test", "javascript:alert(1)", "ftp://x.com"):
        try:
            normalize_company_website(raw)
        except ValueError:
            continue
        raise AssertionError(f"expected invalid website: {raw}")
