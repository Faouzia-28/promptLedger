"""RootCauseAgent - Investigates drift incidents."""
import json
from datetime import datetime, timedelta
from sqlalchemy import select
from app.agents.base import BaseAgent
from app.models.models import DriftEvent, BehaviorUnit, BehaviorVersion, EvalRun
from app.services.llm_service import llm


class RootCauseAgent(BaseAgent):
    """The Detective - Analyzes root causes of drift events."""

    async def investigate(self, db, drift_event_id: str) -> dict:
        """Generate root cause analysis for a drift event."""
        stmt = select(DriftEvent).where(DriftEvent.id == drift_event_id)
        event = (await db.execute(stmt)).scalar_one_or_none()
        if not event:
            return {'error': 'Event not found'}

        stmt = select(BehaviorUnit).where(BehaviorUnit.id == event.unit_id)
        unit = (await db.execute(stmt)).scalar_one_or_none()

        cutoff = datetime.utcnow() - timedelta(hours=24)
        stmt = select(BehaviorVersion).where(
            (BehaviorVersion.unit_id == event.unit_id) &
            (BehaviorVersion.created_at >= cutoff)
        ).order_by(BehaviorVersion.created_at.desc())
        recent_deploys = (await db.execute(stmt)).scalars().all()

        cutoff = datetime.utcnow() - timedelta(hours=48)
        stmt = select(EvalRun).where(
            (EvalRun.status == 'failed') &
            (EvalRun.created_at >= cutoff)
        ).order_by(EvalRun.created_at.desc())
        recent_failed_evals = (await db.execute(stmt)).scalars().all()

        context = {
            'drift_event': {
                'severity': event.severity,
                'drift_score': float(event.drift_score),
                'detected_at': event.created_at.isoformat() if event.created_at else '',
                'details': event.details or {}
            },
            'recent_deployments': [
                {
                    'version': v.version_number,
                    'at': v.created_at.isoformat() if v.created_at else '',
                    'status': v.status
                }
                for v in recent_deploys[:5]
            ],
            'recent_failed_evals': len(recent_failed_evals),
            'unit_type': unit.unit_type if unit else 'unknown'
        }

        prompt = f"""You are an AI reliability engineer analyzing a behavioral drift incident.
Context: {json.dumps(context, indent=2)}

Generate a root cause analysis as JSON with these exact keys:
{{
  "most_likely_cause": "one of: prompt_change, model_provider_update, data_distribution_shift, known_degradation, unknown",
  "confidence": 0.0,
  "timeline": ["list of relevant events in order"],
  "affected_segments": "description of who is affected",
  "recommended_action": "specific actionable recommendation",
  "resolution_steps": ["step 1", "step 2", "step 3"]
}}
Return ONLY the JSON, no markdown."""

        try:
            result = await llm.chat([{'role': 'user', 'content': prompt}], max_tokens=800)
            report = self._parse_json(result, default={
                'most_likely_cause': 'unknown',
                'confidence': 0.0,
                'timeline': [],
                'affected_segments': 'Unknown',
                'recommended_action': 'Manual investigation required',
                'resolution_steps': []
            })
        except Exception as e:
            report = {
                'most_likely_cause': 'unknown',
                'confidence': 0.0,
                'error': str(e),
                'recommended_action': 'Manual investigation required'
            }

        event.root_cause = report
        await db.commit()
        return report


# Singleton instance
root_cause_agent = RootCauseAgent()

