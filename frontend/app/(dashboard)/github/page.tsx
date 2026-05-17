'use client';

import { useMemo, useState } from 'react';
import { mutate } from 'swr';
import { ChevronDown, ExternalLink, GitBranch, Loader2, Plus, RefreshCw, PencilLine } from 'lucide-react';
import api from '@/lib/api';
import { useBehaviorUnits, useGitHubIntegrations } from '@/lib/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, toLines } from '@/lib/dashboard';

function Chip({ active, activeText, inactiveText, activeClass, inactiveClass }: { active: boolean; activeText: string; inactiveText: string; activeClass: string; inactiveClass: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${active ? activeClass : inactiveClass}`}>{active ? activeText : inactiveText}</span>;
}

function RepoBadges({ hasToken, enabled, linkedName }: { hasToken: boolean; enabled: boolean; linkedName?: string | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip
        active={hasToken}
        activeText="PAT stored"
        inactiveText="PAT missing"
        activeClass="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
        inactiveClass="border-red-400/20 bg-red-400/10 text-red-400"
      />
      <Chip
        active={enabled}
        activeText="Enabled"
        inactiveText="Disabled"
        activeClass="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
        inactiveClass="border-zinc-700 bg-zinc-900 text-zinc-300"
      />
      <Chip
        active={Boolean(linkedName)}
        activeText={linkedName ? `Linked to ${linkedName}` : 'Linked'}
        inactiveText="Unlinked"
        activeClass="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
        inactiveClass="border-red-400/20 bg-red-400/10 text-red-400"
      />
    </div>
  );
}

export default function GitHubSyncPage() {
  const { data: integrations } = useGitHubIntegrations();
  const { data: units } = useBehaviorUnits();

  const integrationList = integrations ?? [];
  const unitOptions = units ?? [];
  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/webhooks/github` : 'http://localhost:3000/webhooks/github';

  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [repoFullName, setRepoFullName] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [trackedPaths, setTrackedPaths] = useState('prompts/\nsystem_prompts/');
  const [githubToken, setGithubToken] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [unitId, setUnitId] = useState('');

  const [editingIntegration, setEditingIntegration] = useState<any | null>(null);
  const [editRepoFullName, setEditRepoFullName] = useState('');
  const [editDefaultBranch, setEditDefaultBranch] = useState('main');
  const [editTrackedPaths, setEditTrackedPaths] = useState('prompts/\nsystem_prompts/');
  const [editGithubToken, setEditGithubToken] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editUnitId, setEditUnitId] = useState('');

  const [syncIntegration, setSyncIntegration] = useState<any | null>(null);
  const [syncUnitName, setSyncUnitName] = useState('');
  const [syncFilePath, setSyncFilePath] = useState('prompts/prompt.md');
  const [syncContent, setSyncContent] = useState('');
  const [syncBranch, setSyncBranch] = useState('main');
  const [syncGithubRef, setSyncGithubRef] = useState('main');
  const [syncCommitSha, setSyncCommitSha] = useState('');
  const [syncTriggerEval, setSyncTriggerEval] = useState(true);
  const [syncGithubToken, setSyncGithubToken] = useState('');

  const trackedPathLines = useMemo(() => toLines(trackedPaths), [trackedPaths]);
  const editTrackedPathLines = useMemo(() => toLines(editTrackedPaths), [editTrackedPaths]);

  const integrationCount = integrationList.length;
  const tokenCount = integrationList.filter((integration: any) => integration.has_github_token).length;
  const enabledCount = integrationList.filter((integration: any) => integration.enabled).length;

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhookUrl(true);
    window.setTimeout(() => setCopiedWebhookUrl(false), 1800);
  };

  const resetAddDialog = () => {
    setRepoFullName('');
    setDefaultBranch('main');
    setTrackedPaths('prompts/\nsystem_prompts/');
    setGithubToken('');
    setEnabled(true);
    setUnitId('');
    setStatusMessage('');
    setErrorMessage('');
  };

  const openAddDialog = () => {
    resetAddDialog();
    setAddRepoOpen(true);
  };

  const openEditDialog = (integration: any) => {
    setEditingIntegration(integration);
    setEditRepoFullName(integration.repo_full_name || '');
    setEditDefaultBranch(integration.default_branch || 'main');
    setEditTrackedPaths((integration.tracked_paths || []).join('\n') || 'prompts/\nsystem_prompts/');
    setEditGithubToken('');
    setEditEnabled(Boolean(integration.enabled));
    setEditUnitId(integration.unit_id || '');
    setStatusMessage('');
    setErrorMessage('');
  };

  const saveIntegration = async (mode: 'add' | 'edit') => {
    setBusy(true);
    setStatusMessage('');
    setErrorMessage('');

    try {
      const payload = mode === 'add'
        ? {
            repo_full_name: repoFullName.trim(),
            default_branch: defaultBranch.trim() || 'main',
            unit_id: unitId || null,
            tracked_paths: trackedPathLines,
            github_access_token: githubToken.trim() || null,
            enabled,
          }
        : {
            repo_full_name: editRepoFullName.trim(),
            default_branch: editDefaultBranch.trim() || 'main',
            unit_id: editUnitId || null,
            tracked_paths: editTrackedPathLines,
            github_access_token: editGithubToken.trim() || null,
            enabled: editEnabled,
          };

      const response = await api.post('/github/integrations', payload);
      await mutate('/github/integrations');
      setStatusMessage(`${response.data.repo_full_name} saved successfully.`);
      setAddRepoOpen(false);
      setEditingIntegration(null);
      resetAddDialog();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to save GitHub integration');
    } finally {
      setBusy(false);
    }
  };

  const openSyncDialog = (integration: any) => {
    setSyncIntegration(integration);
    setSyncUnitName(integration.unit?.name || integration.unit_name || integration.repo_full_name?.split('/')?.[1] || 'prompt');
    setSyncFilePath('prompts/prompt.md');
    setSyncContent('');
    setSyncBranch(integration.default_branch || 'main');
    setSyncGithubRef(integration.default_branch || 'main');
    setSyncCommitSha('');
    setSyncTriggerEval(true);
    setSyncGithubToken('');
    setStatusMessage('');
    setErrorMessage('');
  };

  const runManualSync = async () => {
    if (!syncIntegration) return;

    setBusy(true);
    setStatusMessage('');
    setErrorMessage('');

    try {
      let parsedContent: Record<string, unknown> = {};
      const trimmedContent = syncContent.trim();
      if (trimmedContent) {
        try {
          const parsed = JSON.parse(trimmedContent);
          parsedContent = typeof parsed === 'object' && parsed ? (parsed as Record<string, unknown>) : { prompt: trimmedContent };
        } catch {
          parsedContent = { prompt: trimmedContent };
        }
      }

      const response = await api.post(`/github/integrations/${syncIntegration.id}/sync`, {
        unit_name: syncUnitName,
        repo_full_name: syncIntegration.repo_full_name,
        file_path: syncFilePath,
        content: parsedContent,
        github_token: syncGithubToken.trim() || null,
        github_ref: syncGithubRef.trim() || null,
        commit_sha: syncCommitSha.trim() || null,
        branch: syncBranch.trim() || null,
        eval_set_id: null,
        trigger_eval: syncTriggerEval,
      });

      await mutate('/github/integrations');
      setStatusMessage(`${response.data.message || 'Sync queued successfully.'}`);
      setSyncIntegration(null);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to sync repository content');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 bg-[#0f1117] text-zinc-100">
      <div className="flex flex-col gap-4 border-b border-zinc-700 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">GitHub Sync</h1>
          <p className="mt-1 text-sm text-zinc-400">Connected repositories, PAT state, and manual sync controls are all visible here.</p>
        </div>
        <Button onClick={openAddDialog} className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 text-zinc-950 hover:bg-white">
          <Plus className="h-4 w-4" />
          Add repository
        </Button>
      </div>

      {(errorMessage || statusMessage) && (
        <Card className={errorMessage ? 'border-red-400/40 bg-red-400/5' : 'border-emerald-500/40 bg-emerald-500/5'}>
          <CardContent className="p-4 text-sm">
            <p className={errorMessage ? 'text-red-300' : 'text-zinc-100'}>{errorMessage || statusMessage}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-700 bg-[#1a1d27] px-4 py-3 text-sm text-zinc-300">
        <div className="flex items-center gap-2"><span className="text-xs uppercase tracking-wide text-zinc-500">Connected repos</span><span className="text-lg font-semibold text-zinc-50">{integrationCount}</span></div>
        <div className="h-5 w-px bg-zinc-700" />
        <div className="flex items-center gap-2"><span className="text-xs uppercase tracking-wide text-zinc-500">Enabled integrations</span><span className="text-lg font-semibold text-zinc-50">{enabledCount}</span></div>
        <div className="h-5 w-px bg-zinc-700" />
        <div className="flex items-center gap-2"><span className="text-xs uppercase tracking-wide text-zinc-500">PATs stored</span><span className="text-lg font-semibold text-zinc-50">{tokenCount}</span></div>
      </div>

      <Card className="border-zinc-700 bg-[#1a1d27] text-zinc-100">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300">
            <div>
              <span className="font-medium text-zinc-100">Webhook configured at /webhooks/github</span>
              <span className="ml-2 text-zinc-500">— add this to push events</span>
            </div>
            <button type="button" onClick={copyWebhookUrl} className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-800">
              {copiedWebhookUrl ? 'Copied' : 'Show URL'}
            </button>
          </div>
          <details className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-4 text-sm text-zinc-300">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-zinc-100">
              <span className="font-medium">Setup instructions</span>
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            </summary>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-3">
                <p className="font-medium text-zinc-100">1. Add or edit an integration</p>
                <p className="mt-1 text-zinc-400">Choose a repository, select a branch, and store a PAT only if the repo needs it.</p>
              </div>
              <div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-3">
                <p className="font-medium text-zinc-100">2. Trigger a push or manual sync</p>
                <p className="mt-1 text-zinc-400">Manual sync is helpful for backfills, debugging, and first-time setup.</p>
              </div>
              <div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-3">
                <p className="font-medium text-zinc-100">3. Watch versions and evals appear</p>
                <p className="mt-1 text-zinc-400">Each sync can produce a behavior version and kick off an evaluation automatically.</p>
              </div>
              <div className="rounded-2xl border border-zinc-700 bg-zinc-950/60 p-3 font-mono text-xs break-all text-zinc-200">{webhookUrl}</div>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card className="border-zinc-700 bg-[#1a1d27] text-zinc-100">
        <CardHeader>
          <CardTitle>Connected repositories</CardTitle>
          <CardDescription>The status chips now show something meaningful instead of just token/no-token text.</CardDescription>
        </CardHeader>
        <CardContent>
          {integrationList.length > 0 ? (
            <div className="space-y-4">
              {integrationList.map((integration: any) => (
                <div key={integration.id} className="rounded-3xl border border-zinc-700 bg-zinc-900/60 p-6 space-y-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4 text-zinc-400" />
                        <a href={`https://github.com/${integration.repo_full_name}`} target="_blank" rel="noreferrer" className="font-semibold text-zinc-100 hover:underline">
                          {integration.repo_full_name}
                        </a>
                      </div>
                      <p className="text-xs text-zinc-400">Default branch: {integration.default_branch || 'main'} · Created {formatDateTime(integration.created_at)}</p>
                      <RepoBadges hasToken={Boolean(integration.has_github_token)} enabled={Boolean(integration.enabled)} linkedName={integration.unit?.name || integration.unit_name} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openSyncDialog(integration)} className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-white">
                        <RefreshCw className="mr-2 h-4 w-4" />Manual sync
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(integration)} className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 hover:text-white">
                        <PencilLine className="mr-2 h-4 w-4" />Edit
                      </Button>
                    </div>
                  </div>

                  <div className="h-px bg-zinc-700" />

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tracked paths</p>
                    <div className="flex flex-wrap gap-2">
                      {toLines(integration.tracked_paths).length > 0 ? toLines(integration.tracked_paths).map((path: string) => (
                        <span key={path} className="rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-200">{path}</span>
                      )) : <span className="text-sm text-zinc-400">No tracked paths configured</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-6 text-sm text-zinc-400">No repositories are connected yet.</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addRepoOpen} onOpenChange={setAddRepoOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add repository</DialogTitle>
            <DialogDescription>Connect a new repo, branch, and optional PAT.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repo-full-name">Repository (owner/repo)</Label>
              <Input id="repo-full-name" value={repoFullName} onChange={(e) => setRepoFullName(e.target.value)} placeholder="acme/prompt-ledger" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add-branch">Default branch</Label>
                <Input id="add-branch" value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)} placeholder="main" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-unit">Linked behavior unit</Label>
                <select id="add-unit" value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">None</option>
                  {unitOptions.map((unit: any) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-paths">Tracked paths</Label>
              <Textarea id="add-paths" value={trackedPaths} onChange={(e) => setTrackedPaths(e.target.value)} className="min-h-28 font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-token">GitHub access token</Label>
              <Input id="add-token" type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} placeholder="ghp_..." autoComplete="off" />
              <p className="text-xs text-muted-foreground">Leave blank if you want to connect later.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Integration enabled
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddRepoOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="button" onClick={() => saveIntegration('add')} disabled={busy || !repoFullName.trim()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save repository
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingIntegration)} onOpenChange={(open) => !open && setEditingIntegration(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit GitHub integration</DialogTitle>
            <DialogDescription>Update branch, tracked paths, PAT, and behavior unit linkage.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-repo">Repository</Label>
              <Input id="edit-repo" value={editRepoFullName} onChange={(e) => setEditRepoFullName(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-branch">Default branch</Label>
                <Input id="edit-branch" value={editDefaultBranch} onChange={(e) => setEditDefaultBranch(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unit">Linked behavior unit</Label>
                <select id="edit-unit" value={editUnitId} onChange={(e) => setEditUnitId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">None</option>
                  {unitOptions.map((unit: any) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-paths">Tracked paths</Label>
              <Textarea id="edit-paths" value={editTrackedPaths} onChange={(e) => setEditTrackedPaths(e.target.value)} className="min-h-28 font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-token">GitHub access token</Label>
              <Input id="edit-token" type="password" value={editGithubToken} onChange={(e) => setEditGithubToken(e.target.value)} placeholder="ghp_..." autoComplete="off" />
              <p className="text-xs text-muted-foreground">Leave blank to keep the existing encrypted token unchanged.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editEnabled} onChange={(e) => setEditEnabled(e.target.checked)} />
              Integration enabled
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingIntegration(null)} disabled={busy}>Cancel</Button>
            <Button type="button" onClick={() => saveIntegration('edit')} disabled={busy || !editRepoFullName.trim()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save integration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(syncIntegration)} onOpenChange={(open) => !open && setSyncIntegration(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manual sync</DialogTitle>
            <DialogDescription>Trigger a sync for a file, a raw prompt payload, or a GitHub fetch.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sync-unit">Unit name</Label>
              <Input id="sync-unit" value={syncUnitName} onChange={(e) => setSyncUnitName(e.target.value)} placeholder="Support Assistant" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-file">File path</Label>
              <Input id="sync-file" value={syncFilePath} onChange={(e) => setSyncFilePath(e.target.value)} placeholder="prompts/prompt.md" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-branch">Branch</Label>
              <Input id="sync-branch" value={syncBranch} onChange={(e) => setSyncBranch(e.target.value)} placeholder="main" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-ref">Git ref or SHA</Label>
              <Input id="sync-ref" value={syncGithubRef} onChange={(e) => setSyncGithubRef(e.target.value)} placeholder="refs/heads/main" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-sha">Commit SHA</Label>
              <Input id="sync-sha" value={syncCommitSha} onChange={(e) => setSyncCommitSha(e.target.value)} placeholder="abc123" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sync-token">Override PAT</Label>
              <Input id="sync-token" type="password" value={syncGithubToken} onChange={(e) => setSyncGithubToken(e.target.value)} placeholder="Leave empty to use the stored token" autoComplete="off" />
            </div>
          </div>
          <div className="space-y-2 mt-4">
            <Label htmlFor="sync-content">Content JSON or raw prompt</Label>
            <Textarea id="sync-content" value={syncContent} onChange={(e) => setSyncContent(e.target.value)} className="min-h-40 font-mono text-sm" placeholder='{"prompt":"...","system_prompt":"..."}' />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={syncTriggerEval} onChange={(e) => setSyncTriggerEval(e.target.checked)} />
            Trigger eval after version creation
          </label>
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-4 text-sm text-zinc-400 mt-4">
            If the content box is left empty, the backend will fetch the file from GitHub using the stored PAT or the override PAT you provide here.
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSyncIntegration(null)} disabled={busy}>Cancel</Button>
            <Button type="button" onClick={runManualSync} disabled={busy || !syncIntegration}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Run manual sync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
