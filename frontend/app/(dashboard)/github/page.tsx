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
    ? `${window.location.origin}/api/v1/webhooks/github`
    : 'http://localhost:3000/api/v1/webhooks/github';

  const [repoFullName, setRepoFullName] = useState('');
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [integrationBusy, setIntegrationBusy] = useState(false);
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
                  <div key={integration.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{integration.repo_full_name}</p>
                        <p className="text-xs text-muted-foreground">Branch: {integration.default_branch}</p>
                      </div>
                      <Badge variant={integration.enabled ? 'default' : 'secondary'}>
                        {integration.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
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
