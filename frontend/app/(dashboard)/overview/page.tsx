'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useBehaviorUnits, useDriftEvents, useCurrentUser } from '@/lib/hooks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { WebSocketClient } from '@/lib/websocket';
import { toast } from 'sonner';
import { AlertCircle, TrendingUp, Zap, Eye, CircleCheckBig } from 'lucide-react';

export default function OverviewPage() {
  const { data: units } = useBehaviorUnits();
  const { data: driftEvents, isLoading: driftLoading } = useDriftEvents();
  const { user } = useCurrentUser();

  const driftEventList = driftEvents ?? [];
  const hasUnits = (units?.length || 0) > 0;
  const averageDriftScore = driftEventList.length
    ? driftEventList.reduce((sum: number, event: any) => sum + (event.drift_score || 0), 0) / driftEventList.length
    : 0;
  const activeAlerts = driftEventList.filter((event: any) => !event.resolved).length;
  const healthScore = driftEventList.length
    ? Math.max(0, Math.round(100 - (activeAlerts / driftEventList.length) * 100))
    : 100;

  const chartData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const dayKey = date.toISOString().slice(0, 10);
    const dayEvents = driftEventList.filter((event: any) => String(event.created_at).startsWith(dayKey));
    const dayAverage = dayEvents.length
      ? dayEvents.reduce((sum: number, event: any) => sum + (event.drift_score || 0), 0) / dayEvents.length
      : 0;

    return {
      date: date.toLocaleDateString(undefined, { weekday: 'short' }),
      drift: Number(dayAverage.toFixed(2)),
    };
  });

  useEffect(() => {
    if (!user?.org_id) return;

    const client = new WebSocketClient(user.org_id);

    client.connect().catch(console.error);

    const unsubscribe = client.subscribe((notification) => {
      const severityColors = {
        low: 'bg-blue-500',
        medium: 'bg-yellow-500',
        high: 'bg-orange-500',
        critical: 'bg-red-500',
      };

      toast.error(`Drift Detected: ${notification.severity.toUpperCase()}`, {
        description: `Drift score: ${(notification.drift_score * 100).toFixed(1)}%`,
        action: {
          label: 'View',
          onClick: () => window.location.href = `/drift/${notification.unit_id}`,
        },
      });
    });

    return () => {
      unsubscribe();
      client.disconnect();
    };
  }, [user?.org_id]);

  return (
    <div className="space-y-8">
      {!hasUnits && (
        <Card className="p-6 border-primary/40 bg-primary/5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Welcome to PromptLedger</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Complete these steps to get your first behavioral regression and drift checks running.
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2"><CircleCheckBig className="h-4 w-4 text-primary" /> Create your first behavior unit</div>
                <div className="flex items-center gap-2"><CircleCheckBig className="h-4 w-4 text-primary" /> Push two versions for comparison</div>
                <div className="flex items-center gap-2"><CircleCheckBig className="h-4 w-4 text-primary" /> Create an eval set and run it</div>
                <div className="flex items-center gap-2"><CircleCheckBig className="h-4 w-4 text-primary" /> Export compliance snapshot</div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button asChild>
                <Link href="/units">Create First Unit</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/audit">Open Audit Log</Link>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Units</p>
              <p className="text-3xl font-bold text-foreground">{units?.length || 0}</p>
            </div>
            <Zap className="w-8 h-8 text-primary opacity-50" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Alerts</p>
              <p className="text-3xl font-bold text-foreground">{activeAlerts}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-destructive opacity-50" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Drift Score</p>
              <p className="text-3xl font-bold text-foreground">{averageDriftScore.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-accent opacity-50" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Health Check</p>
              <p className="text-3xl font-bold text-green-500">{healthScore}%</p>
            </div>
            <Eye className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* 7-Day Drift Trend */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">7-Day Drift Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorDrift" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
              }}
            />
            <Area
              type="monotone"
              dataKey="drift"
              stroke="hsl(var(--primary))"
              fillOpacity={1}
              fill="url(#colorDrift)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent Drift Events */}
      <Card>
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold">Recent Drift Events</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {driftLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : driftEvents && driftEvents.length > 0 ? (
              driftEvents.slice(0, 5).map((event: any) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.unit?.name || 'Unknown'}</TableCell>
                  <TableCell>
                    <Badge variant={event.severity === 'critical' ? 'destructive' : 'default'}>
                      {event.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${event.drift_score * 100}%` }}
                        />
                      </div>
                      <span className="text-sm">{(event.drift_score * 100).toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(event.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={event.resolved ? 'secondary' : 'default'}>
                      {event.resolved ? 'Resolved' : 'Open'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No drift events detected
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
