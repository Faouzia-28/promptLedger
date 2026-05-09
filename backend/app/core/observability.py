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

except Exception:
    # Fallback no-op metrics if prometheus_client is not installed.
    def observe_request(method: str, path: str, elapsed: float) -> None:
        return
