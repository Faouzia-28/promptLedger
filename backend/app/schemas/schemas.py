"""Shared Pydantic request schemas for ingress hardening."""

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
