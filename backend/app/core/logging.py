"""Minimal structured JSON logger configuration for PromptLedger."""
import logging
import json
from datetime import datetime


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "func": record.funcName,
            "line": record.lineno,
        }

        # Include any extra context if provided via record.__dict__
        extra_keys = set(record.__dict__.keys()) - set(
            [
                "name",
                "msg",
                "args",
                "levelname",
                "levelno",
                "pathname",
                "filename",
                "module",
                "exc_info",
                "exc_text",
                "stack_info",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
            ]
        )

        for key in extra_keys:
            try:
                json.dumps(record.__dict__[key])
                payload[key] = record.__dict__[key]
            except Exception:
                payload[key] = str(record.__dict__[key])

        return json.dumps(payload, default=str)


def configure_logging(level: int = logging.INFO) -> None:
    root = logging.getLogger()
    root.setLevel(level)

    # Avoid duplicate handlers in interactive runs
    if not any(isinstance(h, logging.StreamHandler) for h in root.handlers):
        handler = logging.StreamHandler()
        handler.setFormatter(JSONFormatter())
        root.addHandler(handler)
