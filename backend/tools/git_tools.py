import subprocess
import os
from pathlib import Path

PORTFOLIO_DIR = os.getenv("PORTFOLIO_DIR", r"C:\Users\shish\Desktop\PORTFOLIO")


def _run_git(args: list[str], cwd: str) -> str:
    try:
        result = subprocess.run(
            ["git"] + args,
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=5,
        )
        return result.stdout.strip()
    except Exception as e:
        return f"git error: {e}"


def get_recent_commits(project_path: str | None = None, n: int = 5) -> list[dict]:
    path = project_path or PORTFOLIO_DIR
    if not os.path.exists(path):
        return []

    raw = _run_git(
        ["log", f"-{n}", "--pretty=format:%h|%s|%ar|%an"],
        cwd=path,
    )
    if not raw or "git error" in raw:
        return []

    commits = []
    for line in raw.split("\n"):
        parts = line.split("|", 3)
        if len(parts) == 4:
            commits.append({
                "hash": parts[0],
                "message": parts[1],
                "when": parts[2],
                "author": parts[3],
            })
    return commits


def get_git_status(project_path: str | None = None) -> str:
    path = project_path or PORTFOLIO_DIR
    return _run_git(["status", "--short"], cwd=path)


def list_projects() -> list[str]:
    """List directories in PORTFOLIO_DIR that are git repos."""
    try:
        base = Path(PORTFOLIO_DIR)
        return [
            d.name for d in base.iterdir()
            if d.is_dir() and (d / ".git").exists()
        ]
    except Exception:
        return []


def get_active_project_summary() -> dict:
    """Read Plan.md from current ORION project."""
    plan_path = Path(PORTFOLIO_DIR) / "ORION" / "Plan.md"
    if not plan_path.exists():
        return {"name": "ORION", "phase": "Phase 1", "next": ""}

    try:
        content = plan_path.read_text(encoding="utf-8")
        # Extract current session state
        lines = content.split("\n")
        phase_line = next((l for l in lines if "CURRENT" in l.upper() and "PHASE" in l.upper()), "")
        next_line = next((l for l in lines if "**Next up:**" in l or "Next:" in l), "")
        return {
            "name": "ORION",
            "phase": phase_line.strip("# ").strip() or "Active",
            "next": next_line.replace("**Next up:**", "").replace("Next:", "").strip(),
        }
    except Exception:
        return {"name": "ORION", "phase": "Active", "next": ""}
