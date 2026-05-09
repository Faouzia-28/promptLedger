'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDriftEvents } from '@/lib/hooks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function DriftPage() {
  const [severity, setSeverity] = useState<string>('');
  const [resolved, setResolved] = useState<string>('');
  const { data: events, isLoading } = useDriftEvents({
    severity: severity || undefined,
    resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
  });

  const severityColors: { [key: string]: string } = {
    low: 'bg-blue-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Drift Events</h1>
        <p className="text-muted-foreground">Monitor behavioral drift in your LLM units</p>
      </div>

      {/* Filters */}
      <Card className="p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="text-sm text-muted-foreground block mb-2">Severity</label>
          <select 
            value={severity} 
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
          >
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="text-sm text-muted-foreground block mb-2">Status</label>
          <select 
            value={resolved} 
            onChange={(e) => setResolved(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
          >
            <option value="">All Status</option>
            <option value="false">Open</option>
            <option value="true">Resolved</option>
          </select>
        </div>
      </Card>

      {/* Events Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Drift Score</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-10" />
                </TableCell>
              </TableRow>
            ) : events && events.length > 0 ? (
              events.map((event: any) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.unit?.name}</TableCell>
                  <TableCell>
                    <Badge className={`${severityColors[event.severity]} text-white`}>
                      {event.severity.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${severityColors[event.severity]}`}
                          style={{ width: `${event.drift_score * 100}%` }}
                        />
                      </div>
                      <span className="text-sm">{(event.drift_score * 100).toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(event.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={event.resolved ? 'secondary' : 'default'}>
                      {event.resolved ? 'Resolved' : 'Open'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/drift/${event.id}`} className="text-primary hover:underline text-sm">
                      Investigate
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
