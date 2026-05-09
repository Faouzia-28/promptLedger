"""Behavioral fingerprint service - computes and stores behavioral fingerprints."""

import asyncio
import logging
from typing import Optional
from uuid import UUID
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import BehaviorVersion, EvalRun, BehaviorUnit
from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


class FingerprintService:
    """Service for computing and storing behavioral fingerprints."""
    
    async def compute_and_store(self, version_id: str, eval_set_id: Optional[str] = None) -> dict:
        """
        Compute behavioral fingerprint for a version and store it.
        
        Args:
            version_id: UUID of the behavior version
            eval_set_id: Optional UUID of specific eval set to use
            
        Returns:
            dict with fingerprint data and metadata
        """
        try:
            async with AsyncSessionLocal() as db:
                # Get the version
                stmt = select(BehaviorVersion).where(BehaviorVersion.id == UUID(version_id))
                result = await db.execute(stmt)
                version = result.scalars().first()
                
                if not version:
                    logger.warning(f"Version {version_id} not found")
                    return {"error": "Version not found"}
                
                # Get eval runs for this version (or filter by eval_set_id if provided)
                eval_query = select(EvalRun).where(EvalRun.version_id == UUID(version_id))
                if eval_set_id:
                    eval_query = eval_query.where(EvalRun.eval_set_id == UUID(eval_set_id))
                
                result = await db.execute(eval_query)
                eval_runs = result.scalars().all()
                
                if not eval_runs:
                    logger.warning(f"No eval runs found for version {version_id}")
                    return {"error": "No eval runs found"}
                
                # Compute fingerprint from evaluation scores
                fingerprint_vectors = []
                for eval_run in eval_runs:
                    # Create simple embedding from eval results and score
                    # Format: [score, num_results, timestamp_component, ...]
                    vector = [
                        float(eval_run.score) if eval_run.score is not None else 0.0,
                        float(len(eval_run.results) if isinstance(eval_run.results, (list, dict)) else 1),
                        float(hash(str(eval_run.created_at)) % 1000) / 1000.0,  # normalize hash
                    ]
                    fingerprint_vectors.append(vector)
                
                if not fingerprint_vectors:
                    logger.warning("No fingerprint vectors computed")
                    return {"error": "No fingerprint vectors computed"}
                
                # Compute centroid (mean of all vectors)
                fingerprint_array = np.array(fingerprint_vectors)
                centroid = np.mean(fingerprint_array, axis=0).tolist()
                
                # Store fingerprint
                version.behavioral_fingerprint = centroid
                version.fingerprint_meta = {
                    "eval_set_id": str(eval_set_id) if eval_set_id else None,
                    "num_evals": len(eval_runs),
                    "num_vectors": len(fingerprint_vectors),
                    "dimensions": len(centroid),
                }
                
                await db.commit()
                logger.info(f"Fingerprint computed and stored for version {version_id}")
                
                return {
                    "success": True,
                    "version_id": str(version.id),
                    "fingerprint_dimensions": len(centroid),
                    "num_evals_used": len(eval_runs),
                }
        except Exception as e:
            logger.error(f"Error computing fingerprint: {e}", exc_info=True)
            return {"error": str(e)}
    
    async def get_fingerprint(self, version_id: str) -> Optional[list]:
        """Retrieve stored fingerprint for a version."""
        try:
            async with AsyncSessionLocal() as db:
                stmt = select(BehaviorVersion).where(BehaviorVersion.id == UUID(version_id))
                result = await db.execute(stmt)
                version = result.scalars().first()
                
                if version:
                    return version.behavioral_fingerprint
                return None
        except Exception as e:
            logger.error(f"Error retrieving fingerprint: {e}")
            return None


# Create singleton instance
fingerprint_service = FingerprintService()
