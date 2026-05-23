'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useBehaviorUnits, useDriftEvents, useGitHubIntegrations, useCurrentUser } from '@/lib/hooks';
import { WebSocketClient } from '@/lib/websocket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime, shortId } from '@/lib/dashboard';
import { Activity, BarChart3, Bell, GitBranch, PlayCircle, Plus, ShieldAlert, Sparkles, TerminalSquare } from 'lucide-react';

const EMPTY_LIST: never[] = [];

type StatVariant = 'units' | 'runs' | 'drift' | 'repos';

function StatArtwork({ variant }: { variant: StatVariant }) {
  if (variant === 'units') {
    return (
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="unit-face-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#d4d4d8" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="unit-face-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#71717a" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <g opacity="0.92">
          <g transform="translate(22 18)">
            <path d="M20 18l18-10 18 10-18 10z" fill="url(#unit-face-a)"/>
            <path d="M20 18v20l18 10V28z" fill="url(#unit-face-b)"/>
            <path d="M56 18v20l-18 10V28z" fill="#bcbcbc" fillOpacity="0.11"/>
          </g>
          <g transform="translate(52 34)">
            <path d="M20 18l18-10 18 10-18 10z" fill="url(#unit-face-a)"/>
            <path d="M20 18v20l18 10V28z" fill="url(#unit-face-b)"/>
            <path d="M56 18v20l-18 10V28z" fill="#bcbcbc" fillOpacity="0.1"/>
          </g>
          <g transform="translate(37 58)">
            <path d="M20 18l18-10 18 10-18 10z" fill="url(#unit-face-a)"/>
            <path d="M20 18v20l18 10V28z" fill="url(#unit-face-b)"/>
            <path d="M56 18v20l-18 10V28z" fill="#bcbcbc" fillOpacity="0.1"/>
          </g>
        </g>
      </svg>
    );
  }

  if (variant === 'runs') {
    return (
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="run-face" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#d4d4d8" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="run-side" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fafafa" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#71717a" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <g transform="translate(18 16)">
          <circle cx="40" cy="40" r="28" fill="none" stroke="url(#run-face)" strokeWidth="8" />
          <path d="M40 22v18l12 7" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 24h16M8 34h12M10 44h14" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="5" strokeLinecap="round" />
          <path d="M60 18l11-7" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="5" strokeLinecap="round" />
          <path d="M64 28l14-5" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="5" strokeLinecap="round" />
          <path d="M66 38l12-1" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="5" strokeLinecap="round" />
          <circle cx="40" cy="40" r="8" fill="url(#run-face)" />
        </g>
      </svg>
    );
  }

  if (variant === 'drift') {
    return (
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="doc-front" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.68" />
            <stop offset="100%" stopColor="#d4d4d8" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="doc-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#71717a" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <g transform="translate(20 18)">
          <path d="M20 16h28l10 10v30H20z" fill="url(#doc-back)" />
          <path d="M28 24h28l10 10v30H28z" fill="url(#doc-front)" />
          <path d="M56 24v10h10" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="4" strokeLinejoin="round" />
          <path d="M35 42h20M35 49h14" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="4" strokeLinecap="round" />
          <path d="M70 38c8 0 12 4 12 10s-4 10-12 10" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="6" strokeLinecap="round" />
          <path d="M70 42l8 6-8 6" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 70l12-12" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="5" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="repo-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#d4d4d8" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="repo-side" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#71717a" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <g transform="translate(16 18)">
        <path d="M30 22c0-8 6-14 14-14h12c8 0 14 6 14 14s-6 14-14 14H44c-8 0-14-6-14-14z" fill="none" stroke="url(#repo-face)" strokeWidth="9" strokeLinecap="round" />
        <path d="M42 22c0-4 3-7 7-7h12c4 0 7 3 7 7s-3 7-7 7H49c-4 0-7-3-7-7z" fill="none" stroke="url(#repo-side)" strokeWidth="7" strokeLinecap="round" />
        <path d="M44 36c0 8-6 14-14 14H18c-8 0-14-6-14-14s6-14 14-14h12c8 0 14 6 14 14z" fill="none" stroke="url(#repo-face)" strokeWidth="9" strokeLinecap="round" />
        <path d="M32 36c0 4-3 7-7 7H13c-4 0-7-3-7-7s3-7 7-7h12c4 0 7 3 7 7z" fill="none" stroke="url(#repo-side)" strokeWidth="7" strokeLinecap="round" />
        <path d="M30 16l11 12M30 44l11-12" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function StatCard({ label, value, detail, variant }: { label: string; value: string | number; detail?: string; variant: StatVariant }) {
  return (
    <Card className="group relative overflow-hidden border border-[#1e1e1e] bg-[#141414] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_10px_24px_rgba(0,0,0,0.34)] transition-all duration-300 ease-out hover:border-[#2a2a2a] hover:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_14px_30px_rgba(0,0,0,0.42)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02),transparent_68%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2 opacity-15 transition-all duration-300 ease-out group-hover:opacity-11 group-hover:scale-105">
        <StatArtwork variant={variant} />
      </div>
      <CardContent className="relative z-10 flex min-h-[176px] flex-col p-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">{label}</p>
        <div className="mt-auto pb-2 pt-8">
          <p className="text-[2.35rem] font-light tracking-[-0.03em] text-zinc-50">{value}</p>
        </div>
        <p className="text-sm text-zinc-400">{detail}</p>
      </CardContent>
    </Card>
  );
}

function QuickActionPill({ href, icon: Icon, label }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link
      href={href}
      className="soft-glow inline-flex h-10 items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 text-sm font-medium text-zinc-100 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] transition-all duration-200 ease-out hover:border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.08)] hover:text-zinc-100"
    >
      <Icon className="h-4 w-4 glow-icon" />
      {label}
    </Link>
  );
}

function HealthSparkline({ points }: { points: number[] }) {
  const chartId = useId();
  const trendUp = points.length > 1 ? points[points.length - 1] >= points[0] : true;
  const linePath = trendUp
    ? 'M 16 122 C 150 122, 230 118, 324 104 S 516 58, 648 52'
    : 'M 16 106 C 152 98, 232 92, 328 98 S 522 122, 648 136';
  const areaPath = `${linePath} L 648 148 L 16 148 Z`;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.028),rgba(255,255,255,0.012))] p-4 shadow-[0_0_12px_rgba(255,255,255,0.04),0_1px_0_rgba(255,255,255,0.08)_inset,0_16px_36px_rgba(0,0,0,0.38)]">
      <div className="mb-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.1em] text-white/35">
        <span>Health trend</span>
        <span className={trendUp ? 'text-zinc-300' : 'text-zinc-400'}>{trendUp ? 'Trending up' : 'Trending down'}</span>
      </div>
      <div className="relative h-[148px] overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#080808]/90">
        <div className="pointer-events-none absolute inset-0 z-20 select-none px-3 pt-4 text-[9px] font-mono text-neutral-600">
          <div className="flex justify-between border-b border-neutral-900/40 pb-1">
            <span>100% BEHAVIORAL FIDELITY</span>
            <span>DEPLOYED MATCH</span>
          </div>
          <div className="flex justify-between border-b border-neutral-900/40 pb-1 pt-1.5">
            <span>50% SPECIFICATIONS COMPLYING</span>
            <span>DRIFT THRESHOLD LIMIT</span>
          </div>
          <div className="flex justify-between pt-1.5">
            <span>0% CRITICAL FAILURES</span>
            <span>BENCHMARK NOMINAL</span>
          </div>
        </div>

        <svg viewBox="0 0 680 150" preserveAspectRatio="none" className="absolute inset-0 z-10 h-full w-full">
          <defs>
            <linearGradient id={`${chartId}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.03" />
            </linearGradient>
            <filter id={`${chartId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path d={areaPath} fill={`url(#${chartId}-area)`} />
          <path
            d={linePath}
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${chartId}-glow)`}
          />
          <circle cx="648" cy={trendUp ? '52' : '136'} r="5" fill="#ffffff" opacity="0.2" className="animate-ping" />
          <circle cx="648" cy={trendUp ? '52' : '136'} r="4" fill="#ffffff" />
        </svg>

        <div className="absolute bottom-2 left-3 z-30 flex items-center gap-1.5 rounded-md border border-neutral-800/85 bg-[#0e0e0e]/90 px-2.5 py-1 font-mono text-[10px] text-neutral-300">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          <span>{trendUp ? 'TRENDING UP (HEALTHY)' : 'TRENDING DOWN (DRIFT DETECTED)'}</span>
        </div>
      </div>
    </div>
  );
}

function NotificationBell() {
  return (
    <>
      <button
        type="button"
        aria-label="Notifications"
        className="group inline-flex items-center justify-center border-0 bg-transparent p-0 text-zinc-100 transition-transform duration-200 ease-out hover:scale-110"
      >
        <Bell
          className="h-[22px] w-[22px] text-white transition-[filter,transform] duration-200 ease-out"
          style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.4))' }}
        />
      </button>
      <style jsx>{`
        button:hover :global(svg) {
          filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 12px rgba(255, 255, 255, 0.3));
        }

        button :global(svg) {
          animation: bellGlow 2.5s ease-in-out infinite;
        }

        @keyframes bellGlow {
          0%,
          100% {
            filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.4));
          }

          50% {
            filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 20px rgba(255, 255, 255, 0.3));
          }
        }
      `}</style>
    </>
  );
}

export default function OverviewPage() {
  const { data: units } = useBehaviorUnits();
  const { data: driftEvents } = useDriftEvents();
  const { data: integrations } = useGitHubIntegrations();
  const { user } = useCurrentUser();
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const driftEventList = driftEvents ?? EMPTY_LIST;
  const integrationList = integrations ?? EMPTY_LIST;
  const unitList = units ?? EMPTY_LIST;

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
  const displayName = useMemo(() => {
    const email = user?.email || '';
    const localPart = email.includes('@') ? email.split('@')[0] : '';
    return user?.name || user?.full_name || user?.display_name || localPart || 'there';
  }, [user]);

  return (
    <div className="space-y-8 bg-[#0d0d0d] text-zinc-100">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-white/35">
            <Sparkles className="h-3.5 w-3.5" />
            PromptLedger dashboard
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">Hello {displayName}</h1>
          <p className="mt-1 text-sm text-zinc-400">{user?.org_id ? shortId(user.org_id, 12) : 'Organization'} overview</p>
        </div>
        <div className="flex items-start justify-end lg:pt-2">
          <NotificationBell />
        </div>
      </div>

      <Card className="relative overflow-hidden border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] shadow-[0_0_14px_rgba(255,255,255,0.05),0_1px_0_rgba(255,255,255,0.08)_inset,0_16px_42px_rgba(0,0,0,0.36)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.03),transparent_30%)]" />
        <CardHeader className="relative flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Health dashboard</CardTitle>
            <CardDescription>Highlighted status for the latest runs, drift, and score trend.</CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-zinc-100">{healthScore}% health</Badge>
        </CardHeader>
        <CardContent className="relative grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(240px,0.9fr)]">
          <HealthSparkline points={trendPoints} />
          <div className="grid gap-3">
            <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0f0f0f] p-4 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]">
              <p className="text-[11px] uppercase tracking-[0.1em] text-white/35">Behavior units</p>
              <p className="mt-2 text-3xl font-light tracking-[-0.02em] text-zinc-50">{unitList.length}</p>
              <p className="mt-1 text-sm text-zinc-400">Registered prompt surfaces</p>
            </div>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0f0f0f] p-4 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]">
              <p className="text-[11px] uppercase tracking-[0.1em] text-white/35">Open drift</p>
              <p className="mt-2 text-3xl font-light tracking-[-0.02em] text-zinc-50">{openDrifts}</p>
              <p className="mt-1 text-sm text-zinc-400">{healthScore}% health score</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Behavior units" value={unitList.length} detail="Registered prompt surfaces" variant="units" />
        <StatCard label="Eval runs" value={recentRuns.length} detail={recentLoading ? 'Loading live runs...' : `${activeRuns} still active`} variant="runs" />
        <StatCard label="Open drift" value={openDrifts} detail={`${healthScore}% health score`} variant="drift" />
        <StatCard label="Connected repos" value={integrationList.length} detail={`${tokenReadyCount} PATs stored securely`} variant="repos" />
      </div>

      <div className="flex flex-col gap-3 border-y border-white/10 bg-[#141414] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] text-white/35">Quick actions</p>
          <p className="mt-1 text-sm text-zinc-400">Compact toolbar for the most common workflows.</p>
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

      <div className="grid gap-6">
        <Card className="border border-[rgba(255,255,255,0.08)] bg-[#141414] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_4px_24px_rgba(0,0,0,0.4)]">
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
                <Link key={item.id} href={`/evals/${item.id}`} className="grid grid-cols-[16px_1fr_auto] items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#141414] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] transition-all duration-200 ease-out hover:border-[rgba(255,255,255,0.15)] hover:bg-[#1c1c1c]">
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
              <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[#141414] p-6 text-sm text-zinc-400">Once you sync a repo or run an eval, the feed will populate here automatically.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
