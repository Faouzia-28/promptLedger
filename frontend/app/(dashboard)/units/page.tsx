'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useBehaviorUnits } from '@/lib/hooks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { FileCode2, Tags, BookOpenText, Brain, FileText, Languages, Target, Plus, type LucideIcon } from 'lucide-react';
import api from '@/lib/api';
import { mutate } from 'swr';

export default function UnitsPage() {
  const { data: units, isLoading } = useBehaviorUnits();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitType, setUnitType] = useState('llm');
  const [error, setError] = useState('');

  const getTypeIcon = (type: string) => {
    const icons: Record<string, LucideIcon> = {
      completion: FileCode2,
      classification: Tags,
      rag: BookOpenText,
      reasoning: Brain,
      summarization: FileText,
      translation: Languages,
    };
    return icons[(type || 'llm').toLowerCase()] || Target;
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      healthy: 'bg-green-500',
      degraded: 'bg-yellow-500',
      critical: 'bg-red-500',
    };
    return colors[(status || '').toLowerCase()] || 'bg-gray-500';
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setUnitType('llm');
    setError('');
  };

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      await api.post('/units', {
        name,
        description: description || null,
        unit_type: unitType,
      });

      await mutate('/units');
      setCreateOpen(false);
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create behavior unit');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  if (!units || units.length === 0) {
    return (
      <>
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Behavior Units</h1>
            <p className="text-muted-foreground">Monitor and manage your LLM behavior units</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Unit
          </Button>
        </div>

        <Card className="p-12 text-center space-y-4">
          <p className="text-lg font-semibold">No behavior units yet</p>
          <p className="text-sm text-muted-foreground">
            Start by creating a unit, then push two versions and run a semantic diff to establish your baseline.
          </p>
          <div className="mx-auto max-w-lg rounded-md border border-border bg-muted/20 p-4 text-left text-sm">
            <p className="font-medium mb-2">Recommended first-run flow</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Create one unit for your main prompt</li>
              <li>Push version 1 (current prompt)</li>
              <li>Push version 2 (candidate prompt)</li>
              <li>Create a small eval set (5-10 cases)</li>
              <li>Run semantic diff and eval</li>
            </ol>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Unit
          </Button>
        </Card>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <form onSubmit={handleCreateUnit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Create Behavior Unit</DialogTitle>
              </DialogHeader>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="space-y-2">
                <Label htmlFor="unit-name">Name</Label>
                <Input
                  id="unit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Customer Support Assistant"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit-description">Description</Label>
                <Input
                  id="unit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tracks support responses and refusal behavior"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit-type">Unit Type</Label>
                <select
                  id="unit-type"
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
                >
                  <option value="llm">LLM</option>
                  <option value="completion">Completion</option>
                  <option value="classification">Classification</option>
                  <option value="rag">RAG</option>
                  <option value="reasoning">Reasoning</option>
                  <option value="summarization">Summarization</option>
                  <option value="translation">Translation</option>
                </select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Unit'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Behavior Units</h1>
          <p className="text-muted-foreground">Monitor and manage your LLM behavior units</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Unit
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {units.map((unit: any) => (
          <Link key={unit.id} href={`/units/${unit.id}`}>
            <Card className="p-6 hover:border-primary transition-colors cursor-pointer h-full">
              {(() => {
                const unitTypeValue = unit.unit_type || unit.type || 'llm';
                const unitStatusValue = unit.status || 'healthy';
                const Icon = getTypeIcon(unitTypeValue);

                return (
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Icon className="w-7 h-7 text-primary shrink-0" />
                        <div>
                          <h3 className="font-semibold text-foreground">{unit.name}</h3>
                          <p className="text-xs text-muted-foreground">{unitTypeValue}</p>
                        </div>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(unitStatusValue)}`} />
                    </div>

                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{unit.description}</p>

                    <div className="space-y-2 border-t border-border pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Versions</span>
                        <span className="font-medium">{unit.version_count || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant="outline" className="capitalize">
                          {unitStatusValue}
                        </Badge>
                      </div>
                    </div>
                  </>
                );
              })()}
            </Card>
          </Link>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={handleCreateUnit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Create Behavior Unit</DialogTitle>
            </DialogHeader>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="space-y-2">
              <Label htmlFor="unit-name">Name</Label>
              <Input
                id="unit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer Support Assistant"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-description">Description</Label>
              <Input
                id="unit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tracks support responses and refusal behavior"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit-type">Unit Type</Label>
              <select
                id="unit-type"
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground"
              >
                <option value="llm">LLM</option>
                <option value="completion">Completion</option>
                <option value="classification">Classification</option>
                <option value="rag">RAG</option>
                <option value="reasoning">Reasoning</option>
                <option value="summarization">Summarization</option>
                <option value="translation">Translation</option>
              </select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create Unit'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
