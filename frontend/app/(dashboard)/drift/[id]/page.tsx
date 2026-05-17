'use client';

import { useDriftEvent } from '@/lib/hooks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const trendData = [
  { time: '10:00', score: 0.12 },
  { time: '11:00', score: 0.14 },
  { time: '12:00', score: 0.18 },
  { time: '13:00', score: 0.22 },
  { time: '14:00', score: 0.19 },
];

export default function DriftDetailPage({ params }: { params: { id: string } }) {
  const { data: event, isLoading } = useDriftEvent(params.id);

  if (isLoading) {
    return <Skeleton className="w-full h-96" />;
  }

  if (!event) {
    return <Card className="p-6 text-center text-muted-foreground">Event not found</Card>;
  }

  const severityColors: { [key: string]: string } = {
    low: 'bg-emerald-500',
    medium: 'bg-amber-500',
    high: 'bg-red-500',
    critical: 'bg-red-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Drift Investigation</h1>
          <p className="text-muted-foreground">{event.unit?.name}</p>
        </div>
        <Badge className={`${severityColors[event.severity]} text-white`}>
          {event.severity.toUpperCase()}
        </Badge>
      </div>

      {/* Root Cause Analysis */}
      {event.root_cause && (
        <Card className="p-6 border-2 border-primary">
          <h3 className="text-lg font-semibold mb-4">Root Cause Analysis</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Most Likely Cause</p>
              <p className="font-medium">{event.root_cause.most_likely_cause}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Confidence</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${event.root_cause.confidence * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{(event.root_cause.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Recommended Action</p>
              <p className="font-medium mt-1">{event.root_cause.recommended_action}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Drift Trend */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Drift Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--primary))"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Event Details */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Event Details</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Drift Score</p>
            <p className="text-2xl font-bold text-primary">{(event.drift_score * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Time Detected</p>
            <p className="font-medium">{new Date(event.created_at).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant={event.resolved ? 'secondary' : 'default'}>
              {event.resolved ? 'Resolved' : 'Open'}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Affected Samples</p>
            <p className="font-medium">~45 recent samples</p>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button>Rollback Version</Button>
        <Button variant="outline">Investigate Further</Button>
        <Button variant="outline">Mark as Resolved</Button>
      </div>
    </div>
  );
}
