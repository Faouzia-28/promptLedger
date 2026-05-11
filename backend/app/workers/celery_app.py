"""Celery application configuration for PromptLedger."""

from celery import Celery
import logging

from app.core.config import settings


logger = logging.getLogger(__name__)


celery = Celery(
	"promptledger",
	broker=settings.REDIS_URL,
	backend=settings.REDIS_URL,
)

logger.info(
	"Celery starting with LLM provider=%s groq_model=%s timeout=%s",
	settings.LLM_PROVIDER,
	settings.GROQ_MODEL,
	settings.EVAL_LLM_TIMEOUT_SECONDS,
)

celery.conf.update(
	task_serializer="json",
	result_serializer="json",
	accept_content=["json"],
	timezone="UTC",
	enable_utc=True,
	task_acks_late=True,
	task_reject_on_worker_lost=True,
	worker_prefetch_multiplier=1,
	task_default_retry_delay=60,
)

# Auto-load tasks from the workers package.
celery.autodiscover_tasks(["app.workers"])

# Periodic drift checks every 30 minutes.
celery.conf.beat_schedule = {
	"check-drift-every-30min": {
		"task": "app.workers.tasks.run_all_drift_checks",
		"schedule": 1800,
	}
}

