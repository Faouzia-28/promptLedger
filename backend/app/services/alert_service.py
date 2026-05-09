"""Alert delivery service.

Provides channel-aware alert dispatch for drift/regression/compliance events.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import AlertConfig, DriftEvent


logger = logging.getLogger(__name__)


class AlertService:
	"""Dispatch alerts for configured channels on an organization."""

	async def dispatch_drift_alerts(
		self,
		db: AsyncSession,
		org_id: uuid.UUID,
		drift_event: DriftEvent,
	) -> dict[str, int]:
		"""Send drift alerts to enabled channels for the given organization."""
		stmt = select(AlertConfig).where(
			(AlertConfig.org_id == org_id)
			& (AlertConfig.enabled.is_(True))
			& (AlertConfig.alert_type == "drift")
		)
		result = await db.execute(stmt)
		configs = result.scalars().all()

		summary = {"matched": len(configs), "sent": 0, "failed": 0}
		if not configs:
			return summary

		payload = self._build_drift_payload(drift_event)
		for config in configs:
			try:
				sent = await self._dispatch_channel(config, payload)
				if sent:
					summary["sent"] += 1
				else:
					summary["failed"] += 1
			except Exception as exc:  # pragma: no cover - defensive path
				logger.warning("Alert dispatch failed for config %s: %s", config.id, exc)
				summary["failed"] += 1

		return summary

	def _build_drift_payload(self, event: DriftEvent) -> dict[str, Any]:
		return {
			"event_type": "drift_detected",
			"event": {
				"id": str(event.id),
				"unit_id": str(event.unit_id),
				"version_id": str(event.version_id) if event.version_id else None,
				"severity": event.severity,
				"drift_score": event.drift_score,
				"created_at": event.created_at.isoformat() if event.created_at else None,
				"details": event.details or {},
			},
		}

	async def _dispatch_channel(self, config: AlertConfig, payload: dict[str, Any]) -> bool:
		channel = (config.channel or "").strip().lower()
		channel_cfg = config.config or {}

		if channel == "slack":
			webhook_url = channel_cfg.get("webhook_url")
			if not webhook_url:
				logger.info("Slack alert config %s missing webhook_url", config.id)
				return False
			return await self._send_slack(webhook_url, payload)

		if channel == "webhook":
			webhook_url = channel_cfg.get("url")
			if not webhook_url:
				logger.info("Webhook alert config %s missing url", config.id)
				return False
			headers = channel_cfg.get("headers") if isinstance(channel_cfg.get("headers"), dict) else {}
			return await self._send_webhook(webhook_url, payload, headers)

		if channel == "email":
			to_email = channel_cfg.get("to_email")
			if not to_email:
				logger.info("Email alert config %s missing to_email", config.id)
				return False
			return await self._send_email(to_email, payload)

		logger.info("Unsupported alert channel '%s' for config %s", channel, config.id)
		return False

	async def _send_slack(self, webhook_url: str, payload: dict[str, Any]) -> bool:
		text = (
			"PromptLedger drift alert: "
			f"severity={payload['event']['severity']} score={payload['event']['drift_score']} "
			f"unit={payload['event']['unit_id']}"
		)
		body = {
			"text": text,
			"blocks": [
				{"type": "section", "text": {"type": "mrkdwn", "text": "*PromptLedger Drift Alert*"}},
				{
					"type": "section",
					"fields": [
						{"type": "mrkdwn", "text": f"*Severity*\n{payload['event']['severity']}"},
						{"type": "mrkdwn", "text": f"*Drift Score*\n{payload['event']['drift_score']}"},
					],
				},
			],
		}

		async with httpx.AsyncClient(timeout=10) as client:
			response = await client.post(webhook_url, json=body)
			return response.status_code < 400

	async def _send_webhook(self, webhook_url: str, payload: dict[str, Any], headers: dict[str, str]) -> bool:
		async with httpx.AsyncClient(timeout=10) as client:
			response = await client.post(webhook_url, json=payload, headers=headers)
			return response.status_code < 400

	async def _send_email(self, to_email: str, payload: dict[str, Any]) -> bool:
		if not settings.RESEND_API_KEY:
			logger.info("RESEND_API_KEY missing; skipping email alert dispatch")
			return False

		subject = f"PromptLedger Drift Alert ({payload['event']['severity']})"
		html = (
			"<h3>PromptLedger Drift Alert</h3>"
			f"<p><b>Severity:</b> {payload['event']['severity']}</p>"
			f"<p><b>Drift score:</b> {payload['event']['drift_score']}</p>"
			f"<p><b>Unit ID:</b> {payload['event']['unit_id']}</p>"
		)
		body = {
			"from": "PromptLedger <alerts@promptledger.dev>",
			"to": [to_email],
			"subject": subject,
			"html": html,
		}

		async with httpx.AsyncClient(timeout=10) as client:
			response = await client.post(
				"https://api.resend.com/emails",
				headers={
					"Authorization": f"Bearer {settings.RESEND_API_KEY}",
					"Content-Type": "application/json",
				},
				json=body,
			)
			return response.status_code < 400


alert_service = AlertService()
