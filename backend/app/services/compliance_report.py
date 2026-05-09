"""Compliance report generation helpers."""

from __future__ import annotations

import io
import json
import uuid
from datetime import datetime
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.models.models import AuditLog, DriftEvent


class ComplianceReportService:
	"""Build export payloads and files for compliance endpoints."""

	def build_export_payload(
		self,
		org_id: uuid.UUID,
		audit_entries: list[AuditLog],
		drift_events: list[DriftEvent],
		start_date: datetime | None = None,
		end_date: datetime | None = None,
	) -> dict[str, Any]:
		return {
			"organization_id": str(org_id),
			"generated_at": datetime.utcnow().isoformat(),
			"start_date": start_date.isoformat() if start_date else None,
			"end_date": end_date.isoformat() if end_date else None,
			"audit_log": [self.serialize_audit_entry(entry) for entry in audit_entries],
			"drift_events": [self.serialize_drift_event(event) for event in drift_events],
		}

	def serialize_audit_entry(self, entry: AuditLog) -> dict[str, Any]:
		return {
			"id": str(entry.id),
			"action": entry.action,
			"actor_id": str(entry.actor_id) if entry.actor_id else None,
			"resource_type": entry.resource_type,
			"resource_id": entry.resource_id,
			"metadata": entry.metadata_ or {},
			"created_at": entry.created_at.isoformat() if entry.created_at else None,
		}

	def serialize_drift_event(self, event: DriftEvent) -> dict[str, Any]:
		return {
			"id": str(event.id),
			"unit_id": str(event.unit_id),
			"version_id": str(event.version_id) if event.version_id else None,
			"severity": event.severity,
			"drift_score": event.drift_score,
			"resolved": event.resolved,
			"created_at": event.created_at.isoformat() if event.created_at else None,
		}

	def to_json_bytes(self, payload: dict[str, Any]) -> bytes:
		return json.dumps(payload, indent=2, sort_keys=False).encode("utf-8")

	def to_ndjson_bytes(self, payload: dict[str, Any]) -> bytes:
		rows: list[dict[str, Any]] = []
		for item in payload.get("audit_log", []):
			rows.append({"record_type": "audit_log", **item})
		for item in payload.get("drift_events", []):
			rows.append({"record_type": "drift_event", **item})
		return "\n".join(json.dumps(row) for row in rows).encode("utf-8")

	def generate_pdf(self, report: dict[str, Any]) -> bytes:
		"""Generate a compact PDF report for compliance snapshots."""
		buffer = io.BytesIO()
		pdf = canvas.Canvas(buffer, pagesize=A4)
		width, height = A4
		y = height - 50

		def write_line(text: str, line_gap: int = 16) -> None:
			nonlocal y
			if y < 50:
				pdf.showPage()
				y = height - 50
			pdf.drawString(50, y, text)
			y -= line_gap

		pdf.setTitle("PromptLedger Compliance Report")
		pdf.setFont("Helvetica-Bold", 14)
		write_line("PromptLedger Compliance Report", 22)

		pdf.setFont("Helvetica", 10)
		write_line(f"Organization: {report.get('organization_id', 'unknown')}")
		write_line(f"Generated At: {report.get('generated_at', datetime.utcnow().isoformat())}")
		write_line("", 8)

		audit_count = len(report.get("audit_log", []))
		drift_count = len(report.get("drift_events", []))
		write_line(f"Audit Entries: {audit_count}")
		write_line(f"Drift Events: {drift_count}")
		write_line("", 12)

		pdf.setFont("Helvetica-Bold", 11)
		write_line("Recent Drift Events", 18)
		pdf.setFont("Helvetica", 10)

		for event in report.get("drift_events", [])[:10]:
			write_line(
				f"- {event.get('created_at', 'n/a')} | severity={event.get('severity', 'n/a')} "
				f"score={event.get('drift_score', 'n/a')} unit={event.get('unit_id', 'n/a')}"
			)

		pdf.save()
		buffer.seek(0)
		return buffer.read()


compliance_report_service = ComplianceReportService()
