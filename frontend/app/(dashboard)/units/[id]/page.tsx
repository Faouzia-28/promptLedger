'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBehaviorUnit, useBehaviorVersions } from '@/lib/hooks';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { mutate } from 'swr';
import { formatDateTime, safeJsonString, shortId, truncateText } from '@/lib/dashboard';

export default function UnitDetailPage() {
  const params = useParams<{ id: string }>();
  const unitId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { data: unit, isLoading: unitLoading } = useBehaviorUnit(unitId || '');
  const { data: versions, isLoading: versionsLoading } = useBehaviorVersions(unitId || '');

  const [pushOpen, setPushOpen] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [content, setContent] = useState('{\n  "prompt": "",\n  "response": ""\n}');
  const [config, setConfig] = useState('{\n  "temperature": 0.7,\n  "max_tokens": 1024\n}');
  const [gitCommit, setGitCommit] = useState('');
  const [gitBranch, setGitBranch] = useState('');
  const [error, setError] = useState('');
  const [activeVersionId, setActiveVersionId] = useState('');
  const [leftVersionId, setLeftVersionId] = useState('');
  const [rightVersionId, setRightVersionId] = useState('');
  const [versionSort, setVersionSort] = useState<'newest' | 'oldest' | 'number'>('newest');
  const [normalizedViewerOpen, setNormalizedViewerOpen] = useState(false);
  const [normalizedViewerVersionId, setNormalizedViewerVersionId] = useState('');
  const [evalRunOpen, setEvalRunOpen] = useState(false);
  const [evalSets, setEvalSets] = useState<any[]>([]);
  const [selectedEvalSetId, setSelectedEvalSetId] = useState('');
  const [createNewEvalSet, setCreateNewEvalSet] = useState(false);
  const [evalName, setEvalName] = useState('Smoke Test Set');
  const [evalCases, setEvalCases] = useState(`[
  {"input": "Say hello", "expected_output": "A friendly greeting", "criteria": "friendly"},
  {"input": "Refuse a harmful request", "expected_output": "A refusal", "criteria": "safe refusal"}
]`);
  const [evalVersionId, setEvalVersionId] = useState('');
  const [deployingVersionId, setDeployingVersionId] = useState('');
  const [evalError, setEvalError] = useState('');
  const [evalRuns, setEvalRuns] = useState<any[]>([]);
  const [loadingEvalRuns, setLoadingEvalRuns] = useState(false);
  const [diffResult, setDiffResult] = useState<any>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState('');

  const sortedVersions = useMemo(() => {
    const list = [...(versions || [])];
    if (versionSort === 'number') {
      return list.sort((left, right) => Number(left.version_number) - Number(right.version_number));
    }
    if (versionSort === 'oldest') {
      return list.sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)));
    }
    return list.sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
  }, [versions, versionSort]);

  const evalSetById = useMemo(() => new Map(evalSets.map((item: any) => [item.id, item])), [evalSets]);

  useEffect(() => {
    const latestVersion = unit?.latest_version;
    if (latestVersion?.content) {
      setContent(JSON.stringify(latestVersion.content, null, 2));
    }
    if (latestVersion?.config) {
      setConfig(JSON.stringify(latestVersion.config, null, 2));
    }
  }, [unit?.latest_version]);

  useEffect(() => {
    if (sortedVersions.length > 0) {
      if (!activeVersionId) {
        setActiveVersionId(sortedVersions[0].id);
      }
      if (!rightVersionId) {
        setRightVersionId(sortedVersions[0].id);
      }
      if (!leftVersionId) {
        setLeftVersionId(sortedVersions[1]?.id || sortedVersions[0].id);
      }
      if (!evalVersionId) {
        setEvalVersionId(sortedVersions[0].id);
      }
      if (!normalizedViewerVersionId) {
        setNormalizedViewerVersionId(sortedVersions[0].id);
      }
    }
  }, [sortedVersions, activeVersionId, leftVersionId, rightVersionId, evalVersionId, normalizedViewerVersionId]);

  useEffect(() => {
    if (!unitId) return;

    const loadEvalSets = async () => {
      try {
        const response = await api.get('/evals/sets');
        const sets = (response.data || []).filter((evalSet: any) => evalSet.unit_id === unitId);
        setEvalSets(sets);
        if (sets.length > 0 && !selectedEvalSetId) {
          setSelectedEvalSetId(sets[0].id);
        }
      } catch {
        setEvalSets([]);
      }
    };

    const loadEvalRuns = async () => {
      setLoadingEvalRuns(true);
      try {
        const response = await api.get(`/evals/units/${unitId}/runs`);
        setEvalRuns(response.data || []);
      } catch {
        setEvalRuns([]);
      } finally {
        setLoadingEvalRuns(false);
      }
    };

    void loadEvalSets();
    void loadEvalRuns();

    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get(`/evals/units/${unitId}/runs`);
        const runs = response.data || [];
        setEvalRuns(runs);
        const hasPending = runs.some((run: any) => run.status === 'pending' || run.status === 'running');
        if (!hasPending) {
          clearInterval(pollInterval);
        }
      } catch {
        // keep polling on transient errors
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [unitId, selectedEvalSetId]);

  useEffect(() => {
    if (evalSets.length > 0 && !selectedEvalSetId) {
      setSelectedEvalSetId(evalSets[0].id);
    }
  }, [evalSets, selectedEvalSetId]);

  const activeVersion = sortedVersions.find((version: any) => version.id === activeVersionId) || sortedVersions[0];
  const leftVersion = sortedVersions.find((version: any) => version.id === leftVersionId);
  const rightVersion = sortedVersions.find((version: any) => version.id === rightVersionId);
  const normalizedViewerVersion = sortedVersions.find((version: any) => version.id === normalizedViewerVersionId);

  const handlePushVersion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!unitId) return;

    setPushing(true);
    setError('');

    try {
      const parsedContent = JSON.parse(content);
      const parsedConfig = config.trim() ? JSON.parse(config) : null;

      await api.post(`/units/${unitId}/versions`, {
        content: parsedContent,
        config: parsedConfig,
        git_commit: gitCommit || null,
        git_branch: gitBranch || null,
      });

      await Promise.all([mutate(`/units/${unitId}`), mutate(`/units/${unitId}/versions`)]);
      setPushOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to create version');
    } finally {
      setPushing(false);
    }
  };

  const handleDeployVersion = async (versionId: string) => {
    if (!unitId) return;

    setDeployingVersionId(versionId);
    setError('');

    try {
      await api.post(`/units/${unitId}/versions/${versionId}/deploy`);
      await Promise.all([mutate(`/units/${unitId}`), mutate(`/units/${unitId}/versions`)]);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to deploy version');
    } finally {
      setDeployingVersionId('');
    }
  };

  const handleCreateAndRunEval = async () => {
    if (!unitId) {
      setEvalError('Unit ID missing');
      return;
    }
    if (!evalVersionId) {
      setEvalError('Please select a version to run against');
      return;
    }

    setEvalError('');

    try {
      let evalSetId = selectedEvalSetId;

      if (createNewEvalSet || !evalSetId) {
        const parsedCases = JSON.parse(evalCases);
        if (!Array.isArray(parsedCases) || parsedCases.length === 0) {
          setEvalError('Cases must be a non-empty JSON array');
          return;
        }

        const createdSet = await api.post('/evals/sets', {
          unit_id: unitId,
          name: evalName,
          cases: parsedCases,
        });

        evalSetId = createdSet.data.id;
        const refreshedSets = await api.get('/evals/sets');
        setEvalSets((refreshedSets.data || []).filter((evalSet: any) => evalSet.unit_id === unitId));
        setSelectedEvalSetId(evalSetId);
      }

      if (!evalSetId) {
        setEvalError('Please choose an eval set or create a new one');
        return;
      }

      await api.post('/evals/runs', null, {
        params: {
          version_id: evalVersionId,
          eval_set_id: evalSetId,
        },
      });

      const refreshedRuns = await api.get(`/evals/units/${unitId}/runs`);
      setEvalRuns(refreshedRuns.data || []);
      setEvalRunOpen(false);
    } catch (err: any) {
      setEvalError(err.response?.data?.detail || err.message || 'Failed to create or run eval set');
    }
  };

  const handleRunSemanticDiff = async () => {
    if (!unitId || !leftVersion || !rightVersion) {
      setDiffError('Select two versions first');
      return;
    }

    if (!selectedEvalSetId && evalSets.length === 0) {
      setDiffError('Create an eval set first to run semantic diff');
      return;
    }

    setDiffLoading(true);
    setDiffError('');

    try {
      const response = await api.get(`/units/${unitId}/diff/${leftVersion.version_number}/${rightVersion.version_number}`, {
        params: selectedEvalSetId ? { eval_set_id: selectedEvalSetId } : undefined,
      });
      setDiffResult(response.data?.semantic_diff || null);
    } catch (err: any) {
      setDiffError(err.response?.data?.detail || err.message || 'Failed to compute semantic diff');
    } finally {
      setDiffLoading(false);
    }
  };

  if (unitLoading) {
    return <Skeleton className="w-full h-96" />;
  }

  if (!unit) {
    return <Card className="p-6 text-center text-muted-foreground">Unit not found</Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{unit.name}</h1>
        <p className="text-muted-foreground">{unit.description}</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="diff">Diff</TabsTrigger>
          <TabsTrigger value="evals">Eval Results</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Unit Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium capitalize">{unit.unit_type || unit.type || 'llm'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{unit.status || 'healthy'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium text-sm">{formatDateTime(unit.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Versions</p>
                <p className="font-medium">{unit.version_count || 0}</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          <Card className="p-6">
            <div className="flex flex-col gap-4 mb-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="font-semibold">Versions</h3>
                <p className="text-sm text-muted-foreground">Normalize, sort, and inspect versions without forcing the JSON open on first render.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="space-y-1">
                  <Label htmlFor="version-sort" className="text-xs uppercase tracking-wide text-muted-foreground">Sort</Label>
                  <select
                    id="version-sort"
                    value={versionSort}
                    onChange={(e) => setVersionSort(e.target.value as 'newest' | 'oldest' | 'number')}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="number">Version number</option>
                  </select>
                </div>
                <Button onClick={() => setPushOpen(true)}>Push Version</Button>
              </div>
            </div>

            {versionsLoading ? (
              <Skeleton className="h-40" />
            ) : sortedVersions.length > 0 ? (
              <div className="space-y-3">
                {sortedVersions.map((v: any) => (
                  <div key={v.id} className={`rounded-2xl border p-4 transition-colors ${activeVersionId === v.id ? 'border-primary bg-muted/40' : 'border-border'}`}>
                    <button
                      type="button"
                      onClick={() => setActiveVersionId(v.id)}
                      className="w-full flex items-center justify-between gap-4 text-left"
                    >
                      <div>
                        <p className="font-medium">Version {v.version_number}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(v.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground capitalize">{v.status}</p>
                        <p className="text-xs text-muted-foreground">{v.source_provider || 'manual'} · {shortId(v.git_commit, 10)}</p>
                      </div>
                    </button>

                    {activeVersionId === v.id && (
                      <div className="mt-4 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Branch</p>
                            <p className="font-medium">{v.git_branch || '-'}</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Commit</p>
                            <p className="font-medium">{v.git_commit || '-'}</p>
                          </div>
                        </div>

                        <div className="space-y-2 rounded-2xl border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
                          <p className="font-medium text-foreground">Normalized content hidden by default</p>
                          <p>Open the viewer if you want to inspect the canonical version payload.</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => handleDeployVersion(v.id)} disabled={deployingVersionId === v.id}>
                            {deployingVersionId === v.id ? 'Deploying...' : 'Deploy'}
                          </Button>
                          <Button variant="outline" onClick={() => {
                            setEvalVersionId(v.id);
                            setEvalRunOpen(true);
                          }}>
                            Run Eval
                          </Button>
                          <Button variant="outline" onClick={() => {
                            setNormalizedViewerVersionId(v.id);
                            setNormalizedViewerOpen(true);
                          }}>
                            View normalized content
                          </Button>
                          <Button variant="outline" onClick={() => setLeftVersionId(v.id)}>
                            Use for Diff
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No versions yet</p>
            )}
          </Card>

          <Dialog open={pushOpen} onOpenChange={setPushOpen}>
            <DialogContent>
              <form onSubmit={handlePushVersion} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Push Version</DialogTitle>
                </DialogHeader>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="space-y-2">
                  <Label htmlFor="version-content">Content JSON</Label>
                  <Textarea id="version-content" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-40 font-mono text-sm" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="version-config">Config JSON</Label>
                  <Textarea id="version-config" value={config} onChange={(e) => setConfig(e.target.value)} className="min-h-32 font-mono text-sm" />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="git-branch">Git Branch</Label>
                    <Input id="git-branch" value={gitBranch} onChange={(e) => setGitBranch(e.target.value)} placeholder="main" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="git-commit">Git Commit</Label>
                    <Input id="git-commit" value={gitCommit} onChange={(e) => setGitCommit(e.target.value)} placeholder="abc1234" />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setPushOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={pushing}>{pushing ? 'Pushing...' : 'Push Version'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="diff" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="font-semibold">Version Diff</h3>
              <p className="text-sm text-muted-foreground">Compare content and behavioral shift between two saved versions</p>
            </div>

            {sortedVersions.length > 1 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="left-version">Left Version</Label>
                    <select id="left-version" value={leftVersionId} onChange={(e) => setLeftVersionId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground">
                      {sortedVersions.map((version: any) => <option key={version.id} value={version.id}>Version {version.version_number}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="right-version">Right Version</Label>
                    <select id="right-version" value={rightVersionId} onChange={(e) => setRightVersionId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground">
                      {sortedVersions.map((version: any) => <option key={version.id} value={version.id}>Version {version.version_number}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 items-end md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="diff-eval-set">Semantic Diff Eval Set</Label>
                    <select id="diff-eval-set" value={selectedEvalSetId} onChange={(e) => setSelectedEvalSetId(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground">
                      <option value="">Use latest eval set for this unit</option>
                      {evalSets.map((evalSet: any) => <option key={evalSet.id} value={evalSet.id}>{evalSet.name} ({evalSet.cases?.length || 0} cases)</option>)}
                    </select>
                  </div>
                  <Button onClick={handleRunSemanticDiff} disabled={diffLoading || !leftVersion || !rightVersion}>
                    {diffLoading ? 'Analyzing...' : 'Analyze Semantic Diff'}
                  </Button>
                </div>

                {diffError && <p className="text-sm text-destructive">{diffError}</p>}

                {diffResult && (
                  <div className="space-y-4 rounded-2xl border border-border bg-background/60 p-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div><p className="text-xs text-muted-foreground">Embedding Distance</p><p className="text-lg font-semibold">{Number(diffResult.embedding_distance || 0).toFixed(4)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Refusal Delta</p><p className="text-lg font-semibold">{Number(diffResult.refusal_rate_delta || 0).toFixed(2)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Length Delta</p><p className="text-lg font-semibold">{Number(diffResult.length_delta || 0).toFixed(1)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Samples Compared</p><p className="text-lg font-semibold">{diffResult.samples_compared || 0}</p></div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Behavioral Summary</p>
                      <p className="text-sm text-muted-foreground">{diffResult.summary}</p>
                    </div>

                    {diffResult.judge_scores && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Judge Scores</p>
                        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                          {Object.entries(diffResult.judge_scores).map(([key, value]) => (
                            <div key={key} className="rounded border border-border p-3">
                              <p className="text-muted-foreground capitalize">{key}</p>
                              <p className="font-semibold">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Left</p>
                    <pre className="min-h-56 overflow-auto rounded border border-border bg-background p-3 text-xs whitespace-pre-wrap">{safeJsonString(leftVersion?.content || {}, 2)}</pre>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Right</p>
                    <pre className="min-h-56 overflow-auto rounded border border-border bg-background p-3 text-xs whitespace-pre-wrap">{safeJsonString(rightVersion?.content || {}, 2)}</pre>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Create at least two versions to compare them here.</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="evals" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-semibold">Evaluation Results</h3>
                <p className="text-sm text-muted-foreground">Expand a run to see per-case inputs, outputs, scores, raw scorer text, and parse errors.</p>
              </div>
              <Button onClick={() => setEvalRunOpen(true)}>Create Eval Set</Button>
            </div>

            {loadingEvalRuns ? (
              <Skeleton className="h-28" />
            ) : evalRuns.length > 0 ? (
              <div className="space-y-3">
                {evalRuns.map((run: any) => {
                  const evalSetName = evalSetById.get(run.eval_set_id)?.name || shortId(run.eval_set_id, 8);
                  return (
                    <details key={run.id} className="rounded-2xl border border-border bg-muted/15 p-4">
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="font-medium">{evalSetName} · Run #{run.id.slice(0, 8)}</p>
                            <p className="text-xs text-muted-foreground">Created {formatDateTime(run.created_at)} · Triggered by {run.triggered_by}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold capitalize ${run.status === 'passed' ? 'text-emerald-500' : run.status === 'degraded' ? 'text-amber-500' : run.status === 'failed' ? 'text-rose-500' : 'text-gray-600'}`}>{run.status}</p>
                            <p className="text-sm font-medium">Score: {run.score != null ? Number(run.score).toFixed(2) : 'n/a'}</p>
                          </div>
                        </div>
                      </summary>

                      <div className="mt-4 space-y-3 border-t border-border pt-4">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            setEvalVersionId(run.version_id);
                            setEvalRunOpen(true);
                          }}>Re-run version</Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setNormalizedViewerVersionId(sortedVersions.find((version: any) => version.id === run.version_id)?.id || normalizedViewerVersionId);
                            setNormalizedViewerOpen(true);
                          }}>Open version payload</Button>
                        </div>

                        {Array.isArray(run.results) && run.results.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">Test Cases</p>
                            {run.results.map((result: any, idx: number) => (
                              <details key={idx} className={`rounded-xl border p-3 text-xs ${result.passed ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                                <summary className="cursor-pointer list-none">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <p className="font-medium">{result.passed ? '✓' : '✗'} Case {idx + 1}</p>
                                      <p className="text-xs text-muted-foreground">{truncateText(result.input, 72)}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Score {Number(result.score || 0).toFixed(2)}</p>
                                  </div>
                                </summary>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  <CasePanel label="Input" value={result.input} />
                                  <CasePanel label="Expected" value={result.expected} />
                                  <CasePanel label="Actual" value={result.actual} />
                                  <CasePanel label="Score raw" value={result.score_raw} />
                                </div>
                                {result.error ? <p className="mt-2 text-xs text-destructive">Error: {result.error}</p> : null}
                              </details>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No per-case results yet.</p>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground">No evaluation runs yet. Create an eval set to run this version.</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={evalRunOpen} onOpenChange={setEvalRunOpen}>
        <DialogContent>
          <div className="flex flex-col">
            <DialogHeader>
              <DialogTitle>Run Eval</DialogTitle>
            </DialogHeader>

            <div className="max-h-[350px] flex-1 space-y-4 overflow-y-auto px-1">
              {evalError && <p className="text-sm text-destructive">{evalError}</p>}

              <div className="space-y-2">
                <Label htmlFor="eval-set">Eval Set</Label>
                <select
                  id="eval-set"
                  value={selectedEvalSetId}
                  onChange={(e) => {
                    setSelectedEvalSetId(e.target.value);
                    setCreateNewEvalSet(false);
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
                >
                  <option value="">Create a new eval set</option>
                  {evalSets.map((evalSet: any) => (
                    <option key={evalSet.id} value={evalSet.id}>
                      {evalSet.name} ({evalSet.cases?.length || 0} cases)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="create-new-eval-set"
                  type="checkbox"
                  checked={createNewEvalSet || !selectedEvalSetId}
                  onChange={(e) => setCreateNewEvalSet(e.target.checked)}
                />
                <Label htmlFor="create-new-eval-set" className="cursor-pointer">
                  Create a new eval set instead of reusing an existing one
                </Label>
              </div>

              {(createNewEvalSet || !selectedEvalSetId) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="eval-name">Eval Set Name</Label>
                    <Input id="eval-name" value={evalName} onChange={(e) => setEvalName(e.target.value)} placeholder="Smoke Test Set" required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="eval-cases">Cases JSON</Label>
                    <Textarea id="eval-cases" value={evalCases} onChange={(e) => setEvalCases(e.target.value)} className="min-h-48 font-mono text-sm" required />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="eval-version">Run Against Version</Label>
                <select
                  id="eval-version"
                  value={evalVersionId}
                  onChange={(e) => setEvalVersionId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
                >
                  {sortedVersions.map((version: any) => (
                    <option key={version.id} value={version.id}>
                      Version {version.version_number}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEvalRunOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handleCreateAndRunEval}>{createNewEvalSet || !selectedEvalSetId ? 'Create Eval Set & Run' : 'Run Eval Set'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={normalizedViewerOpen} onOpenChange={setNormalizedViewerOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Normalized content viewer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              This viewer stays hidden until you explicitly open it. It shows the canonical version payload rather than the collapsed list card.
            </div>
            <div className="space-y-2">
              <Label>Selected version</Label>
              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">Version {normalizedViewerVersion?.version_number || '-'} · {normalizedViewerVersion?.source_provider || 'manual'}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="normalized-content">Normalized content</Label>
              <Textarea id="normalized-content" value={safeJsonString(normalizedViewerVersion?.content || activeVersion?.content || {}, 2)} readOnly className="min-h-72 font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="normalized-config">Model config</Label>
              <Textarea id="normalized-config" value={safeJsonString(normalizedViewerVersion?.model_config || activeVersion?.model_config || {}, 2)} readOnly className="min-h-40 font-mono text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNormalizedViewerOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CasePanel({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap text-xs">{safeJsonString(value, 2)}</pre>
    </div>
  );
}
