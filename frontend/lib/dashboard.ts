export function safeJsonString(value: unknown, spacing = 2): string {
  try {
    return JSON.stringify(value ?? {}, null, spacing);
  } catch {
    return String(value ?? '');
  }
}

export function shortId(value: string | undefined | null, length = 8): string {
  if (!value) return '-';
  return value.length > length ? value.slice(0, length) : value;
}

export function formatDateTime(value: string | number | Date | undefined | null): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export function formatDate(value: string | number | Date | undefined | null): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
}

export function truncateText(value: unknown, length = 120): string {
  const text = typeof value === 'string' ? value : safeJsonString(value, 0);
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1)}…`;
}

export function toLines(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parsePrometheusSnapshot(metricsText: string) {
  const summary = {
    calls: 0,
    parseFailures: 0,
    latencyP95: 0,
    latencyAvg: 0,
    successRate: 0,
  };

  const histogramBuckets: { le: number; count: number }[] = [];
  const lines = metricsText.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;

    const metric = parts[0];
    const value = Number(parts[1]);
    if (Number.isNaN(value)) continue;

    if (metric.startsWith('promptledger_scorer_calls_total')) {
      summary.calls = value;
      continue;
    }

    if (metric.startsWith('promptledger_scorer_parse_failures_total')) {
      summary.parseFailures = value;
      continue;
    }

    if (metric.startsWith('promptledger_scorer_latency_seconds_bucket')) {
      const match = metric.match(/le="([^"]+)"/);
      if (match && match[1] !== '+Inf') {
        const bucket = Number(match[1]);
        if (!Number.isNaN(bucket)) {
          histogramBuckets.push({ le: bucket, count: value });
        }
      }
      continue;
    }

    if (metric.startsWith('promptledger_scorer_latency_seconds_sum')) {
      summary.latencyAvg = value;
      continue;
    }
  }

  if (summary.calls > 0) {
    summary.successRate = Math.max(0, 100 - (summary.parseFailures / summary.calls) * 100);
  }

  if (histogramBuckets.length > 0) {
    const total = histogramBuckets[histogramBuckets.length - 1]?.count || 0;
    if (total > 0) {
      const target = total * 0.95;
      const p95Bucket = histogramBuckets.find((bucket) => bucket.count >= target) || histogramBuckets[histogramBuckets.length - 1];
      summary.latencyP95 = p95Bucket?.le || 0;
    }
  }

  return summary;
}
