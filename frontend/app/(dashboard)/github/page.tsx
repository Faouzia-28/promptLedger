'use client';

import { useState } from 'react';
import { mutate } from 'swr';
import { GitBranch, Loader2, Webhook } from 'lucide-react';
import api from '@/lib/api';
import { useGitHubIntegrations } from '@/lib/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function GitHubSyncPage() {
  const { data: integrations } = useGitHubIntegrations();
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/webhooks/github`
    : 'http://localhost:3000/webhooks/github';

  const [repoFullName, setRepoFullName] = useState('');
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [editingIntegrationId, setEditingIntegrationId] = useState<string | null>(null);
  const [editingRepoFullName, setEditingRepoFullName] = useState('');
  const [editingDefaultBranch, setEditingDefaultBranch] = useState('main');
  const [editingTrackedPaths, setEditingTrackedPaths] = useState('prompts/\nsystem_prompts/');
  const [editingGithubToken, setEditingGithubToken] = useState('');
  const [editingEnabled, setEditingEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhookUrl(true);
    window.setTimeout(() => setCopiedWebhookUrl(false), 1800);
  };

  const handleCreateIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntegrationBusy(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const response = await api.post('/github/integrations', {
        repo_full_name: repoFullName,
        default_branch: 'main',
        tracked_paths: ['prompts/', 'system_prompts/'],
        github_access_token: null,
        enabled: true,
      });

      await mutate('/github/integrations');
      setStatusMessage(`Connected ${response.data.repo_full_name} successfully.`);
      setRepoFullName('');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to create GitHub integration');
    } finally {
      setIntegrationBusy(false);
    }
  };

  const startEditing = (integration: any) => {
    setEditingIntegrationId(integration.id);
    setEditingRepoFullName(integration.repo_full_name);
    setEditingDefaultBranch(integration.default_branch || 'main');
    setEditingTrackedPaths((integration.tracked_paths || []).join('\n') || 'prompts/\nsystem_prompts/');
    setEditingGithubToken('');
    setEditingEnabled(Boolean(integration.enabled));
    setErrorMessage('');
    setStatusMessage('');
  };

  const cancelEditing = () => {
    setEditingIntegrationId(null);
    setEditingRepoFullName('');
    setEditingDefaultBranch('main');
    setEditingTrackedPaths('prompts/\nsystem_prompts/');
    setEditingGithubToken('');
    setEditingEnabled(true);
  };

  const handleUpdateIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRepoFullName) {
      setErrorMessage('Repository name is missing for update');
      return;
    }

    const trackedPaths = editingTrackedPaths
      .split('\n')
      .map((path) => path.trim())
      .filter(Boolean);

    setIntegrationBusy(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const response = await api.post('/github/integrations', {
        repo_full_name: editingRepoFullName,
        default_branch: editingDefaultBranch || 'main',
        tracked_paths: trackedPaths,
        github_access_token: editingGithubToken.trim() || null,
        enabled: editingEnabled,
      });

      await mutate('/github/integrations');
      setStatusMessage(`Updated ${response.data.repo_full_name} successfully.`);
      cancelEditing();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to update GitHub integration');
    } finally {
      setIntegrationBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-border bg-muted/40 p-2">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">GitHub Sync</h1>
            <p className="text-muted-foreground">Push prompt changes to trigger automatic evaluations.</p>
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

      <Card className="border-primary/20 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-900 dark:from-slate-900 dark:to-slate-800 dark:text-slate-100">
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary dark:text-sky-300 mb-2">Webhook URL</p>
            <div className="flex gap-2">
              <Input id="webhook-url" value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={copyWebhookUrl} className="shrink-0">
                {copiedWebhookUrl ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 mt-2">
              Add this URL to your GitHub webhook settings (Settings → Webhooks). Leave secret empty. Select "push" events only.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add Repository</CardTitle>
            <CardDescription>Track a new GitHub repository</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateIntegration} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="repo-full-name">Repository (owner/repo)</Label>
                <Input
                  id="repo-full-name"
                  value={repoFullName}
                  onChange={(e) => setRepoFullName(e.target.value)}
                  placeholder="faouzia-28/my-repo"
                  required
                />
              </div>
              <Button type="submit" disabled={integrationBusy} className="w-full">
                {integrationBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Connect Repository
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connected Repositories</CardTitle>
            <CardDescription>Repositories tracking prompts</CardDescription>
          </CardHeader>
          <CardContent>
            {(integrations?.length || 0) > 0 ? (
              <div className="space-y-3">
                {integrations.map((integration: any) => (
                  <div
                    key={integration.id}
                    className="rounded-lg border border-border p-3"
                    onClick={() => startEditing(integration)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        startEditing(integration);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{integration.repo_full_name}</p>
                        <p className="text-xs text-muted-foreground">Branch: {integration.default_branch}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={integration.has_github_token ? 'default' : 'outline'}>
                          {integration.has_github_token ? 'Token set' : 'No token'}
                        </Badge>
                        <Badge variant={integration.enabled ? 'default' : 'secondary'}>
                          {integration.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(integration);
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>

                    {editingIntegrationId === integration.id && (
                      <form
                        className="mt-4 space-y-3 border-t border-border pt-4"
                        onSubmit={handleUpdateIntegration}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="space-y-2">
                          <Label htmlFor={`branch-${integration.id}`}>Default branch</Label>
                          <Input
                            id={`branch-${integration.id}`}
                            value={editingDefaultBranch}
                            onChange={(e) => setEditingDefaultBranch(e.target.value)}
                            placeholder="main"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`paths-${integration.id}`}>Tracked paths (one per line)</Label>
                          <textarea
                            id={`paths-${integration.id}`}
                            value={editingTrackedPaths}
                            onChange={(e) => setEditingTrackedPaths(e.target.value)}
                            className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder={'prompts/\nsystem_prompts/'}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`token-${integration.id}`}>GitHub access token</Label>
                          <Input
                            id={`token-${integration.id}`}
                            type="password"
                            value={editingGithubToken}
                            onChange={(e) => setEditingGithubToken(e.target.value)}
                            placeholder="ghp_..."
                            autoComplete="off"
                          />
                          <p className="text-xs text-muted-foreground">
                            Paste a PAT with repo read access, then save. Leave empty to keep existing token unchanged.
                          </p>
                        </div>

                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editingEnabled}
                            onChange={(e) => setEditingEnabled(e.target.checked)}
                          />
                          Integration enabled
                        </label>

                        <div className="flex items-center gap-2">
                          <Button type="submit" disabled={integrationBusy}>
                            {integrationBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={cancelEditing}
                            disabled={integrationBusy}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No repositories connected yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
