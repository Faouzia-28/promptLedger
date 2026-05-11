"""Shared Pydantic request schemas for ingress hardening."""

from datetime import datetime
from typing import Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class GitHubWebhookPayload(BaseModel):
	"""Validated GitHub webhook payload surface used by the demo."""

	model_config = ConfigDict(extra="allow")

	action: Optional[str] = Field(default="push", max_length=64)
	ref: Optional[str] = Field(default=None, max_length=256)
	before: Optional[str] = Field(default=None, max_length=128)
	after: Optional[str] = Field(default=None, max_length=128)
	repository: Optional[dict] = None
	organization: Optional[dict] = None
	head_commit: Optional[dict] = None


class GitHubIntegrationCreateRequest(BaseModel):
	"""Create a GitHub repository integration."""

	repo_full_name: str = Field(min_length=1, max_length=255)
	default_branch: str = Field(default="main", max_length=128)
	unit_id: Optional[str] = Field(default=None, max_length=64)
	tracked_paths: list[str] = Field(default_factory=list)
	enabled: bool = True


class GitHubIntegrationResponse(BaseModel):
	"""GitHub integration response."""

	id: str
	org_id: str
	unit_id: Optional[str] = None
	repo_full_name: str
	default_branch: str
	tracked_paths: list[str]
	enabled: bool
	created_at: datetime


class GitHubSyncRequest(BaseModel):
	"""Sync a prompt version from GitHub-sourced content."""

	unit_name: str = Field(min_length=1, max_length=200)
	repo_full_name: Optional[str] = Field(default=None, max_length=255)
	file_path: str = Field(min_length=1, max_length=512)
	content: dict
	github_token: Optional[str] = Field(default=None, max_length=8_192)
	github_ref: Optional[str] = Field(default=None, max_length=128)
	commit_sha: Optional[str] = Field(default=None, max_length=128)
	branch: Optional[str] = Field(default=None, max_length=128)
	model_config: Optional[dict] = None
	eval_set_id: Optional[str] = Field(default=None, max_length=64)
	trigger_eval: bool = True


class GitHubSyncResponse(BaseModel):
	"""Response for GitHub prompt sync requests."""

	integration_id: str
	unit_id: str
	version_id: str
	eval_run_id: Optional[str] = None
	status: str
	message: str


class SDKWebhookPayload(BaseModel):
	"""Validated SDK webhook payload."""

	model_config = ConfigDict(extra="forbid")

	org_id: str = Field(min_length=1, max_length=64)
	unit_name: str = Field(min_length=1, max_length=200)
	input_text: Optional[str] = Field(default=None, max_length=10_000)
	output_text: Optional[str] = Field(default=None, max_length=10_000)
	model: Optional[str] = Field(default=None, max_length=128)
	temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
	max_tokens: Optional[int] = Field(default=None, ge=1, le=32_768)
	idempotency_key: Optional[str] = Field(default=None, max_length=128)


class ProductionSampleRequest(BaseModel):
	"""Validated production sample ingestion payload."""

	model_config = ConfigDict(extra="forbid")

	unit_id: str = Field(min_length=1, max_length=64)
	input_text: str = Field(default="", max_length=10_000, validation_alias=AliasChoices("input_text", "input"))
	output_text: str = Field(min_length=1, max_length=10_000, validation_alias=AliasChoices("output_text", "output"))
	embedding: Optional[list[float]] = None
	idempotency_key: Optional[str] = Field(default=None, max_length=128)
