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
    <div className="space-y-8 bg-[#0a0a0a] text-zinc-100">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Observability & Metrics</h1>
          <p className="text-zinc-400">Scorer latency, parse failures, and live throughput from the backend Prometheus endpoint.</p>
        </div>
        <Button onClick={loadMetrics} disabled={isLoading} className="soft-glow rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 text-zinc-100 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] transition-all duration-200 ease-out hover:border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.08)]">
          <RefreshCw className={`mr-2 h-4 w-4 glow-icon ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border border-red-400/20 bg-red-400/10">
          <CardContent className="p-4 text-sm text-red-300">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Activity} label="Scorer calls" value={snapshot.calls.toLocaleString()} detail="All scoring invocations" />
        <MetricCard icon={ShieldAlert} label="Parse failures" value={snapshot.parseFailures.toLocaleString()} detail={`${parseFailureRate.toFixed(2)}% failure rate`} />
        <MetricCard icon={TimerReset} label="Latency p95" value={`${snapshot.latencyP95.toFixed(2)}s`} detail="Approximate histogram p95" />
        <MetricCard icon={Gauge} label="Success rate" value={`${snapshot.successRate.toFixed(1)}%`} detail={`Updated ${lastUpdated ? formatDateTime(lastUpdated) : 'just now'}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border border-[rgba(255,255,255,0.08)] bg-[#141414] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_4px_24px_rgba(0,0,0,0.4)]">
          <CardHeader>
            <CardTitle>Metrics snapshot</CardTitle>
            <CardDescription>These cards are derived from the Prometheus text exposition returned by the backend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <>
                <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 text-sm shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]">
                  <p className="font-medium">What to watch</p>
                  <ul className="mt-3 space-y-2 text-zinc-400">
                    <li>• parse-failure-rate should stay near zero after template changes.</li>
                    <li>• latency p95 should stay flat when scorer prompts get longer.</li>
                    <li>• calls should rise when webhook volume and manual regrades increase.</li>
                  </ul>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-white/35">Parse failures</p>
                    <p className="mt-2 text-2xl font-semibold">{snapshot.parseFailures.toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-white/35">Latency average</p>
                    <p className="mt-2 text-2xl font-semibold">{snapshot.latencyAvg.toFixed(2)}s</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border border-[rgba(255,255,255,0.08)] bg-[#141414] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_4px_24px_rgba(0,0,0,0.4)]">
          <CardHeader>
            <CardTitle>Raw metrics</CardTitle>
            <CardDescription>Useful when you need to inspect bucket labels or verify the backend is exporting the correct names.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <pre className="max-h-[34rem] overflow-auto rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 text-xs leading-relaxed text-zinc-100 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]">
                {metricsText || 'No metrics returned.'}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; detail: string; }) {
  return (
    <Card className="border border-[#1e1e1e] bg-[#141414] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_10px_24px_rgba(0,0,0,0.34)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.1em] text-white/35">{label}</p>
            <p className="mt-2 text-[2.75rem] font-light tracking-[-0.02em] text-zinc-50">{value}</p>
            <p className="mt-2 text-sm text-zinc-400">{detail}</p>
          </div>
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-3 text-zinc-100">
            <Icon className="h-5 w-5 text-zinc-100" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
