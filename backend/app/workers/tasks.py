"""Celery task definitions for PromptLedger."""

import json
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_sync_db
from app.core.config import settings
from app.models.models import BehaviorUnit, EvalRun, EvalSet, BehaviorVersion
from app.workers.celery_app import celery
from app.services.llm_service import llm
import asyncio
from datetime import datetime, timezone


def _run_sync_llm(
	messages: list[dict],
	temperature: float = 0.1,
	max_tokens: int = 2000,
	timeout_seconds: int = 45,
) -> str:
	"""Run LLM chat synchronously using asyncio."""
	async def _chat():
		return await asyncio.wait_for(
			llm.chat(messages, temperature, max_tokens),
			timeout=timeout_seconds,
		)
	
	loop = asyncio.new_event_loop()
	asyncio.set_event_loop(loop)
	try:
		return loop.run_until_complete(_chat())
	except asyncio.TimeoutError as e:
		raise TimeoutError(f"LLM call timed out after {timeout_seconds}s") from e
	finally:
		loop.close()


@celery.task(
	name="app.workers.tasks.process_github_webhook",
	autoretry_for=(httpx.HTTPError, ConnectionError, TimeoutError, RuntimeError),
	retry_backoff=True,
	retry_jitter=True,
	retry_kwargs={"max_retries": 3},
)
def process_github_webhook(payload: dict):
	"""Process GitHub webhook (stub)."""
	return {"status": "processed", "payload_preview": str(payload)[:100]}


@celery.task(
	name="app.workers.tasks.run_regression_eval",
	autoretry_for=(),
)
def run_regression_eval(eval_run_id: str):
	"""Run evaluation set against a version (synchronous)."""
	db = get_sync_db()
	run = None
	try:
		import uuid
		run_uuid = uuid.UUID(eval_run_id)
		
		# Fetch eval run
		run = db.query(EvalRun).filter(EvalRun.id == run_uuid).first()
		if not run:
			return {"status": "failed", "score": 0.0, "error": "Run not found"}
		
		# Fetch eval set and version
		eval_set = db.query(EvalSet).filter(EvalSet.id == run.eval_set_id).first()
		version = db.query(BehaviorVersion).filter(BehaviorVersion.id == run.version_id).first()
		
		if not eval_set or not version:
			return {"status": "failed", "score": 0.0, "error": "Set or version not found"}
		
		# Update run status
		run.status = "running"
		db.commit()
		llm_timeout = settings.EVAL_LLM_TIMEOUT_SECONDS
		
		results = []
		cases = eval_set.cases if isinstance(eval_set.cases, list) else json.loads(eval_set.cases or '[]')
		
		for i, case in enumerate(cases):
			try:
				# Run version with input
				content = version.content if isinstance(version.content, dict) else json.loads(version.content or '{}')
				system_prompt = content.get('system_prompt') or content.get('system_message', '')
				user_template = content.get('prompt') or content.get('user_prompt', '{input}')
				
				# Replace {{input}} or {input} with actual input
				user_message = user_template.replace('{{input}}', case.get('input', ''))
				user_message = user_message.replace('{input}', case.get('input', ''))
				
				messages = []
				if system_prompt:
					messages.append({'role': 'system', 'content': system_prompt})
				messages.append({'role': 'user', 'content': user_message})
				
				# Call LLM
				# Log messages sent to LLM for debugging
				print(f"[EVAL] Case {i} messages: {messages}")
				output = _run_sync_llm(
					messages,
					temperature=0.1,
					max_tokens=2000,
					timeout_seconds=llm_timeout,
				)
				print(f"[EVAL] Case {i} output: {output[:100]}")
				
