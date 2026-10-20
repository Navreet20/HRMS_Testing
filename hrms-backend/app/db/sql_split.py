"""Split SQL scripts into executable statements (dollar-quotes + literals)."""

from __future__ import annotations


def split_sql(sql: str) -> list[str]:
    """Split SQL into statements, respecting dollar-quotes and string literals."""
    statements: list[str] = []
    buf: list[str] = []
    i = 0
    n = len(sql)

    def flush() -> None:
        stmt = "".join(buf).strip().rstrip(";").strip()
        buf.clear()
        if stmt:
            statements.append(stmt)

    while i < n:
        ch = sql[i]

        if ch == "-" and i + 1 < n and sql[i + 1] == "-":
            while i < n and sql[i] != "\n":
                i += 1
            continue

        if ch == "$":
            j = i + 1
            while j < n and sql[j] != "$":
                j += 1
            if j >= n:
                buf.append(ch)
                i += 1
                continue
            delimiter = sql[i : j + 1]
            buf.append(delimiter)
            i = j + 1
            while i < n:
                if sql.startswith(delimiter, i):
                    buf.append(delimiter)
                    i += len(delimiter)
                    break
                buf.append(sql[i])
                i += 1
            continue

        if ch == "'":
            buf.append(ch)
            i += 1
            while i < n:
                buf.append(sql[i])
                if sql[i] == "'":
                    if i + 1 < n and sql[i + 1] == "'":
                        buf.append(sql[i + 1])
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            continue

        if ch == ";":
            flush()
            i += 1
            continue

        buf.append(ch)
        i += 1

    flush()
    return statements
