"""ComplianceAgent - Audit logging and EU AI Act reporting."""
import json
import hmac
import hashlib
from datetime import datetime, timedelta
from sqlalchemy import select
from app.agents.base import BaseAgent
from app.models.models import AuditLog, BehaviorUnit, BehaviorVersion, DriftEvent
from app.services.llm_service import llm
from app.core.config import settings


class ComplianceAgent(BaseAgent):
    """The Notary - Maintains signed audit logs and compliance reports."""

    def sign_entry(self, entry: dict) -> str:
        """Create HMAC-SHA256 signature for audit entry."""
        payload = json.dumps(entry, sort_keys=True, default=str)
        return hmac.new(
            settings.SECRET_KEY.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

    async def write_audit_log(self, db, action: str, actor_id: str, org_id: str,
                              resource_type: str, resource_id: str, metadata: dict = None):
        """Write signed audit log entry."""
        if metadata is None:
            metadata = {}

        entry = {
            'action': action,
            'actor_id': str(actor_id),
            'org_id': str(org_id),
            'resource_type': resource_type,
            'resource_id': str(resource_id),
            'metadata': metadata,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        signed = self.sign_entry(entry)
        log = AuditLog(
            org_id=org_id,
            action=action,
            actor_id=actor_id,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_=metadata,
            signed_hash=signed
        )
        db.add(log)
        await db.commit()

    async def generate_eu_ai_act_report(self, db, org_id: str, from_date: datetime,
                                        to_date: datetime) -> dict:
        """Generate EU AI Act Article 13 transparency report."""
        stmt = select(BehaviorUnit).where(BehaviorUnit.org_id == org_id)
        units = (await db.execute(stmt)).scalars().all()

        stmt = select(BehaviorVersion).where(
            (BehaviorVersion.created_at >= from_date) &
            (BehaviorVersion.created_at <= to_date)
        )
        all_versions = (await db.execute(stmt)).scalars().all()

        stmt = select(DriftEvent).where(
            (DriftEvent.created_at >= from_date) &
            (DriftEvent.created_at <= to_date)
        )
        all_drift = (await db.execute(stmt)).scalars().all()

        stmt = select(AuditLog).where(
            (AuditLog.org_id == org_id) &
            (AuditLog.created_at >= from_date) &
            (AuditLog.created_at <= to_date)
        )
        audit_entries = (await db.execute(stmt)).scalars().all()

        narrative = await self._generate_eu_ai_act_narrative(
            len(units), len(all_versions), len(all_drift)
        )

        return {
            'report_type': 'EU_AI_Act_Article_13_Transparency_Report',
            'generated_at': datetime.utcnow().isoformat(),
            'reporting_period': {
                'from': from_date.isoformat(),
                'to': to_date.isoformat()
            },
            'executive_summary': narrative,
            'ai_systems_monitored': len(units),
            'versions_deployed': len(all_versions),
            'drift_incidents': len(all_drift),
            'audit_log_entries': len(audit_entries),
            'data_governance_statement': 'Production outputs sampled per GDPR Art. 5 data minimisation principle.'
        }

    async def _generate_eu_ai_act_narrative(self, units_count: int, versions_count: int,
                                           drift_count: int) -> str:
        """Generate formal compliance narrative."""
        prompt = f"""Write a 3-sentence EU AI Act Article 13 transparency statement for an AI governance system.
Period coverage: ongoing. AI Systems monitored: {units_count}. Versions deployed: {versions_count}. Drift incidents: {drift_count}.
Be formal, compliant, and specific. No markdown or formatting."""

        try:
            narrative = await llm.chat(
                [{'role': 'user', 'content': prompt}],
                max_tokens=300
            )
            return narrative
        except:
            return "Continuous monitoring of AI systems for behavioral drift and performance degradation."


# Singleton instance
compliance_agent = ComplianceAgent()

