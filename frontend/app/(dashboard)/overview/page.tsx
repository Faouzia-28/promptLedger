'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useBehaviorUnits, useDriftEvents, useGitHubIntegrations, useCurrentUser } from '@/lib/hooks';
import { WebSocketClient } from '@/lib/websocket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatDateTime, shortId, truncateText } from '@/lib/dashboard';
import { Activity, BarChart3, CheckCircle2, GitBranch, PlayCircle, Plus, ShieldAlert, Sparkles, TerminalSquare, TriangleAlert, Workflow } from 'lucide-react';

function OverviewStat({ label, value, detail, icon: Icon, tone = 'default' }: {
  label: string;
  value: string | number;
  detail?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    default: 'text-primary',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    danger: 'text-rose-500',
  }[tone];

  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            {detail ? <p className="mt-2 text-sm text-muted-foreground">{detail}</p> : null}
          </div>
          <div className={`rounded-2xl border border-border bg-muted/30 p-3 ${toneClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OverviewPage() {
  const { data: units } = useBehaviorUnits();
  const { data: driftEvents, isLoading: driftLoading } = useDriftEvents();
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
        action: {
          label: 'View',
          onClick: () => window.location.href = `/drift/${notification.unit_id}`,
        },
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
              return runs.slice(0, 3).map((run: any) => ({
                ...run,
                unit_name: unit.name,
              }));
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
              .slice(0, 6)
          );
        }
      } finally {
        if (!cancelled) {
          setRecentLoading(false);
        }
      }
    };

    void loadRecentRuns();
    return () => {
      cancelled = true;
    };
  }, [unitList]);

  const healthScore = useMemo(() => {
    const openAlerts = driftEventList.filter((event: any) => !event.resolved).length;
    const total = driftEventList.length || 1;
    return Math.max(0, Math.round(100 - (openAlerts / total) * 100));
  }, [driftEventList]);

  const activeRuns = recentRuns.filter((run) => run.status === 'pending' || run.status === 'running').length;
  const averageScore = recentRuns.length
    ? recentRuns.reduce((sum, run) => sum + (Number(run.score) || 0), 0) / recentRuns.length
    : 0;

  const activityFeed = [
    ...recentRuns.slice(0, 3).map((run) => ({
      type: 'eval',
      title: `${run.unit_name || 'Unknown unit'} · ${run.status}`,
      detail: `Run ${shortId(run.id)} scored ${Number(run.score || 0).toFixed(2)}`,
      time: run.completed_at || run.created_at,
      href: `/evals/${run.id}`,
    })),
    ...driftEventList.slice(0, 3).map((event: any) => ({
      type: 'drift',
      title: `${event.unit?.name || 'Unknown unit'} · ${event.severity}`,
      detail: truncateText(event.details, 96),
      time: event.created_at,
      href: `/drift/${event.id}`,
    })),
    ...integrationList.slice(0, 2).map((integration: any) => ({
      type: 'github',
      title: integration.repo_full_name,
      detail: `${integration.default_branch} · ${integration.enabled ? 'active' : 'disabled'}`,
      time: integration.created_at,
      href: '/github',
    })),
  ].sort((left, right) => String(right.time).localeCompare(String(left.time))).slice(0, 6);

  const openDrifts = driftEventList.filter((event: any) => !event.resolved).length;
  const tokenReadyCount = integrationList.filter((integration: any) => integration.has_github_token).length;

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-slate-50 shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-slate-200">
              <Sparkles className="h-3.5 w-3.5" />
              PromptLedger command center
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Your prompt operations dashboard now has a pulse.</h1>
              <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
                See units, runs, drift, GitHub syncs, and scorer health in one place. Quick actions below take you directly to the workflows people actually use.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-white text-slate-950 hover:bg-slate-200">
                <Link href="/units"><Plus className="mr-2 h-4 w-4" />Create unit</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Link href="/github"><GitBranch className="mr-2 h-4 w-4" />Sync repository</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Link href="/templates"><TerminalSquare className="mr-2 h-4 w-4" />Edit templates</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Link href="/metrics"><BarChart3 className="mr-2 h-4 w-4" />View metrics</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 sm:min-w-[260px]">
            <div className="flex items-center justify-between gap-4">
              <span>Organization</span>
              <span className="font-medium">{user?.org_id ? shortId(user.org_id, 12) : 'unknown'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Authenticated as</span>
              <span className="font-medium truncate">{user?.email || 'unknown'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Connected repos</span>
              <span className="font-medium">{integrationList.length}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Open drift alerts</span>
              <span className="font-medium">{openDrifts}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <OverviewStat label="Behavior units" value={unitList.length} detail="Registered prompt surfaces" icon={Workflow} />
        <OverviewStat label="Eval runs" value={recentRuns.length} detail={recentLoading ? 'Loading live runs...' : `${activeRuns} still active`} icon={PlayCircle} tone="default" />
        <OverviewStat label="Open drift" value={openDrifts} detail={`${healthScore}% health score`} icon={ShieldAlert} tone={openDrifts ? 'warning' : 'success'} />
        <OverviewStat label="Connected repos" value={integrationList.length} detail={`${tokenReadyCount} PATs stored securely`} icon={GitBranch} tone={tokenReadyCount ? 'success' : 'warning'} />
        <OverviewStat label="Avg eval score" value={recentRuns.length ? averageScore.toFixed(2) : '0.00'} detail="Across the latest runs" icon={CheckCircle2} tone="success" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-border/70">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Quick actions</CardTitle>
              <CardDescription>Jump straight to the workflows that unblock debugging and review.</CardDescription>
            </div>
            <Badge variant="secondary">Live</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { href: '/units', title: 'Create or edit a unit', detail: 'Push versions and compare behavior', icon: Plus },
              { href: '/github', title: 'Manage GitHub sync', detail: 'Connect repos and run manual syncs', icon: GitBranch },
              { href: '/evals', title: 'Inspect eval runs', detail: 'Filter, expand, and re-run evaluations', icon: PlayCircle },
              { href: '/templates', title: 'Edit scoring templates', detail: 'Tune the prompt that scores outputs', icon: TerminalSquare },
              { href: '/metrics', title: 'Review metrics', detail: 'Parse failure rate, latency, and throughput', icon: BarChart3 },
              { href: '/audit', title: 'Export audit trail', detail: 'See compliance and change history', icon: Activity },
            ].map((action) => (
              <Link key={action.href} href={action.href} className="group rounded-2xl border border-border bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <action.icon className="h-4 w-4 text-primary" />
                      {action.title}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{action.detail}</p>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>System health</CardTitle>
            <CardDescription>Small but useful signals that tell you whether the pipeline is alive.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Health score</span>
                <span className="font-semibold">{healthScore}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${healthScore}%` }} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Open drift alerts</span>
                <span className="font-medium">{openDrifts}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Active evals</span>
                <span className="font-medium">{activeRuns}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">GitHub PATs</span>
                <span className="font-medium">{tokenReadyCount}</span>
              </div>
            </div>
            <Separator />
            <div className="rounded-2xl border border-dashed border-border bg-background/60 p-4 text-xs text-muted-foreground">
              The dashboard now reflects the live data path rather than a static welcome screen. If a section is still empty, the pipeline feeding it is usually the missing piece.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest evals, drift alerts, and repository syncs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activityFeed.length > 0 ? (
              activityFeed.map((item) => (
                <Link key={`${item.type}-${item.title}-${item.time}`} href={item.href} className="block rounded-2xl border border-border bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={item.type === 'drift' ? 'destructive' : item.type === 'github' ? 'secondary' : 'default'} className="capitalize">{item.type}</Badge>
                        <p className="font-medium">{item.title}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(item.time)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Once you sync a repo or run an eval, the feed will populate here automatically.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>What to check next</CardTitle>
            <CardDescription>A short operational checklist that replaces guesswork.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              'Open GitHub Sync and confirm each repository shows a real PAT state.',
              'Enter the Evals page and expand one run to verify score_raw and case details.',
              'Review scoring templates before comparing two versions.',
              'Use Metrics to confirm scorer calls and parse failures are moving the right way.',
            ].map((step, index) => (
              <div key={step} className="flex gap-3 rounded-2xl border border-border bg-muted/20 p-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</div>
                <p className="text-muted-foreground">{step}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
