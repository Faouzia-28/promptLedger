"""Celery task definitions for PromptLedger."""

import json
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_sync_db
from app.models.models import BehaviorUnit, EvalRun, EvalSet, BehaviorVersion
from app.workers.celery_app import celery
from app.services.llm_service import llm
import asyncio


def _run_sync_llm(messages: list[dict], temperature: float = 0.1, max_tokens: int = 2000) -> str:
	"""Run LLM chat synchronously using asyncio."""
	async def _chat():
		return await llm.chat(messages, temperature, max_tokens)
	
	loop = asyncio.new_event_loop()
	asyncio.set_event_loop(loop)
	try:
		return loop.run_until_complete(_chat())
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
	autoretry_for=(httpx.HTTPError, ConnectionError, TimeoutError, RuntimeError),
	retry_backoff=True,
	retry_jitter=True,
	retry_kwargs={"max_retries": 3},
)
def run_regression_eval(eval_run_id: str):
	"""Run evaluation set against a version (synchronous)."""
	db = get_sync_db()
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
				output = _run_sync_llm(messages, temperature=0.1, max_tokens=2000)
				print(f"[EVAL] Case {i} output: {output[:100]}")
				
				# Score output
				criteria = case.get('criteria', 'Is this response accurate?')
				score_prompt = f"""You are an evaluator. Score this response 0.0 to 1.0.
Input: {case.get('input', '')[:200]}
Criteria: {criteria}
Response: {output[:300]}

IMPORTANT: Return ONLY valid JSON like: {{"overall": 0.8}}"""
				
				score_result = _run_sync_llm([{'role': 'user', 'content': score_prompt}], temperature=0.3, max_tokens=100)
				print(f"[EVAL] Case {i} score response: {score_result}")
				
				try:
					# Try to extract JSON from the response
					score_data = json.loads(score_result)
					score = score_data.get('overall', 0.5)
					print(f"[EVAL] Case {i} parsed score: {score}")
				except json.JSONDecodeError:
					print(f"[EVAL] Case {i} JSON parse failed, trying to extract number")
					# Try to extract just the number
					import re
					match = re.search(r'(\d+\.?\d*)', score_result)
					if match:
						score = float(match.group(1)) / 10 if float(match.group(1)) > 1 else float(match.group(1))
						print(f"[EVAL] Case {i} extracted score: {score}")
					else:
						score = 0.5
						print(f"[EVAL] Case {i} could not extract score, using default 0.5")
				
				results.append({
					'case_index': i,
					'input': case.get('input', ''),
					'expected': case.get('expected_output', ''),
					'actual': output,
					'score': score,
					'passed': score >= 0.7
				})
			except (httpx.HTTPError, ConnectionError, TimeoutError, RuntimeError):
				raise
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
		db.commit()
		
		return {"status": status, "score": total_score}
	except (httpx.HTTPError, ConnectionError, TimeoutError, RuntimeError):
		raise
	except Exception as e:
		print(f"[EVAL ERROR] {str(e)}")
		run.status = "failed"
		run.score = 0.0
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

