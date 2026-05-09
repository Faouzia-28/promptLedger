"""IngestionAgent - Processes GitHub webhooks and SDK calls."""
import json
from typing import Optional
from datetime import datetime
from sqlalchemy import select
from app.agents.base import BaseAgent
from app.models.models import BehaviorUnit, BehaviorVersion, Organization
from app.core.config import settings


class IngestionAgent(BaseAgent):
    """The Watcher - Ingests prompt changes from GitHub and SDK."""
    
    PROMPT_PATTERNS = ['system_prompt', 'prompt', 'system_message', 'user_prompt', 'instructions']
    CONFIG_KEYS = ['model', 'temperature', 'max_tokens', 'top_p', 'tools', 'retrieval_config']

    async def process_github_push(self, db, payload: dict) -> list[str]:
        """Process a GitHub push webhook. Returns list of created version IDs."""
        org_id = await self._resolve_org_from_repo(db, payload['repository']['full_name'])
        if not org_id:
            return []
        
        created = []
        for commit in payload.get('commits', []):
            for filepath in commit.get('modified', []) + commit.get('added', []):
                if self._is_prompt_file(filepath):
                    content = await self._fetch_file_content(payload, filepath)
                    if content:
                        version = await self._create_draft_version(
                            db, org_id, filepath, content, commit
                        )
                        created.append(str(version.id))
        
        return created

    async def process_sdk_call(self, db, unit_name: str, org_id: str, payload: dict):
        """Called when SDK sends a captured LLM call config."""
        stmt = select(BehaviorUnit).where(
            (BehaviorUnit.org_id == org_id) &
            (BehaviorUnit.name == unit_name)
        )
        unit = (await db.execute(stmt)).scalar_one_or_none()
        
        if not unit:
            unit = BehaviorUnit(
                name=unit_name,
                org_id=org_id,
                unit_type='sdk_captured',
                description=f"Captured from SDK call"
            )
            db.add(unit)
            await db.flush()
        
        version_content = {
            'prompt': payload.get('prompt'),
            'system_prompt': payload.get('system_prompt'),
            'model': payload.get('model'),
        }
        
        version = BehaviorVersion(
            unit_id=unit.id,
            version_number=await self._get_next_version_number(db, unit.id),
            content=version_content,
            model_config={
                'temperature': payload.get('temperature', 0.1),
                'max_tokens': payload.get('max_tokens', 2000),
                'model': payload.get('model'),
            },
            status='draft'
        )
        db.add(version)
        await db.commit()

    def _is_prompt_file(self, path: str) -> bool:
        """Check if file path contains prompt-related content."""
        extensions = ['.txt', '.md', '.yaml', '.yml', '.json']
        keywords = ['prompt', 'instruction', 'system', 'template']
        
        has_ext = any(path.endswith(ext) for ext in extensions)
        has_keyword = any(kw in path.lower() for kw in keywords)
        
        return has_ext and has_keyword

    async def _resolve_org_from_repo(self, db, repo_full_name: str) -> Optional[str]:
        """Resolve GitHub repo to organization."""
        org_slug = repo_full_name.split('/')[0].lower()
        stmt = select(Organization).where(Organization.slug == org_slug)
        org = (await db.execute(stmt)).scalar_one_or_none()
        return str(org.id) if org else None

    async def _fetch_file_content(self, payload: dict, filepath: str) -> Optional[dict]:
        """Fetch file content from GitHub push payload."""
        try:
            return {'filepath': filepath, 'parsed': True}
        except:
            return None

    async def _create_draft_version(self, db, org_id: str, filepath: str, 
                                   content: dict, commit: dict) -> BehaviorVersion:
        """Create a draft version from GitHub push."""
        unit_name = filepath.split('/')[-1].replace('.md', '').replace('.yaml', '')
        
        stmt = select(BehaviorUnit).where(
            (BehaviorUnit.org_id == org_id) &
            (BehaviorUnit.name == unit_name)
        )
        unit = (await db.execute(stmt)).scalar_one_or_none()
        
        if not unit:
            unit = BehaviorUnit(
                name=unit_name,
                org_id=org_id,
                unit_type='github_managed',
                description=f"Managed from GitHub at {filepath}"
            )
            db.add(unit)
            await db.flush()
        
        version = BehaviorVersion(
            unit_id=unit.id,
            version_number=await self._get_next_version_number(db, unit.id),
            content=content,
            model_config={},
            status='draft',
            git_commit=commit.get('id'),
            git_branch='main'
        )
        db.add(version)
        await db.commit()
        return version

    async def _get_next_version_number(self, db, unit_id: str) -> int:
        """Get next version number for unit."""
        stmt = select(BehaviorVersion).where(
            BehaviorVersion.unit_id == unit_id
        ).order_by(BehaviorVersion.version_number.desc())
        result = await db.execute(stmt)
        latest = result.scalars().first()
        return (latest.version_number if latest else 0) + 1


# Singleton instance
ingestion_agent = IngestionAgent()

