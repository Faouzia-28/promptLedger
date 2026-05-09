"""PromptLedger CLI entrypoint."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import click
import httpx
from rich.console import Console
from rich.table import Table

from promptledger.decorators import CONFIG_PATH, load_config, require_config, save_config
from promptledger.sdk import PromptLedger


console = Console()


@click.group()
@click.option("--config", "config_path", default=str(CONFIG_PATH), show_default=True)
@click.pass_context
def main(ctx: click.Context, config_path: str) -> None:
	"""PromptLedger CLI."""
	path = Path(config_path)
	config = load_config(path)
	ctx.ensure_object(dict)
	ctx.obj["config_path"] = path
	ctx.obj["config"] = config


def _client_from_ctx(ctx: click.Context) -> PromptLedger:
	config = ctx.obj["config"]
	return PromptLedger(api_key=config["api_key"], base_url=config["base_url"])


@main.command()
@click.option("--base-url", default="http://localhost:8000", show_default=True)
@click.option("--email", prompt=True)
@click.option("--password", prompt=True, hide_input=True)
@click.option("--org-name", default="PromptLedger Org", show_default=True)
@click.option("--register", is_flag=True, help="Register a new user instead of logging in.")
@click.pass_context
def init(
	ctx: click.Context,
	base_url: str,
	email: str,
	password: str,
	org_name: str,
	register: bool,
) -> None:
	"""Initialize CLI config by authenticating against backend."""
	endpoint = "/api/v1/auth/register" if register else "/api/v1/auth/login"
	payload: dict[str, Any] = {"email": email, "password": password}
	if register:
		payload["org_name"] = org_name

	with httpx.Client(timeout=30) as client:
		response = client.post(f"{base_url.rstrip('/')}{endpoint}", json=payload)
		if response.status_code >= 400:
			raise click.ClickException(
				f"Authentication failed ({response.status_code}): {response.text[:200]}"
			)
		data = response.json()

	config = {
		"base_url": base_url.rstrip("/"),
		"api_key": data["access_token"],
		"email": data["user"]["email"],
		"org_id": data["user"]["org_id"],
		"user_id": data["user"]["id"],
	}

	config_path: Path = ctx.obj["config_path"]
	save_config(config, config_path)
	console.print(f"Saved configuration to {config_path}")


@main.command()
@click.pass_context
@require_config
def status(ctx: click.Context) -> None:
	"""Show quick status for units and drift events."""
	client = _client_from_ctx(ctx)
	units = client.list_units()
	drift_events = client._request("GET", "/api/v1/drift/events")

	table = Table(title="PromptLedger Status")
	table.add_column("Metric")
	table.add_column("Value")
	table.add_row("Units", str(len(units)))
	table.add_row("Drift Events", str(len(drift_events)))
	table.add_row(
		"Open Drift Events",
		str(len([event for event in drift_events if not event.get("resolved", False)])),
	)
	console.print(table)


@main.command()
@click.option("--unit-id", required=True)
@click.option("--input-text", required=True)
@click.option("--output-text", required=True)
@click.pass_context
@require_config
def track(ctx: click.Context, unit_id: str, input_text: str, output_text: str) -> None:
	"""Track a production sample for drift ingestion."""
	client = _client_from_ctx(ctx)
	client.track(unit_id=unit_id, input_text=input_text, output_text=output_text, fire_and_forget=False)
	console.print("Sample ingested successfully")


@main.command()
@click.option("--unit-id", required=True)
@click.option("--left-version-id", required=True)
@click.option("--right-version-id", required=True)
@click.option("--eval-set-id", default=None)
@click.pass_context
@require_config
def diff(
	ctx: click.Context,
	unit_id: str,
	left_version_id: str,
	right_version_id: str,
	eval_set_id: str | None,
) -> None:
	"""Run semantic diff between two versions."""
	client = _client_from_ctx(ctx)
	data = client.semantic_diff(
		unit_id=unit_id,
		left_version_id=left_version_id,
		right_version_id=right_version_id,
		eval_set_id=eval_set_id,
	)
	console.print_json(json.dumps(data))


@main.command(name="eval")
@click.option("--version-id", required=True)
@click.option("--eval-set-id", required=True)
@click.option("--wait", "wait_for_completion", is_flag=True)
@click.option("--poll-seconds", default=3, show_default=True, type=int)
@click.pass_context
@require_config
def run_eval(
	ctx: click.Context,
	version_id: str,
	eval_set_id: str,
	wait_for_completion: bool,
	poll_seconds: int,
) -> None:
	"""Trigger an eval run and optionally wait for completion."""
	client = _client_from_ctx(ctx)
	created = client.run_eval(version_id=version_id, eval_set_id=eval_set_id)
	run_id = created["run_id"]
	console.print(f"Eval run queued: {run_id}")

	if not wait_for_completion:
		return

	terminal_statuses = {"passed", "failed", "degraded"}
	while True:
		run = client.get_eval_run(run_id)
		status_value = run.get("status", "unknown")
		console.print(f"status={status_value} score={run.get('score')}")
		if status_value in terminal_statuses:
			break
		time.sleep(max(1, poll_seconds))


if __name__ == "__main__":
	main()
