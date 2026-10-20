"""Start the HRMS API dev server:  uv run main.py

Runs scripts/run_dev.py (auto-reload, clean Ctrl+C). Options pass through,
for example:  uv run main.py --port 5002   or   uv run main.py --no-reload
"""

import runpy
from pathlib import Path

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).parent / "scripts" / "run_dev.py"), run_name="__main__")
