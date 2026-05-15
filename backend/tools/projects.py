"""Active project switcher. Stores selection in SQLite facts table."""
import os
from pathlib import Path
from tools.memory import write_fact, read_fact

PORTFOLIO_DIR = os.getenv("PORTFOLIO_DIR", r"C:\Users\shish\Desktop\PORTFOLIO")
_DEFAULT = "ORION"


def list_projects() -> list[str]:
    try:
        base = Path(PORTFOLIO_DIR)
        return sorted(
            d.name for d in base.iterdir()
            if d.is_dir() and (d / ".git").exists()
        )
    except Exception:
        return [_DEFAULT]


async def get_active() -> str:
    val = await read_fact("active_project")
    if val and (Path(PORTFOLIO_DIR) / val / ".git").exists():
        return val
    return _DEFAULT


async def set_active(name: str) -> bool:
    if not (Path(PORTFOLIO_DIR) / name / ".git").exists():
        return False
    await write_fact("active_project", name)
    return True


def project_path(name: str) -> str:
    return str(Path(PORTFOLIO_DIR) / name)
