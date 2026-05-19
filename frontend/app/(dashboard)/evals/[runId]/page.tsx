'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Download, Edit3, Flag, Loader2, Save, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { useBehaviorUnits } from '@/lib/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime, safeJsonString, shortId } from '@/lib/dashboard';

const NOTES_KEY_PREFIX = 'promptledger.eval-run.notes.';

type RunNotes = {
  reviewed: boolean;
  overrideScore: string;
  notes: string;
};

export default function EvalRunDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = Array.isArray(params?.runId) ? params.runId[0] : params?.runId;
  const { data: units } = useBehaviorUnits();
  const [run, setRun] = useState<any | null>(null);
  const [evalSets, setEvalSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<RunNotes>({ reviewed: false, overrideScore: '', notes: '' });

  useEffect(() => {
    if (!runId) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [runResponse, setsResponse] = await Promise.all([
          api.get(`/evals/runs/${runId}`),
          api.get('/evals/sets').catch(() => ({ data: [] })),
        ]);
        setRun(runResponse.data);
        setEvalSets(setsResponse.data || []);

        if (typeof window !== 'undefined') {
          const stored = window.localStorage.getItem(`${NOTES_KEY_PREFIX}${runId}`);
          if (stored) {
            setNotes(JSON.parse(stored) as RunNotes);
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load evaluation run');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [runId]);

  const unitName = useMemo(() => {
    const versionUnit = (units || []).find((unit: any) => unit.versions?.some((version: any) => version.id === run?.version_id));
    if (versionUnit) return versionUnit.name;
    return (units || []).find((unit: any) => unit.id === run?.unit_id)?.name || 'Unknown unit';
  }, [run?.unit_id, run?.version_id, units]);

  const evalSet = useMemo(() => evalSets.find((item: any) => item.id === run?.eval_set_id), [evalSets, run?.eval_set_id]);

  const currentScore = notes.overrideScore.trim() !== '' ? Number(notes.overrideScore) : Number(run?.score ?? 0);
  const results = Array.isArray(run?.results) ? run.results : [];

  const saveNotes = (nextNotes: RunNotes) => {
    setNotes(nextNotes);
    if (typeof window !== 'undefined' && runId) {
      window.localStorage.setItem(`${NOTES_KEY_PREFIX}${runId}`, JSON.stringify(nextNotes));
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ run, notes }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `eval-run-${shortId(runId || 'run', 12)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const rows = [
      ['case_index', 'input', 'expected', 'actual', 'score', 'passed', 'score_raw'],
      ...results.map((result: any) => [
        result.case_index,
        result.input || '',
        result.expected || '',
        result.actual || '',
        String(result.score ?? ''),
        String(Boolean(result.passed)),
        result.score_raw || '',
      ]),
    ];
    const csv = rows.map((row) => row.map((value: any) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `eval-run-${shortId(runId || 'run', 12)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const regrade = async () => {
    if (!run) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await api.post('/evals/runs', null, {
        params: {
          version_id: run.version_id,
          eval_set_id: run.eval_set_id,
        },
      });
      setMessage('Regrade queued. Refresh this page after the worker finishes.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to queue regrade');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!run) {
    return <Card className="border border-[rgba(255,255,255,0.08)] bg-[#141414] p-6 text-center text-zinc-400 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_4px_24px_rgba(0,0,0,0.4)]">Run not found</Card>;
  }

  const statusTone = run.status === 'passed' ? 'text-emerald-500' : run.status === 'degraded' ? 'text-amber-500' : run.status === 'failed' ? 'text-rose-500' : 'text-muted-foreground';

  return (
    <div className="space-y-8 bg-[#0a0a0a] text-zinc-100">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link
            href="/evals"
            className="inline-flex w-fit items-center rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-sm font-medium text-zinc-100 transition-all duration-200 ease-out hover:border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.08)]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to evals
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Eval run detail</h1>
            <p className="text-zinc-400">{unitName} · {evalSet?.name || 'Unnamed eval set'} · Run {shortId(run.id)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{run.status}</Badge>
          <Badge variant="outline">Score {currentScore.toFixed(2)}</Badge>
          {notes.reviewed ? <Badge variant="default"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Reviewed</Badge> : <Badge variant="outline">Not reviewed</Badge>}
        </div>
      </div>

      {(message || error) && (
        <Card className={error ? 'border border-red-400/20 bg-red-400/10' : 'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)]'}>
          <CardContent className="p-4 text-sm">
            <p className={error ? 'text-red-300' : 'text-zinc-100'}>{error || message}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Cases" value={results.length} detail="Total test cases in the set" />
        <StatCard label="Passed" value={results.filter((result: any) => result.passed).length} detail="Cases above threshold" tone="success" />
        <StatCard label="Failed" value={results.filter((result: any) => !result.passed).length} detail="Cases below threshold" tone="warning" />
        <StatCard label="Completed" value={run.completed_at ? 'Yes' : 'No'} detail={formatDateTime(run.completed_at || run.created_at)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.78fr]">
        <Card className="border border-[rgba(255,255,255,0.08)] bg-[#141414] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_4px_24px_rgba(0,0,0,0.4)]">
          <CardHeader>
            <CardTitle>Per-case results</CardTitle>
            <CardDescription>Expand each case to inspect input, output, score, score_raw, and parse errors.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="cases" className="w-full">
              <TabsList>
                <TabsTrigger value="cases">Cases</TabsTrigger>
                <TabsTrigger value="raw">Raw run JSON</TabsTrigger>
              </TabsList>
              <TabsContent value="cases" className="mt-4 space-y-3">
                {results.length > 0 ? results.map((result: any, index: number) => (
                  <details key={`${result.case_index}-${index}`} className="group rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]">
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-medium">Case {index + 1}</p>
                          <p className="text-xs text-zinc-400">{truncateValue(result.input)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={result.passed ? 'default' : 'destructive'}>{result.passed ? 'Passed' : 'Failed'}</Badge>
                          <span className={`text-sm font-semibold ${result.score >= 0.7 ? 'text-emerald-400' : 'text-zinc-400'}`}>{Number(result.score || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </summary>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <CasePanel label="Input" value={result.input} />
                      <CasePanel label="Expected" value={result.expected} />
                      <CasePanel label="Actual" value={result.actual} />
                      <CasePanel label="Score raw" value={result.score_raw} />
                    </div>
                    {result.error ? <p className="mt-3 text-sm text-red-300">Parse/runtime error: {result.error}</p> : null}
                  </details>
                )) : (
                  <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.08)] p-6 text-sm text-zinc-400">No per-case results yet.</div>
                )}
              </TabsContent>
              <TabsContent value="raw" className="mt-4">
                <pre className="max-h-[42rem] overflow-auto rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 text-xs leading-relaxed text-zinc-100 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]">{safeJsonString(run, 2)}</pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border border-[rgba(255,255,255,0.08)] bg-[#141414] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_4px_24px_rgba(0,0,0,0.4)]">
          <CardHeader>
            <CardTitle>Manual actions</CardTitle>
            <CardDescription>Some operations are browser-local until the backend grows persistent review fields.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 space-y-3 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]">
              <Button onClick={regrade} disabled={busy} className="w-full rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-zinc-100 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] transition-all duration-200 ease-out hover:border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.08)]">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Regrade this run
              </Button>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={exportJson} className="soft-glow soft-glow-strong"><Download className="mr-2 h-4 w-4 glow-icon" />Export JSON</Button>
                <Button variant="outline" onClick={exportCsv} className="soft-glow soft-glow-strong"><Download className="mr-2 h-4 w-4 glow-icon" />Export CSV</Button>
              </div>
            </div>

            <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 space-y-3 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Review state</p>
                  <p className="text-xs text-zinc-400">Store notes locally until a dedicated backend field exists.</p>
                </div>
                <Button size="sm" variant={notes.reviewed ? 'default' : 'outline'} onClick={() => saveNotes({ ...notes, reviewed: !notes.reviewed })}>
                  {notes.reviewed ? 'Reviewed' : 'Mark reviewed'}
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="override-score">Force override score</Label>
                <Input id="override-score" type="number" min="0" max="1" step="0.01" value={notes.overrideScore} onChange={(e) => saveNotes({ ...notes, overrideScore: e.target.value, reviewed: notes.reviewed, notes: notes.notes })} placeholder="0.85" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="developer-notes">Developer notes</Label>
                <Textarea id="developer-notes" value={notes.notes} onChange={(e) => saveNotes({ ...notes, notes: e.target.value, reviewed: notes.reviewed, overrideScore: notes.overrideScore })} className="min-h-36" placeholder="Why this run is interesting, what failed, what to re-check." />
              </div>
              <Button variant="outline" onClick={() => saveNotes({ reviewed: false, overrideScore: '', notes: '' })}>
                <Edit3 className="mr-2 h-4 w-4" />Clear notes
              </Button>
            </div>

            <div className="rounded-2xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 text-sm text-zinc-400 space-y-2">
              <p className="font-medium text-zinc-100">Run metadata</p>
              <p>Triggered by: {run.triggered_by}</p>
              <p>Version: {shortId(run.version_id, 12)}</p>
              <p>Eval set: {shortId(run.eval_set_id, 12)}</p>
              <p>Created: {formatDateTime(run.created_at)}</p>
              <p>Completed: {formatDateTime(run.completed_at)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, detail, tone = 'default' }: { label: string; value: string | number; detail: string; tone?: 'default' | 'success' | 'warning'; }) {
  const toneClass = tone === 'success' ? 'text-emerald-500' : tone === 'warning' ? 'text-amber-500' : 'text-primary';
  return (
    <Card className="border border-[rgba(255,255,255,0.08)] bg-[#141414] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_4px_24px_rgba(0,0,0,0.4)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.1em] text-white/35">{label}</p>
            <p className="mt-2 text-[2.75rem] font-light tracking-[-0.02em] text-zinc-50">{value}</p>
            <p className="mt-2 text-sm text-zinc-400">{detail}</p>
          </div>
          <div className={`rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-3 ${toneClass}`}>
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CasePanel({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]">
      <p className="text-[11px] uppercase tracking-[0.1em] text-white/35">{label}</p>
      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-relaxed">{safeJsonString(value, 2)}</pre>
    </div>
  );
}

function truncateValue(value: unknown) {
  const text = typeof value === 'string' ? value : safeJsonString(value, 0);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