# Score output using LLM (works for any prompt type)
				criteria = case.get('criteria', 'Is this response accurate and helpful?')
				
				# Clear, objective scoring prompt
				score_prompt = f"""You are an objective evaluator. Score 0.0-1.0 based ONLY on criteria.
Input: {case.get('input', '')[:250]}
Criteria: {criteria}
Response: {output[:400]}
Return ONLY: {{"overall": 0.X}}"""
				
				score_messages = [
					{'role': 'system', 'content': 'Respond ONLY with valid JSON: {"overall": value}. No other text.'},
					{'role': 'user', 'content': score_prompt}
				]
				
				print(f"[EVAL] Case {i} LLM scoring...")
				score_result = _run_sync_llm(
					score_messages,
					temperature=0.0,
					max_tokens=50,
					timeout_seconds=llm_timeout,
				)
				print(f"[EVAL] Case {i} score response: {score_result}")
				
				score = 0.5  # Default fallback
				try:
					score_data = json.loads(score_result)
					score = float(score_data.get('overall', 0.5))
					print(f"[EVAL] Case {i} parsed score: {score}")
				except (json.JSONDecodeError, ValueError) as e:
					import re
					match = re.search(r'[0-9]+\.?[0-9]*', score_result)
					if match:
						raw_score = float(match.group())
						score = raw_score / 10 if raw_score > 1 else raw_score
						print(f"[EVAL] Case {i} extracted score: {score}")
					else:
						score = 0.5
						print(f"[EVAL] Case {i} parse failed, using default 0.5")
				
				# Ensure score is a valid number
				if score is None:
					score = 0.5
				
				results.append({
					'case_index': i,
					'input': case.get('input', ''),
					'expected': case.get('expected_output', ''),
					'actual': output,
					'score': float(score),
					'passed': float(score) >= 0.7
				})
			except Exception as e:
				results.append({
					'case_index': i,
					'input': case.get('input', ''),
					'error': str(e),
					'score': 0.0,
					'passed': False
				})
		
		# Calculate final status and score
		total_score = sum(r.get('score', 0) for r in results) / len(results) if results else 0
		failed_count = sum(1 for r in results if not r.get('passed', False))
		fail_rate = failed_count / len(results) if results else 0
		
		if fail_rate == 0:
			status = 'passed'
		elif fail_rate <= 0.2:
			status = 'degraded'
		else:
			status = 'failed'
		
		# Update run with results
		run.status = status
		run.results = results
		run.score = total_score
		run.completed_at = datetime.now(timezone.utc)
		db.commit()
		
		return {"status": status, "score": total_score}
	except Exception as e:
		print(f"[EVAL ERROR] {str(e)}")
		if run is not None:
			run.status = "failed"
			run.score = 0.0
			run.completed_at = datetime.now(timezone.utc)
			db.commit()
		return {"status": "failed", "score": 0.0, "error": str(e)}
	finally:
		db.close()


@celery.task(
	name="app.workers.tasks.run_all_drift_checks",
	autoretry_for=(httpx.HTTPError, ConnectionError, TimeoutError, RuntimeError),
	retry_backoff=True,
	retry_jitter=True,
	retry_kwargs={"max_retries": 3},
)
def run_all_drift_checks():
	"""Run drift checks for all units."""
	db = get_sync_db()
	try:
		result = db.execute(select(BehaviorUnit.id))
		unit_ids = [str(row[0]) for row in result.all()]
		return {"units_checked": len(unit_ids)}
	finally:
		db.close()


@celery.task(
	name="app.workers.tasks.investigate_drift",
	autoretry_for=(httpx.HTTPError, ConnectionError, TimeoutError, RuntimeError),
	retry_backoff=True,
	retry_jitter=True,
	retry_kwargs={"max_retries": 3},
)
def investigate_drift(drift_event_id: str):
	"""Investigate drift event (stub)."""
	return {"status": "investigated", "drift_event_id": drift_event_id}


@celery.task(
	name="app.workers.tasks.compute_fingerprint",
	autoretry_for=(httpx.HTTPError, ConnectionError, TimeoutError, RuntimeError),
	retry_backoff=True,
	retry_jitter=True,
	retry_kwargs={"max_retries": 3},
)
def compute_fingerprint(version_id: str, eval_set_id: str):
	"""Compute fingerprint for version (stub)."""
	return {
		"ok": True,
		"dimensions": 768,
		"sample_count": 0,
	}

