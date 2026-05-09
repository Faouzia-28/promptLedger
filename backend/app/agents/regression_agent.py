"""RegressionAgent - Runs evaluation sets and gates deployments."""
import json
from sqlalchemy import select
from app.agents.base import BaseAgent
from app.models.models import EvalRun, EvalSet, BehaviorVersion, AuditLog
from app.services.llm_service import llm


class RegressionAgent(BaseAgent):
    """The Gatekeeper - Evaluates prompts against test cases."""

    async def run_eval(self, db, eval_run_id: str):
        """Full eval run against an EvalSet. Updates EvalRun in DB as it runs."""
        import uuid
        run_uuid = uuid.UUID(eval_run_id) if isinstance(eval_run_id, str) else eval_run_id
        stmt = select(EvalRun).where(EvalRun.id == run_uuid)
        run = (await db.execute(stmt)).scalar_one_or_none()
        if not run:
            return 'failed', 0.0
        
        stmt = select(EvalSet).where(EvalSet.id == run.eval_set_id)
        eval_set = (await db.execute(stmt)).scalar_one_or_none()
        
        stmt = select(BehaviorVersion).where(BehaviorVersion.id == run.version_id)
        version = (await db.execute(stmt)).scalar_one_or_none()
        
        if not eval_set or not version:
            return 'failed', 0.0

        run.status = 'running'
        await db.commit()

        results = []
        cases = eval_set.cases if isinstance(eval_set.cases, list) else json.loads(eval_set.cases or '[]')
        
        for i, case in enumerate(cases):
            try:
                output = await self._run_version(version, case.get('input', ''))
                score = await self._score_output(case, output)
                results.append({
                    'case_index': i,
                    'input': case.get('input', ''),
                    'expected': case.get('expected_output', ''),
                    'actual': output,
                    'score': score.get('overall', 0.5),
                    'breakdown': score,
                    'passed': score.get('overall', 0.5) >= 0.7
                })
            except Exception as e:
                results.append({
                    'case_index': i,
                    'input': case.get('input', ''),
                    'error': str(e),
                    'score': 0.0,
                    'passed': False
                })

        total_score = sum(r.get('score', 0) for r in results) / len(results) if results else 0
        failed_count = sum(1 for r in results if not r.get('passed', False))
        fail_rate = failed_count / len(results) if results else 0

        if fail_rate == 0:
            status = 'passed'
        elif fail_rate <= 0.2:
            status = 'degraded'
        else:
            status = 'failed'

        run.status = status
        run.results = results
        run.score = total_score
        await db.commit()

        return status, total_score

    async def _score_output(self, case: dict, output: str) -> dict:
        """Score an output against evaluation criteria."""
        import json as json_module
        criteria = case.get('criteria', 'Is this response accurate, helpful, and relevant to the input?')
        prompt = f"""Score this AI response 0.0 to 1.0.
Input: {case.get('input', '')[:300]}
Expected behavior: {criteria}
Actual output: {output[:400]}
Return ONLY valid JSON: {{"overall": 0.85, "relevance": 0.9, "accuracy": 0.8, "reasoning": "brief explanation"}}"""
        
        try:
            result = await llm.chat([{'role': 'user', 'content': prompt}], temperature=0.3, max_tokens=500)
            parsed = self._parse_json(result, default=None)
            if parsed is None:
                print(f"[SCORE ERROR] Failed to parse LLM response: {result[:200]}")
                return {'overall': 0.5, 'relevance': 0.5, 'accuracy': 0.5, 'reasoning': 'parse_error'}
            return parsed
        except Exception as e:
            print(f"[SCORE ERROR] Exception during scoring: {str(e)}")
            return {'overall': 0.5, 'relevance': 0.5, 'accuracy': 0.5, 'reasoning': f'exception: {str(e)[:50]}'}


# Singleton instance
regression_agent = RegressionAgent()

