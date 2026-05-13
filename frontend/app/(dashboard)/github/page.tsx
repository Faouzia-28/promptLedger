'use client';

import { useMemo, useState } from 'react';
import { mutate } from 'swr';
import { GitBranch, Loader2, RefreshCw, Webhook, FileCode2, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useBehaviorUnits, useGitHubIntegrations } from '@/lib/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

function parseTrackedPaths(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toSyncContent(rawContent: string) {
  const trimmed = rawContent.trim();
  if (!trimmed) return {};

  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through to prompt wrapper
    }
  }

  return { prompt: rawContent };
}

export default function GitHubSyncPage() {
  const { data: units } = useBehaviorUnits();
  const { data: integrations } = useGitHubIntegrations();
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000/api/v1/webhooks/github`
    : 'http://localhost:8000/api/v1/webhooks/github';

  const [repoFullName, setRepoFullName] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [trackedPaths, setTrackedPaths] = useState('prompts/, system_prompts/');
  const [integrationUnitId, setIntegrationUnitId] = useState('');
  const [integrationGithubToken, setIntegrationGithubToken] = useState('');
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  const [selectedIntegrationId, setSelectedIntegrationId] = useState('');
  const [syncUnitId, setSyncUnitId] = useState('');
  const [syncUnitName, setSyncUnitName] = useState('');
  const [syncRepoFullName, setSyncRepoFullName] = useState('');
  const [filePath, setFilePath] = useState('');
  const [githubRef, setGitHubRef] = useState('main');
  const [githubToken, setGithubToken] = useState('');
  const [triggerEval, setTriggerEval] = useState(true);
  const [manualContent, setManualContent] = useState('');

  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const selectedIntegration = useMemo(
    () => integrations?.find((integration: any) => integration.id === selectedIntegrationId),
    [integrations, selectedIntegrationId]
  );

  const resetIntegrationForm = () => {
    setRepoFullName('');
    setDefaultBranch('main');
    setTrackedPaths('prompts/, system_prompts/');
    setIntegrationUnitId('');
    setIntegrationGithubToken('');
  };

  const resetSyncForm = () => {
    setSyncUnitId('');
    setSyncUnitName('');
    setSyncRepoFullName('');
    setFilePath('');
    setGitHubRef('main');
    setGithubToken('');
    setTriggerEval(true);
    setManualContent('');
  };

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
      const trackedPathList = parseTrackedPaths(trackedPaths);
      const response = await api.post('/github/integrations', {
        repo_full_name: repoFullName,
        default_branch: defaultBranch || 'main',
        unit_id: integrationUnitId || null,
        tracked_paths: trackedPathList,
        github_access_token: integrationGithubToken || null,
        enabled: true,
      });

      await mutate('/github/integrations');
      setStatusMessage(`Connected ${response.data.repo_full_name} successfully.`);
      resetIntegrationForm();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to create GitHub integration');
    } finally {
      setIntegrationBusy(false);
    }
  };

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncBusy(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const content = toSyncContent(manualContent);
      const targetUnit = units?.find((unit: any) => unit.id === syncUnitId);
      const response = await api.post(`/github/integrations/${selectedIntegrationId}/sync`, {
        unit_name: syncUnitName || targetUnit?.name || 'GitHub Prompt',
        repo_full_name: syncRepoFullName || selectedIntegration?.repo_full_name || null,
        file_path: filePath,
        github_token: githubToken || null,
        github_ref: githubRef || null,
        branch: githubRef || null,
        content,
        trigger_eval: triggerEval,
      });

      await mutate('/github/integrations');
      setStatusMessage(`${response.data.status}: version ${response.data.version_id} created.`);
      resetSyncForm();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to sync prompt from GitHub');
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-border bg-muted/40 p-2">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">GitHub Sync</h1>
            <p className="text-muted-foreground">
              Register repositories, fetch prompt files from GitHub, and trigger evaluation runs from the dashboard.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1"><Webhook className="h-3 w-3" /> repo onboarding</Badge>
          <Badge variant="outline" className="gap-1"><FileCode2 className="h-3 w-3" /> prompt file sync</Badge>
          <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" /> eval trigger gate</Badge>
        </div>
      </div>

        <Card className="border-primary/20 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-900 dark:from-slate-900 dark:to-slate-800 dark:text-slate-100">
          <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary dark:text-sky-300">Fast setup</p>
              <h2 className="text-xl font-semibold">Copy one webhook URL, then push your prompt change</h2>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                This test deployment accepts unsigned webhooks, so the GitHub secret step can be skipped.
                Connect the repo once, then every push to the tracked prompt paths will create a version and trigger evals.
              </p>
              <ol className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <li>1. Save the integration below.</li>
                <li>2. Paste the webhook URL into GitHub.</li>
                <li>3. Leave the secret empty in GitHub for this test deployment.</li>
                <li>4. Push a change inside a tracked path like <span className="font-medium text-slate-900 dark:text-slate-100">prompts/</span>.</li>
              </ol>
            </div>
            <div className="space-y-3 rounded-2xl border border-slate-300 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <div className="flex gap-2">
                  <Input id="webhook-url" value={webhookUrl} readOnly className="font-mono text-xs" />
                  <Button type="button" variant="outline" onClick={copyWebhookUrl} className="shrink-0">
                    {copiedWebhookUrl ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                In GitHub, add a webhook with Content type <span className="font-medium text-slate-900 dark:text-slate-100">application/json</span> and only the <span className="font-medium text-slate-900 dark:text-slate-100">push</span> event.
              </p>
            </div>
          </CardContent>
        </Card>

      {(errorMessage || statusMessage) && (
        <Card className={errorMessage ? 'border-destructive/40 bg-destructive/5' : 'border-primary/40 bg-primary/5'}>
          <CardContent className="p-4 text-sm">
            <p className={errorMessage ? 'text-destructive' : 'text-foreground'}>{errorMessage || statusMessage}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Connect a repository</CardTitle>
            <CardDescription>
              Track a repository and optionally link it to an existing behavior unit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateIntegration} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="repo-full-name">Repository</Label>
                  <Input
                    id="repo-full-name"
                    value={repoFullName}
                    onChange={(e) => setRepoFullName(e.target.value)}
                    placeholder="owner/repository"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default-branch">Default branch</Label>
                  <Input
                    id="default-branch"
                    value={defaultBranch}
                    onChange={(e) => setDefaultBranch(e.target.value)}
                    placeholder="main"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="integration-unit">Behavior unit</Label>
                  <select
                    id="integration-unit"
                    value={integrationUnitId}
                    onChange={(e) => setIntegrationUnitId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Auto-create from repo sync</option>
                    {units?.map((unit: any) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="integration-github-token">GitHub access token</Label>
                  <Input
                    id="integration-github-token"
                    type="password"
                    value={integrationGithubToken}
                    onChange={(e) => setIntegrationGithubToken(e.target.value)}
                    placeholder="ghp_... or GitHub App token"
                  />
                  <p className="text-xs text-muted-foreground">
                    Stored for webhook file fetches and commit status updates.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tracked-paths">Tracked paths</Label>
                <Textarea
                  id="tracked-paths"
                  value={trackedPaths}
                  onChange={(e) => setTrackedPaths(e.target.value)}
                  placeholder="prompts/, system_prompts/, ai/"
                  className="min-h-24"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated paths used by the integration to identify prompt locations.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetIntegrationForm}>
                  Reset
                </Button>
                <Button type="submit" disabled={integrationBusy}>
                  {integrationBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save integration
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing integrations</CardTitle>
            <CardDescription>
              Repositories already connected to PromptLedger.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(integrations?.length || 0) > 0 ? (
              integrations.map((integration: any) => (
                <button
                  key={integration.id}
                  type="button"
                  onClick={() => setSelectedIntegrationId(integration.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${selectedIntegrationId === integration.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{integration.repo_full_name}</p>
                      <p className="text-xs text-muted-foreground">Default branch: {integration.default_branch}</p>
                    </div>
                    <Badge variant={integration.enabled ? 'default' : 'secondary'}>
                      {integration.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                  </div>
                  <Separator className="my-3" />
                  <p className="text-xs text-muted-foreground">
                    Tracks {(integration.tracked_paths || []).length ? (integration.tracked_paths || []).join(', ') : 'all paths'}
                  </p>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No integrations yet. Register your first repository on the left.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sync a prompt from GitHub</CardTitle>
          <CardDescription>
            Fetch a prompt file from GitHub, create a new behavior version, and optionally trigger an eval run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSync} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="sync-integration">Integration</Label>
                <select
                  id="sync-integration"
                  value={selectedIntegrationId}
                  onChange={(e) => {
                    setSelectedIntegrationId(e.target.value);
                    const integration = integrations?.find((item: any) => item.id === e.target.value);
                    if (integration) {
                      setSyncRepoFullName(integration.repo_full_name || '');
                      setGitHubRef(integration.default_branch || 'main');
                    }
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Choose an integration</option>
                  {integrations?.map((integration: any) => (
                    <option key={integration.id} value={integration.id}>
                      {integration.repo_full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sync-unit">Behavior unit</Label>
                <select
                  id="sync-unit"
                  value={syncUnitId}
                  onChange={(e) => {
                    setSyncUnitId(e.target.value);
                    const unit = units?.find((item: any) => item.id === e.target.value);
                    setSyncUnitName(unit?.name || '');
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select existing unit</option>
                  {units?.map((unit: any) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sync-unit-name">Unit name fallback</Label>
                <Input
                  id="sync-unit-name"
                  value={syncUnitName}
                  onChange={(e) => setSyncUnitName(e.target.value)}
                  placeholder="Support Assistant"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="sync-repo">Repository override</Label>
                <Input
                  id="sync-repo"
                  value={syncRepoFullName}
                  onChange={(e) => setSyncRepoFullName(e.target.value)}
                  placeholder={selectedIntegration?.repo_full_name || 'owner/repository'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file-path">Prompt file path</Label>
                <Input
                  id="file-path"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder="prompts/support/system_prompt.md"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="github-ref">GitHub ref</Label>
                <Input
                  id="github-ref"
                  value={githubRef}
                  onChange={(e) => setGitHubRef(e.target.value)}
                  placeholder="main"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="github-token">GitHub token</Label>
                <Input
                  id="github-token"
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_... or GitHub App token"
                />
                <p className="text-xs text-muted-foreground">
                  The token is only used for this sync request and is not stored.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-content">Manual fallback content (optional)</Label>
              <Textarea
                id="manual-content"
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                placeholder='Paste JSON like {"system_prompt": "..."} or raw prompt text to store as {"prompt": "..."}'
                className="min-h-32"
              />
              <p className="text-xs text-muted-foreground">
                Leave this blank to fetch the file content directly from GitHub.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-4">
              <div>
                <p className="font-medium">Trigger eval after sync</p>
                <p className="text-sm text-muted-foreground">Queue an eval automatically after creating the prompt version.</p>
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={triggerEval}
                  onChange={(e) => setTriggerEval(e.target.checked)}
                  className="h-4 w-4"
                />
                Enabled
              </label>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetSyncForm}>
                Reset
              </Button>
              <Button type="submit" disabled={syncBusy || !selectedIntegrationId}>
                {syncBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sync and run eval
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
