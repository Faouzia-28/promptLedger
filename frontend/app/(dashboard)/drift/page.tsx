 'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useDriftEvents, useBehaviorUnits } from '@/lib/hooks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function DriftPage() {
  const [severity, setSeverity] = useState<string>('');
  const [resolved, setResolved] = useState<string>('');

  const searchParams = useSearchParams();
  const projectParam = searchParams?.get('project') ?? '';

  // Load units to resolve a project name to a unit id
  const { data: units } = useBehaviorUnits();
  const matchedUnit = units?.find((u: any) => u.name === projectParam || u.slug === projectParam);
  const unit_id = matchedUnit?.id;

  const { data: events, isLoading } = useDriftEvents({
    severity: severity || undefined,
    unit_id: unit_id || undefined,
    resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
  });

  const severityColors: { [key: string]: string } = {
    low: 'bg-emerald-500',
    medium: 'bg-amber-500',
    high: 'bg-red-500',
    critical: 'bg-red-600',
  };

  return (
    <div className="space-y-8 bg-[#0a0a0a] text-zinc-100">
      <div className="border-b border-white/10 pb-4">
        <h1 className="text-3xl font-bold">Drift Events</h1>
        <p className="text-zinc-400">Monitor behavioral drift in your LLM units</p>
      </div>

      {/* Filters */}
      <Card className="flex flex-col gap-4 border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_4px_24px_rgba(0,0,0,0.4)] md:flex-row">
        <div className="flex-1">
          <label className="mb-2 block text-sm text-zinc-400">Severity</label>
          <select 
            value={severity} 
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-zinc-100"
          >
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-2 block text-sm text-zinc-400">Status</label>
          <select 
            value={resolved} 
            onChange={(e) => setResolved(e.target.value)}
            className="w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-zinc-100"
          >
            <option value="">All Status</option>
            <option value="false">Open</option>
            <option value="true">Resolved</option>
          </select>
        </div>
      </Card>

      {/* Events Table */}
      <Card className="border border-[rgba(255,255,255,0.08)] bg-[#141414] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_4px_24px_rgba(0,0,0,0.4)]">
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
                  <TableCell colSpan={6} className="py-8 text-center text-zinc-400">
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
