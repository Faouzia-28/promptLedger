'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useBehaviorUnits, useDriftEvents, useGitHubIntegrations, useCurrentUser } from '@/lib/hooks';
import { WebSocketClient } from '@/lib/websocket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime, shortId } from '@/lib/dashboard';
import { Activity, BarChart3, GitBranch, PlayCircle, Plus, ShieldAlert, Sparkles, TerminalSquare } from 'lucide-react';

function StatAccent({ tone }: { tone: 'neutral' | 'good' | 'warning' | 'error' }) {
  const classes = {
    neutral: 'border-sky-500/70',
    good: 'border-emerald-500/70',
    warning: 'border-amber-500/70',
    error: 'border-rose-500/70',
  }[tone];
  return <div className={`absolute inset-y-0 left-0 w-1 rounded-l-2xl ${classes}`} />;
}

function StatCard({ label, value, detail, tone }: { label: string; value: string | number; detail?: string; tone: 'neutral' | 'good' | 'warning' | 'error' }) {
  return (
    <Card className="relative overflow-hidden border border-zinc-700 bg-[#1a1d27]">
      <StatAccent tone={tone} />
      <CardContent className="p-5 pl-7">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-4xl font-bold tracking-tight text-zinc-50">{value}</p>
        {detail ? <p className="mt-2 text-sm text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

function QuickActionPill({ href, icon: Icon, label }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Button asChild variant="outline" className="h-10 rounded-full border-zinc-700 bg-zinc-900/80 px-4 text-zinc-100 hover:bg-zinc-800/80 hover:text-white">
      <Link href={href} className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}

function HealthSparkline({ points }: { points: number[] }) {
  const trendUp = points.length > 1 ? points[points.length - 1] >= points[0] : true;
  const data = points.map((value, index) => ({ index, value }));

  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-zinc-400">
        <span>Health trend</span>
        <span className={trendUp ? 'text-emerald-400' : 'text-rose-400'}>{trendUp ? 'Trending up' : 'Trending down'}</span>
      </div>
      <div className="h-[60px] w-[200px] max-w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="value" stroke={trendUp ? '#22c55e' : '#f43f5e'} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { data: units } = useBehaviorUnits();
  const { data: driftEvents } = useDriftEvents();
  const { data: integrations } = useGitHubIntegrations();
  const { user } = useCurrentUser();
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const driftEventList = driftEvents ?? [];
  const integrationList = integrations ?? [];
  const unitList = units ?? [];

  useEffect(() => {
    if (!user?.org_id) return;

    const client = new WebSocketClient(user.org_id);
    client.connect().catch(() => undefined);

    const unsubscribe = client.subscribe((notification) => {
      toast.error(`Drift detected: ${notification.severity.toUpperCase()}`, {
        description: `Unit ${notification.unit_id} crossed ${(notification.drift_score * 100).toFixed(1)}% drift`,
        action: { label: 'View', onClick: () => window.location.href = `/drift/${notification.unit_id}` },
      });
    });

    return () => {
      unsubscribe();
      client.disconnect();
    };
  }, [user?.org_id]);

  useEffect(() => {
    let cancelled = false;

    const loadRecentRuns = async () => {
      if (!unitList.length) {
        setRecentRuns([]);
        return;
      }

      setRecentLoading(true);
      try {
        const results = await Promise.all(
          unitList.map(async (unit: any) => {
            try {
              const response = await api.get(`/evals/units/${unit.id}/runs`);
              const runs = Array.isArray(response.data) ? response.data : [];
              return runs.slice(0, 3).map((run: any) => ({ ...run, unit_name: unit.name }));
            } catch {
              return [];
            }
          })
        );

        if (!cancelled) {
          setRecentRuns(
            results
              .flat()
              .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
              .slice(0, 10)
          );
        }
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    };

    void loadRecentRuns();
    return () => { cancelled = true; };
  }, [unitList]);

  const openDrifts = driftEventList.filter((event: any) => !event.resolved).length;
  const tokenReadyCount = integrationList.filter((integration: any) => integration.has_github_token).length;
  const activeRuns = recentRuns.filter((run) => run.status === 'pending' || run.status === 'running').length;
  const averageScore = recentRuns.length ? recentRuns.reduce((sum, run) => sum + (Number(run.score) || 0), 0) / recentRuns.length : 0;
  const healthScore = useMemo(() => {
    const total = recentRuns.length || 1;
    const recentFailures = recentRuns.filter((run) => run.status === 'failed' || Number(run.score) < 0.5).length;
    return Math.max(0, Math.round(100 - (recentFailures / total) * 100));
  }, [recentRuns]);

  const trendPoints = useMemo(() => {
    const scores = recentRuns
      .slice()
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .slice(-10)
      .map((run) => Number(run.score) || 0);
    return scores.length > 1 ? scores : [0, 0, 0, 0, 0];
  }, [recentRuns]);

  const recentTimeline = recentRuns.slice(0, 4).map((run) => ({
    id: run.id,
    status: run.status || 'running',
    score: Number(run.score) || 0,
    time: run.completed_at || run.created_at,
    unitName: run.unit_name || 'Unknown unit',
  }));

  return (
    <div className="space-y-8 bg-[#0f1117] text-zinc-100">
      <div className="flex flex-col gap-4 border-b border-zinc-700 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-zinc-500">
            <Sparkles className="h-3.5 w-3.5" />
            PromptLedger dashboard
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">{user?.org_id ? shortId(user.org_id, 12) : 'Organization'}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="border-zinc-700 bg-zinc-900 text-zinc-100">Repos {integrationList.length}</Badge>
          <Badge variant="secondary" className="border-zinc-700 bg-zinc-900 text-zinc-100">Alerts {openDrifts}</Badge>
          <Badge variant="secondary" className="border-zinc-700 bg-zinc-900 text-zinc-100">Active evals {activeRuns}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Behavior units" value={unitList.length} detail="Registered prompt surfaces" tone="neutral" />
        <StatCard label="Eval runs" value={recentRuns.length} detail={recentLoading ? 'Loading live runs...' : `${activeRuns} still active`} tone="neutral" />
        <StatCard label="Open drift" value={openDrifts} detail={`${healthScore}% health score`} tone={openDrifts ? 'warning' : 'good'} />
        <StatCard label="Connected repos" value={integrationList.length} detail={`${tokenReadyCount} PATs stored securely`} tone={tokenReadyCount ? 'good' : 'warning'} />
        <StatCard label="Avg eval score" value={recentRuns.length ? averageScore.toFixed(2) : '0.00'} detail="Across the latest runs" tone="good" />
      </div>

      <div className="flex flex-col gap-3 border-y border-zinc-700 bg-[#1a1d27] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Quick actions</p>
          <p className="mt-1 text-sm text-zinc-300">Compact toolbar for the most common workflows.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickActionPill href="/units" icon={Plus} label="Create unit" />
          <QuickActionPill href="/github" icon={GitBranch} label="GitHub sync" />
          <QuickActionPill href="/evals" icon={PlayCircle} label="Inspect evals" />
          <QuickActionPill href="/templates" icon={TerminalSquare} label="Scoring templates" />
          <QuickActionPill href="/metrics" icon={BarChart3} label="Metrics" />
          <QuickActionPill href="/audit" icon={Activity} label="Audit trail" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Card className="border-zinc-700 bg-[#1a1d27]">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest eval runs with status, score, and timestamp.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTimeline.length > 0 ? recentTimeline.map((item) => {
              const isPassed = item.status === 'passed' || item.score >= 0.5;
              const isFailed = item.status === 'failed' || item.score < 0.5;
              const dot = isPassed ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : 'bg-zinc-500';
              const badgeClass = isPassed
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : isFailed
                  ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                  : 'border-amber-500/20 bg-amber-500/10 text-amber-300';

              return (
                <Link key={item.id} href={`/evals/${item.id}`} className="grid grid-cols-[16px_1fr_auto] items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900/60 px-4 py-3 transition-colors hover:bg-zinc-800/70">
                  <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">{item.unitName}</p>
                    <p className="font-mono text-xs text-zinc-400">Run {shortId(item.id)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass}`}>Score {item.score.toFixed(2)}</span>
                    <span className="text-xs text-zinc-500">{formatDateTime(item.time)}</span>
                  </div>
                </Link>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-6 text-sm text-zinc-400">Once you sync a repo or run an eval, the feed will populate here automatically.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-700 bg-[#1a1d27]">
          <CardHeader>
            <CardTitle>Health trend</CardTitle>
            <CardDescription>Last 10 runs at a glance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <HealthSparkline points={trendPoints} />
            <div className="grid gap-3 rounded-2xl border border-zinc-700 bg-zinc-900/60 p-4 text-xs text-zinc-300">
              <div className="flex items-center justify-between gap-3"><span>Open drift</span><span className="font-medium text-zinc-100">{openDrifts}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Active evals</span><span className="font-medium text-zinc-100">{activeRuns}</span></div>
              <div className="flex items-center justify-between gap-3"><span>PATs</span><span className="font-medium text-zinc-100">{tokenReadyCount}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
