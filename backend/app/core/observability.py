"""Prometheus metrics helpers for PromptLedger."""
try:
    from prometheus_client import Counter, Histogram

    # Count requests by method and path
    REQUEST_COUNT = Counter(
        "promptledger_requests_total",
        "Total HTTP requests",
        ["method", "path"],
    )

    # Histogram of request latency
    REQUEST_LATENCY = Histogram(
        "promptledger_request_latency_seconds",
        "Request latency in seconds",
        ["method", "path"],
    )


    def observe_request(method: str, path: str, elapsed: float) -> None:
        try:
            REQUEST_COUNT.labels(method=method, path=path).inc()
            REQUEST_LATENCY.labels(method=method, path=path).observe(elapsed)
        except Exception:
            # Metrics should never raise
            pass

    # Scorer-specific metrics
    SCORE_CALLS = Counter(
        "promptledger_scorer_calls_total",
        "Total number of scorer invocations",
    )

    SCORE_PARSE_FAILURES = Counter(
        "promptledger_scorer_parse_failures_total",
        "Number of scorer responses that failed to parse",
    )

    SCORE_LATENCY = Histogram(
        "promptledger_scorer_latency_seconds",
        "Latency of scorer LLM calls in seconds",
    )

    def observe_scorer(latency_seconds: float, parsed_ok: bool = True) -> None:
        try:
            SCORE_CALLS.inc()
            SCORE_LATENCY.observe(latency_seconds)
            if not parsed_ok:
                SCORE_PARSE_FAILURES.inc()
        except Exception:
            pass

except Exception:
    # Fallback no-op metrics if prometheus_client is not installed.
    def observe_request(method: str, path: str, elapsed: float) -> None:
        return
