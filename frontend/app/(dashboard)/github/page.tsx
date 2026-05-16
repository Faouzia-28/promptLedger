'use client';

import { useMemo, useState } from 'react';
import { mutate } from 'swr';
import { GitBranch, Loader2, Webhook, RefreshCw, Link2, ShieldCheck, TriangleAlert, PencilLine, Sparkles } from 'lucide-react';
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

function IntegrationBadge({ hasToken, enabled, unitName }: { hasToken: boolean; enabled: boolean; unitName?: string | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant={hasToken ? 'default' : 'outline'}>{hasToken ? 'PAT stored' : 'PAT missing'}</Badge>
      <Badge variant={enabled ? 'secondary' : 'outline'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
      <Badge variant={unitName ? 'default' : 'outline'}>{unitName ? `Linked to ${unitName}` : 'Unlinked'}</Badge>
    </div>
  );
}

export default function GitHubSyncPage() {
  const { data: integrations } = useGitHubIntegrations();
  const { data: units } = useBehaviorUnits();

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/webhooks/github`
    : 'http://localhost:3000/webhooks/github';

  const unitOptions = units ?? [];
  const integrationList = integrations ?? [];

  const [repoFullName, setRepoFullName] = useState('');
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [editingIntegration, setEditingIntegration] = useState<any | null>(null);
  const [syncIntegration, setSyncIntegration] = useState<any | null>(null);
  const [syncUnitName, setSyncUnitName] = useState('');
  const [syncFilePath, setSyncFilePath] = useState('prompt.md');
  const [syncContent, setSyncContent] = useState('');
  const [syncBranch, setSyncBranch] = useState('');
  const [syncGithubRef, setSyncGithubRef] = useState('');
  const [syncCommitSha, setSyncCommitSha] = useState('');
  const [syncTriggerEval, setSyncTriggerEval] = useState(true);
  const [syncGithubToken, setSyncGithubToken] = useState('');

  const [editRepoFullName, setEditRepoFullName] = useState('');
  const [editDefaultBranch, setEditDefaultBranch] = useState('main');
  const [editTrackedPaths, setEditTrackedPaths] = useState('prompts/\nsystem_prompts/');
  const [editGithubToken, setEditGithubToken] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editUnitId, setEditUnitId] = useState('');

  const trackedPathLines = useMemo(() => toLines(editTrackedPaths), [editTrackedPaths]);

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhookUrl(true);
    window.setTimeout(() => setCopiedWebhookUrl(false), 1800);
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

  const saveIntegration = async () => {
    setBusy(true);
    setStatusMessage('');
    setErrorMessage('');

    try {
      const response = await api.post('/github/integrations', {
        repo_full_name: editRepoFullName,
        default_branch: editDefaultBranch || 'main',
        unit_id: editUnitId || null,
        tracked_paths: trackedPathLines,
        github_access_token: editGithubToken.trim() || null,
        enabled: editEnabled,
      });

      await mutate('/github/integrations');
      setStatusMessage(`${response.data.repo_full_name} saved successfully.`);
      setEditingIntegration(null);
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
          parsedContent = typeof parsed === 'object' && parsed ? parsed as Record<string, unknown> : { prompt: trimmedContent };
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

  const integrationCount = integrationList.length;
  const tokenCount = integrationList.filter((integration: any) => integration.has_github_token).length;
  const enabledCount = integrationList.filter((integration: any) => integration.enabled).length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-border bg-muted/40 p-3">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">GitHub Sync</h1>
            <p className="text-muted-foreground">Connected repositories, PAT state, and manual sync controls are all visible here.</p>
          </div>
        </div>
      </div>

      {(errorMessage || statusMessage) && (
        <Card className={errorMessage ? 'border-destructive/40 bg-destructive/5' : 'border-primary/40 bg-primary/5'}>
          <CardContent className="p-4 text-sm">
            <p className={errorMessage ? 'text-destructive' : 'text-foreground'}>{errorMessage || statusMessage}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/70">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Connected repositories</p>
            <p className="mt-2 text-3xl font-semibold">{integrationCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Enabled integrations</p>
            <p className="mt-2 text-3xl font-semibold">{enabledCount}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">PATs stored securely</p>
            <p className="mt-2 text-3xl font-semibold">{tokenCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-100 shadow-lg">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-300">Webhook URL</p>
              <p className="text-sm text-slate-300">Add this to GitHub push events. The backend already accepts the webhook and creates versions.</p>
            </div>
            <Button type="button" variant="secondary" onClick={copyWebhookUrl} className="shrink-0">
              {copiedWebhookUrl ? 'Copied' : 'Copy webhook URL'}
            </Button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs font-mono break-all text-slate-200">{webhookUrl}</div>
          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="font-medium text-slate-100">1. Create or edit an integration</p>
              <p className="mt-1">Set repo, branch, tracked paths, and the PAT if needed.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="font-medium text-slate-100">2. Send a push or use manual sync</p>
              <p className="mt-1">Manual sync is now a first-class action for debugging and backfills.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="font-medium text-slate-100">3. Watch versions and evals create automatically</p>
              <p className="mt-1">Each sync can create a behavior version and kick off an evaluation.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Connect repository</CardTitle>
            <CardDescription>Provide a repo, branch, and optional PAT. Tokens are encrypted server-side.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repo-full-name">Repository (owner/repo)</Label>
              <Input id="repo-full-name" value={repoFullName} onChange={(e) => setRepoFullName(e.target.value)} placeholder="acme/prompt-ledger" />
            </div>
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              If you connect the repo here, the edit dialog lets you link it to a behavior unit and rotate the PAT later without exposing the raw token.
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={busy || !repoFullName.trim()}
              onClick={async () => {
                setBusy(true);
                setStatusMessage('');
                setErrorMessage('');
                try {
                  const response = await api.post('/github/integrations', {
                    repo_full_name: repoFullName.trim(),
                    default_branch: 'main',
                    unit_id: null,
                    tracked_paths: ['prompts/', 'system_prompts/'],
                    github_access_token: null,
                    enabled: true,
                  });
                  await mutate('/github/integrations');
                  setStatusMessage(`Connected ${response.data.repo_full_name}.`);
                  setRepoFullName('');
                } catch (err: any) {
                  setErrorMessage(err.response?.data?.detail || 'Failed to connect repository');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Connect repository
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Connected repositories</CardTitle>
            <CardDescription>The status chips now show something meaningful instead of just token/no-token text.</CardDescription>
          </CardHeader>
          <CardContent>
            {integrationList.length > 0 ? (
              <div className="space-y-4">
                {integrationList.map((integration: any) => (
                  <div key={integration.id} className="rounded-2xl border border-border bg-muted/20 p-4 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-primary" />
                          <p className="font-medium">{integration.repo_full_name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Default branch: {integration.default_branch || 'main'} · Created {formatDateTime(integration.created_at)}</p>
                        <IntegrationBadge hasToken={Boolean(integration.has_github_token)} enabled={Boolean(integration.enabled)} unitName={integration.unit?.name || integration.unit_name} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openSyncDialog(integration)}>
                          <RefreshCw className="mr-2 h-4 w-4" />Manual sync
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(integration)}>
                          <PencilLine className="mr-2 h-4 w-4" />Edit
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tracked paths</p>
                      <div className="flex flex-wrap gap-2">
                        {toLines(integration.tracked_paths).length > 0 ? toLines(integration.tracked_paths).map((path: string) => (
                          <Badge key={path} variant="outline">{path}</Badge>
                        )) : <span className="text-sm text-muted-foreground">No tracked paths configured</span>}
                      </div>
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-2xl border border-border bg-background/60 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">PAT status</p>
                        <p className="mt-1 font-medium">{integration.has_github_token ? 'PAT encrypted and stored on the server' : 'No PAT stored yet'}</p>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/60 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Link status</p>
                        <p className="mt-1 font-medium">{integration.unit?.name || 'Not linked to a behavior unit'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                No repositories are connected yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
                <select
                  id="edit-unit"
                  value={editUnitId}
                  onChange={(e) => setEditUnitId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {unitOptions.map((unit: any) => (
                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                  ))}
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
            <Button type="button" onClick={saveIntegration} disabled={busy || !editRepoFullName.trim()}>
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
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground mt-4">
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
