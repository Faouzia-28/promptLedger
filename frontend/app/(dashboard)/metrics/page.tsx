'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Activity, TimerReset, ShieldAlert, Gauge, ChartColumn } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { parsePrometheusSnapshot, formatDateTime } from '@/lib/dashboard';

export default function MetricsPage() {
  const [metricsText, setMetricsText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadMetrics = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/metrics');
      if (!response.ok) {
        throw new Error(`Metrics endpoint returned ${response.status}`);
      }
      const text = await response.text();
      setMetricsText(text);
      setLastUpdated(new Date().toISOString());
    } catch (err: any) {
      setError(err.message || 'Failed to load metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadMetrics();
  }, []);

  const snapshot = useMemo(() => parsePrometheusSnapshot(metricsText), [metricsText]);
  const parseFailureRate = snapshot.calls > 0 ? (snapshot.parseFailures / snapshot.calls) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Observability & Metrics</h1>
          <p className="text-muted-foreground">Scorer latency, parse failures, and live throughput from the backend Prometheus endpoint.</p>
        </div>
        <Button onClick={loadMetrics} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Activity} label="Scorer calls" value={snapshot.calls.toLocaleString()} detail="All scoring invocations" />
        <MetricCard icon={ShieldAlert} label="Parse failures" value={snapshot.parseFailures.toLocaleString()} detail={`${parseFailureRate.toFixed(2)}% failure rate`} tone="warning" />
        <MetricCard icon={TimerReset} label="Latency p95" value={`${snapshot.latencyP95.toFixed(2)}s`} detail="Approximate histogram p95" tone="success" />
        <MetricCard icon={Gauge} label="Success rate" value={`${snapshot.successRate.toFixed(1)}%`} detail={`Updated ${lastUpdated ? formatDateTime(lastUpdated) : 'just now'}`} tone="success" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Metrics snapshot</CardTitle>
            <CardDescription>These cards are derived from the Prometheus text exposition returned by the backend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <>
                <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm">
                  <p className="font-medium">What to watch</p>
                  <ul className="mt-3 space-y-2 text-muted-foreground">
                    <li>• parse-failure-rate should stay near zero after template changes.</li>
                    <li>• latency p95 should stay flat when scorer prompts get longer.</li>
                    <li>• calls should rise when webhook volume and manual regrades increase.</li>
                  </ul>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Parse failures</p>
                    <p className="mt-2 text-2xl font-semibold">{snapshot.parseFailures.toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Latency average</p>
                    <p className="mt-2 text-2xl font-semibold">{snapshot.latencyAvg.toFixed(2)}s</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Raw metrics</CardTitle>
            <CardDescription>Useful when you need to inspect bucket labels or verify the backend is exporting the correct names.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <pre className="max-h-[34rem] overflow-auto rounded-2xl border border-border bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
                {metricsText || 'No metrics returned.'}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'default' }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; detail: string; tone?: 'default' | 'warning' | 'success'; }) {
  const toneClass = tone === 'warning' ? 'text-amber-500' : tone === 'success' ? 'text-emerald-500' : 'text-primary';

  return (
    <Card className="border-border/70">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
            <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
          </div>
          <div className={`rounded-2xl border border-border bg-muted/30 p-3 ${toneClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
