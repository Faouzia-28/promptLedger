"""Runtime template store for scoring templates.

Provides a simple JSON-backed store that overrides config settings at runtime.
"""
from pathlib import Path
import json
from app.core.config import settings

DEFAULT_PATH = Path(__file__).resolve().parents[2] / "config" / "score_templates.json"


def _ensure_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def get_templates() -> dict:
    # If file exists, load it; else fall back to settings
    try:
        if DEFAULT_PATH.exists():
            data = json.loads(DEFAULT_PATH.read_text(encoding="utf-8"))
            return data
    except Exception:
        pass
    return {
        "system_prompt": getattr(settings, "EVAL_SCORE_SYSTEM_PROMPT", ""),
        "user_template": getattr(settings, "EVAL_SCORE_USER_TEMPLATE", ""),
    }


def set_templates(system_prompt: str, user_template: str) -> None:
    _ensure_dir(DEFAULT_PATH)
    data = {"system_prompt": system_prompt, "user_template": user_template}
    DEFAULT_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
