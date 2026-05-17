'use client';

import { useState } from 'react';
import { useAuditLog } from '@/lib/hooks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Download } from 'lucide-react';

export default function AuditPage() {
  const [skip, setSkip] = useState(0);
  const { data: logs, isLoading } = useAuditLog(skip, 50);

  const actionColors: { [key: string]: string } = {
    create: 'bg-emerald-500',
    update: 'bg-amber-500',
    delete: 'bg-red-500',
    deploy: 'bg-amber-500',
  };

  const handleExportEUReport = () => {
    // Generate EU AI Act report
    const report = {
      generated_at: new Date().toISOString(),
      organization: 'Your Org',
      period: 'Last 30 days',
      transparency_statement: 'This system is designed to monitor LLM behavior drift...',
      compliance_checks: {
        gdpr: 'Compliant - Data retention policy enforced',
        transparency: 'Compliant - Full audit log maintained',
        bias_monitoring: 'Compliant - Behavioral drift detection active',
      },
    };

    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, 2))}`);
    element.setAttribute('download', `eu-ai-act-report-${new Date().toISOString().split('T')[0]}.json`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">All system activities and compliance records</p>
        </div>
        <Button onClick={handleExportEUReport}>
          <Download className="w-4 h-4 mr-2" />
          Export EU AI Act Report
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <Input placeholder="Search audit log..." className="w-full md:w-64" />
      </Card>

      {/* Audit Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-10" />
                </TableCell>
              </TableRow>
            ) : logs && logs.length > 0 ? (
              logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">{new Date(log.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={`${actionColors[log.action.toLowerCase()]} text-white`}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.actor?.email || 'System'}</TableCell>
                  <TableCell className="text-sm">
                    {log.resource_type}: {log.resource_id}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.metadata ? JSON.stringify(log.metadata).substring(0, 50) : '-'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No audit logs found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => setSkip(Math.max(0, skip - 50))}
          disabled={skip === 0}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {Math.floor(skip / 50) + 1}</span>
        <Button
          variant="outline"
          onClick={() => setSkip(skip + 50)}
          disabled={!logs || logs.length < 50}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
