"""DriftAgent - Monitors for behavioral drift using embeddings."""
import numpy as np
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy import select
from app.agents.base import BaseAgent
from app.models.models import (
    BehaviorVersion, DriftEvent, ProductionSample, BehaviorUnit
)
from app.services.embed_service import embedder


class DriftAgent(BaseAgent):
    """The Sentinel - Detects behavioral drift in production."""
    
    DRIFT_THRESHOLD = 0.15
    REFUSAL_DELTA_THRESHOLD = 0.1

    async def store_production_sample(self, db, unit_id: str, input_text: str, output_text: str):
        """Store a production sample with embedding."""
        embedding = embedder.embed(output_text)
        sample = ProductionSample(
            unit_id=unit_id,
            input_text=input_text,
            output_text=output_text,
            embedding=embedding
        )
        db.add(sample)
        await db.commit()

    async def check_drift_for_unit(self, db, unit_id: str):
        """Check for drift for a specific unit."""
        stmt = select(BehaviorVersion).where(
            (BehaviorVersion.unit_id == unit_id) &
            (BehaviorVersion.status == 'deployed')
        ).order_by(BehaviorVersion.created_at.desc())
        version = (await db.execute(stmt)).scalars().first()
        
        if not version or not version.behavioral_fingerprint:
            return

        baseline = np.array(version.behavioral_fingerprint)
        
        cutoff = datetime.utcnow() - timedelta(hours=1)
        stmt = select(ProductionSample).where(
            (ProductionSample.unit_id == unit_id) &
            (ProductionSample.created_at >= cutoff)
        ).limit(50)
        samples = (await db.execute(stmt)).scalars().all()
        
        if len(samples) < 5:
            return

        recent_embeddings = []
        for s in samples:
            if s.embedding:
                if isinstance(s.embedding, list):
                    recent_embeddings.append(np.array(s.embedding))
                else:
                    try:
                        import json
                        emb = json.loads(s.embedding) if isinstance(s.embedding, str) else s.embedding
                        recent_embeddings.append(np.array(emb))
                    except:
                        continue

        if len(recent_embeddings) < 5:
            return

        recent_centroid = np.mean(recent_embeddings, axis=0)
        drift_score = embedder.cosine_distance(baseline.tolist(), recent_centroid.tolist())

        if drift_score > self.DRIFT_THRESHOLD:
            severity = self._severity_from_score(drift_score)
            
            stmt = select(BehaviorUnit).where(BehaviorUnit.id == unit_id)
            unit = (await db.execute(stmt)).scalar_one_or_none()
            org_id = unit.org_id if unit else None
            
            event = DriftEvent(
                unit_id=unit_id,
                version_id=version.id,
                severity=severity,
                drift_score=drift_score,
                details={'samples_analyzed': len(recent_embeddings)}
            )
            db.add(event)
            await db.commit()

    def _severity_from_score(self, score: float) -> str:
        """Determine severity level from drift score."""
        if score < 0.2:
            return 'low'
        elif score < 0.35:
            return 'medium'
        elif score < 0.5:
            return 'high'
        else:
            return 'critical'


# Singleton instance
drift_agent = DriftAgent()

