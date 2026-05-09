'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Key, Bell, Users } from 'lucide-react';

export default function SettingsPage() {
  const [githubToken, setGithubToken] = useState('');
  const [slackUrl, setSlackUrl] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('medium');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage integrations, alerts, and team preferences</p>
      </div>

      <Tabs defaultValue="integrations" className="w-full">
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Key className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">GitHub Integration</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your GitHub repository to track prompt changes
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="github">GitHub Personal Access Token</Label>
                <Input
                  id="github"
                  type="password"
                  placeholder="ghp_..."
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                />
              </div>
              <Button>Connect GitHub</Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Slack Integration</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Receive drift alerts directly in your Slack workspace
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slack">Slack Webhook URL</Label>
                <Input
                  id="slack"
                  type="password"
                  placeholder="https://hooks.slack.com/..."
                  value={slackUrl}
                  onChange={(e) => setSlackUrl(e.target.value)}
                />
              </div>
              <Button>Connect Slack</Button>
            </div>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Alert Preferences</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="threshold">Minimum Alert Severity</Label>
                <select 
                  id="threshold"
                  value={alertThreshold} 
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
                >
                  <option value="low">Low - All alerts</option>
                  <option value="medium">Medium - Medium and above</option>
                  <option value="high">High - High and critical only</option>
                  <option value="critical">Critical - Critical only</option>
                </select>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Alerts</p>
                    <p className="text-sm text-muted-foreground">Receive alerts via email</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Slack Notifications</p>
                    <p className="text-sm text-muted-foreground">Post to Slack channel</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Daily Summary</p>
                    <p className="text-sm text-muted-foreground">Email digest at 9 AM</p>
                  </div>
                  <input type="checkbox" className="w-4 h-4" />
                </div>
              </div>

              <Button className="mt-4">Save Preferences</Button>
            </div>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Team Members</h3>
            </div>

            <div className="space-y-4">
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">admin@example.com</p>
                    <p className="text-sm text-muted-foreground">Administrator</p>
                  </div>
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">Owner</span>
                </div>
              </div>

              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">user@example.com</p>
                    <p className="text-sm text-muted-foreground">Can view and manage units</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Remove
                  </Button>
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div>
              <h4 className="font-semibold mb-4">Invite Team Member</h4>
              <div className="flex gap-2">
                <Input placeholder="email@example.com" className="flex-1" />
                <Button>Send Invite</Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
