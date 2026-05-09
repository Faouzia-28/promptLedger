"""PromptLedger Python SDK."""

from __future__ import annotations

import threading
from typing import Any

import httpx


class PromptLedger:
	"""Thin API wrapper for PromptLedger backend endpoints."""

	def __init__(self, api_key: str, base_url: str = "http://localhost:8000"):
		self.api_key = api_key
		self.base_url = base_url.rstrip("/")

	@property
	def _headers(self) -> dict[str, str]:
		return {
			"Authorization": f"Bearer {self.api_key}",
			"Content-Type": "application/json",
		}

	def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
		url = f"{self.base_url}{path}"
		headers = kwargs.pop("headers", {})
		merged_headers = {**self._headers, **headers}
		with httpx.Client(timeout=30) as client:
			response = client.request(method, url, headers=merged_headers, **kwargs)
			response.raise_for_status()
			return response.json() if response.text else {}

	def track(
		self,
		unit_id: str,
		input_text: str,
		output_text: str,
		embedding: list[float] | None = None,
		fire_and_forget: bool = True,
	) -> None:
		"""Send a production sample for drift ingestion."""

		def _send() -> None:
			payload = {
				"unit_id": unit_id,
				"input_text": input_text,
				"output_text": output_text,
				"embedding": embedding,
			}
			self._request("POST", "/api/v1/drift/ingest/output", json=payload)

		if fire_and_forget:
			threading.Thread(target=_send, daemon=True).start()
			return
		_send()

	def list_units(self) -> list[dict[str, Any]]:
		return self._request("GET", "/api/v1/units")

	def create_unit(self, name: str, description: str = "", unit_type: str = "llm") -> dict[str, Any]:
		return self._request(
			"POST",
			"/api/v1/units",
			json={"name": name, "description": description, "unit_type": unit_type},
		)

	def create_version(
		self,
		unit_id: str,
		content: dict[str, Any],
		config: dict[str, Any] | None = None,
		git_branch: str | None = None,
		git_commit: str | None = None,
	) -> dict[str, Any]:
		return self._request(
			"POST",
			f"/api/v1/units/{unit_id}/versions",
			json={
				"content": content,
				"config": config or {},
				"git_branch": git_branch,
				"git_commit": git_commit,
			},
		)

	def semantic_diff(
		self,
		unit_id: str,
		left_version_id: str,
		right_version_id: str,
		eval_set_id: str | None = None,
	) -> dict[str, Any]:
		params = {"left_version_id": left_version_id, "right_version_id": right_version_id}
		if eval_set_id:
			params["eval_set_id"] = eval_set_id
		return self._request("GET", f"/api/v1/units/{unit_id}/diff", params=params)

	def create_eval_set(self, unit_id: str, name: str, cases: list[dict[str, Any]]) -> dict[str, Any]:
		return self._request(
			"POST",
			"/api/v1/evals/sets",
			json={"unit_id": unit_id, "name": name, "cases": cases},
		)

	def run_eval(self, version_id: str, eval_set_id: str) -> dict[str, Any]:
		return self._request(
			"POST",
			"/api/v1/evals/runs",
			params={"version_id": version_id, "eval_set_id": eval_set_id},
		)

	def get_eval_run(self, run_id: str) -> dict[str, Any]:
		return self._request("GET", f"/api/v1/evals/runs/{run_id}")

	def wrap_openai(self, openai_client: Any, unit_id: str = "") -> Any:
		"""Wrap OpenAI client chat completions to auto-track responses."""
		original = openai_client.chat.completions.create
		sdk = self

		def patched(*args: Any, **kwargs: Any) -> Any:
			result = original(*args, **kwargs)
			messages = kwargs.get("messages", [])
			prompt = str(messages)
			output = ""
			if getattr(result, "choices", None):
				output = getattr(result.choices[0].message, "content", "") or ""
			if unit_id and output:
				sdk.track(unit_id=unit_id, input_text=prompt, output_text=output, fire_and_forget=True)
			return result

		openai_client.chat.completions.create = patched
		return openai_client
