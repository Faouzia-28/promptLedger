"""CLI utilities and decorators."""

from __future__ import annotations

from functools import wraps
from pathlib import Path
from typing import Any, Callable

import click
import yaml


CONFIG_DIR = Path.home() / ".promptledger"
CONFIG_PATH = CONFIG_DIR / "config.yml"


def load_config(path: Path = CONFIG_PATH) -> dict[str, Any]:
	if not path.exists():
		return {}
	data = yaml.safe_load(path.read_text(encoding="utf-8"))
	return data if isinstance(data, dict) else {}


def save_config(config: dict[str, Any], path: Path = CONFIG_PATH) -> Path:
	path.parent.mkdir(parents=True, exist_ok=True)
	path.write_text(yaml.safe_dump(config, sort_keys=False), encoding="utf-8")
	return path


def require_config(func: Callable[..., Any]) -> Callable[..., Any]:
	"""Ensure CLI context has loaded configuration before command execution."""

	@wraps(func)
	@click.pass_context
	def wrapper(ctx: click.Context, *args: Any, **kwargs: Any) -> Any:
		config = ctx.obj.get("config", {}) if isinstance(ctx.obj, dict) else {}
		if not config or not config.get("api_key"):
			raise click.ClickException(
				"PromptLedger is not initialized. Run 'promptledger init' first."
			)
		return ctx.invoke(func, *args, **kwargs)

	return wrapper
