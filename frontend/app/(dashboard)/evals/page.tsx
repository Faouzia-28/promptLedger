'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Filter, PlayCircle, Search, Shuffle, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { useBehaviorUnits } from '@/lib/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, shortId, truncateText } from '@/lib/dashboard';

export default function EvalsPage() {
  const { data: units } = useBehaviorUnits();
  const [runs, setRuns] = useState<any[]>([]);
  const [evalSets, setEvalSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [setsResponse, runResponses] = await Promise.all([
          api.get('/evals/sets').catch(() => ({ data: [] })),
          Promise.all((units || []).map(async (unit: any) => {
            try {
              const response = await api.get(`/evals/units/${unit.id}/runs`);
              return (response.data || []).map((run: any) => ({ ...run, unit_id: unit.id, unit_name: unit.name }));
            } catch {
              return [];
            }
          })),
        ]);

        if (!cancelled) {
          setEvalSets(setsResponse.data || []);
          setRuns(runResponses.flat().sort((left, right) => String(right.created_at).localeCompare(String(left.created_at))));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [units]);

  const enrichedRuns = useMemo(() => {
    const setMap = new Map(evalSets.map((evalSet: any) => [evalSet.id, evalSet]));
    return runs.map((run: any) => ({
      ...run,
      eval_set_name: setMap.get(run.eval_set_id)?.name || shortId(run.eval_set_id),
      case_count: setMap.get(run.eval_set_id)?.cases?.length || (Array.isArray(run.results) ? run.results.length : 0),
    }));
  }, [runs, evalSets]);

  const filteredRuns = enrichedRuns.filter((run) => {
    const searchable = [run.unit_name, run.eval_set_name, run.status, run.id, run.version_id].join(' ').toLowerCase();
    if (search && !searchable.includes(search.toLowerCase())) return false;
    if (unitFilter !== 'all' && run.unit_id !== unitFilter) return false;
    if (statusFilter !== 'all' && run.status !== statusFilter) return false;
    return true;
  });

  const totals = {
    total: filteredRuns.length,
    pending: filteredRuns.filter((run) => run.status === 'pending' || run.status === 'running').length,
    passed: filteredRuns.filter((run) => run.status === 'passed').length,
    degraded: filteredRuns.filter((run) => run.status === 'degraded').length,
  };

  const exportCsv = () => {
    const rows = [
      ['run_id', 'unit', 'eval_set', 'status', 'score', 'created_at', 'completed_at'],
      ...filteredRuns.map((run) => [
        run.id,
        run.unit_name || '',
        run.eval_set_name || '',
        run.status || '',
        String(run.score ?? ''),
        String(run.created_at || ''),
        String(run.completed_at || ''),
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `eval-runs-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${filteredRuns.length} runs to CSV.`);
  };

  const scoreTone = (score: number | null | undefined) => {
    const value = Number(score ?? 0);
    if (value >= 0.8) return 'emerald';
    if (value >= 0.5) return 'amber';
    return 'rose';
  };

  const scoreBadgeClass = (score: number | null | undefined) => {
    const tone = scoreTone(score);
    return tone === 'emerald'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
      : tone === 'amber'
        ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
        : 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  };

  const statusBadgeClass = (status: string) => {
    if (status === 'failed') return 'border border-red-400/20 bg-red-400/10 text-red-400';
    if (status === 'passed') return 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    if (status === 'degraded') return 'border border-amber-500/20 bg-amber-500/10 text-amber-300';
    return 'border border-zinc-700 bg-zinc-900 text-zinc-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evals</h1>
          <p className="text-muted-foreground">Filter by unit, inspect run-level details, and export the current slice when you need to share results.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSearch('')}>
            <Shuffle className="mr-2 h-4 w-4" />Reset filters
          </Button>
          <Button onClick={exportCsv} disabled={filteredRuns.length === 0}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
        </div>
      </div>

      {message && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4 text-sm">{message}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Visible runs" value={totals.total} detail="After filters" tone="neutral" />
        <MetricCard label="Pending" value={totals.pending} detail="Waiting or running" tone="neutral" />
        <MetricCard label="Passed" value={totals.passed} detail="Run status passed" tone="good" />
        <MetricCard label="Degraded" value={totals.degraded} detail="Needs review" tone="warning" />
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary" />Filters</CardTitle>
          <CardDescription>Use a couple of filters at a time so the run list stays readable.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="search" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Unit, eval set, run id..." />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit-filter">Behavior unit</Label>
            <select id="unit-filter" value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="all">All units</option>
              {(units || []).map((unit: any) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status-filter">Status</Label>
            <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="passed">Passed</option>
              <option value="degraded">Degraded</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Eval run index</CardTitle>
          <CardDescription>Every row links to a detailed run page with per-case outputs, scores, and notes.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : filteredRuns.length > 0 ? (
            <div className="space-y-3">
              {filteredRuns.map((run) => {
                const score = Number(run.score ?? 0);
                return (
                  <Link key={run.id} href={`/evals/${run.id}`} className="block rounded-3xl border border-zinc-700 bg-zinc-900/60 p-5 transition-colors hover:bg-zinc-800/50 hover:border-zinc-600">
                    <div className="space-y-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-zinc-100">{run.unit_name || 'Unknown unit'}</p>
                          <Badge variant="secondary" className="border-zinc-700 bg-zinc-800 text-zinc-100">{run.eval_set_name}</Badge>
                          <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-100">Version {shortId(run.version_id, 6)}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(run.status)}`}>
                            {run.status === 'failed' ? 'Failed' : run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${scoreBadgeClass(score)}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${scoreTone(score) === 'emerald' ? 'bg-emerald-300' : scoreTone(score) === 'amber' ? 'bg-amber-300' : 'bg-rose-300'}`} />
                            Score {score.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span className="font-mono text-zinc-300">Run {shortId(run.id)}</span>
                        <span>· {run.case_count} cases</span>
                        <span>· created {formatDateTime(run.created_at)}</span>
                      </div>

                      <div className="max-w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-200">
                        <div className="truncate">
                          {Array.isArray(run.results) && run.results.length > 0
                            ? truncateText(run.results[0]?.score_raw || run.results[0]?.actual || run.results[0]?.input || 'No case preview available', 180)
                            : 'No case details attached yet.'}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No runs match the current filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, detail, tone = 'neutral' }: { label: string; value: string | number; detail: string; tone?: 'neutral' | 'good' | 'warning' | 'error'; }) {
  const accent = tone === 'good' ? 'border-l-emerald-500' : tone === 'warning' ? 'border-l-amber-500' : tone === 'error' ? 'border-l-rose-500' : 'border-l-sky-500';
  return (
    <Card className={`border border-zinc-700 bg-[#1a1d27] ${accent} border-l-4`}>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-4xl font-bold tracking-tight text-zinc-50">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
