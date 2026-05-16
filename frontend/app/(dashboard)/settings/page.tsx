'use client';

import Link from 'next/link';
import { ShieldCheck, KeyRound, Bell, ExternalLink, RefreshCw, LockKeyhole } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security & Settings</h1>
          <p className="text-muted-foreground">Token guidance, secret-handling notes, and quick links to the operational screens that matter.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Encrypted tokens</Badge>
          <Badge variant="outline">Admin-only prompt store</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/70">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">PAT handling</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">Server-side</p>
            <p className="mt-2 text-sm text-muted-foreground">GitHub tokens are entered in the GitHub Sync page and stored encrypted on the backend.</p>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Template storage</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">Runtime</p>
            <p className="mt-2 text-sm text-muted-foreground">The scoring templates page writes into the runtime JSON store and keeps a browser-side rollback history.</p>
          </CardContent>
        </Card>
        <Card className="border-border/70">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Metrics</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">Prometheus</p>
            <p className="mt-2 text-sm text-muted-foreground">Scorer calls, parse failures, and latency are exposed through the backend metrics endpoint.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Token management</CardTitle>
            <CardDescription>Use the GitHub Sync page for PAT rotation and connection setup. That keeps the secret flow in one place instead of scattering it across settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="font-medium">What changed</p>
              <p className="mt-1 text-muted-foreground">Repository cards now show whether a PAT is stored, whether the integration is enabled, and whether it is linked to a behavior unit.</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="font-medium">Rotation pattern</p>
              <p className="mt-1 text-muted-foreground">Open GitHub Sync, edit the integration, paste a new PAT, and save. The backend encrypts it before persistence.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/github"><ShieldCheck className="mr-2 h-4 w-4" />Open GitHub Sync</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/metrics"><RefreshCw className="mr-2 h-4 w-4" />Review metrics</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-primary" />Operational links</CardTitle>
            <CardDescription>Keep the security story visible, but route users toward the pages where the actual work happens.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { href: '/github', title: 'GitHub Sync', detail: 'Manage integrations, PATs, and manual syncs.', icon: ExternalLink },
              { href: '/templates', title: 'Scoring Templates', detail: 'Edit the runtime scorer prompt and rollback snapshots.', icon: ExternalLink },
              { href: '/evals', title: 'Evals', detail: 'Filter runs, open details, and export results.', icon: ExternalLink },
              { href: '/metrics', title: 'Metrics', detail: 'Inspect parse failures, calls, and latency.', icon: ExternalLink },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <item.icon className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Preferences</CardTitle>
          <CardDescription>The old placeholder preferences panel is no longer the primary path; these are just the defaults that still make sense in-app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="font-medium">Email alerts</p>
              <p className="mt-1 text-muted-foreground">Configured outside this demo UI.</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="font-medium">Slack notifications</p>
              <p className="mt-1 text-muted-foreground">Use the alert settings and webhook integrations in the backend.</p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="font-medium">Team access</p>
              <p className="mt-1 text-muted-foreground">Role assignment is handled by the auth layer, not this page.</p>
            </div>
          </div>

          <Separator />

          <div className="rounded-2xl border border-dashed border-border bg-background/60 p-4 text-muted-foreground">
            <p className="font-medium text-foreground">Why this page is intentionally thin</p>
            <p className="mt-1">The important operational controls now live on the pages where the actions actually happen. That keeps token handling and prompt editing discoverable without duplicating forms that can drift out of sync.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
