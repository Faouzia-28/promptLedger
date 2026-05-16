'use client';

import { useEffect, useMemo, useState } from 'react';
import { mutate } from 'swr';
import { Atom, ArrowLeftRight, History, Loader2, Save, Sparkles, FlaskConical } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { formatDateTime, safeJsonString } from '@/lib/dashboard';

const HISTORY_KEY = 'promptledger.scoringTemplates.history';

type TemplateHistoryItem = {
  system_prompt: string;
  user_template: string;
  saved_at: string;
};

function fallbackHeuristic(input: string, criteria: string, response: string) {
  const expectedWords = new Set(criteria.toLowerCase().split(/\s+/).filter((word) => word.length > 2));
  const responseWords = new Set(response.toLowerCase().split(/\s+/).filter((word) => word.length > 2));
  const overlap = expectedWords.size ? [...expectedWords].filter((word) => responseWords.has(word)).length / expectedWords.size : 0.5;
  const lengthRatio = Math.min(1, response.length / Math.max(1, input.length || criteria.length || 1));
  return Math.max(0, Math.min(1, overlap * 0.7 + lengthRatio * 0.3));
}

function formatPrompt(template: string, values: Record<string, string>) {
  return template
    .replaceAll('{input}', values.input)
    .replaceAll('{criteria}', values.criteria)
    .replaceAll('{response}', values.response)
    .replaceAll('{{input}}', values.input)
    .replaceAll('{{criteria}}', values.criteria)
    .replaceAll('{{response}}', values.response);
}

export default function ScoringTemplatesPage() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userTemplate, setUserTemplate] = useState('');
  const [savedSystemPrompt, setSavedSystemPrompt] = useState('');
  const [savedUserTemplate, setSavedUserTemplate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<TemplateHistoryItem[]>([]);
  const [testInput, setTestInput] = useState('Explain the refund policy in one clear sentence.');
  const [testCriteria, setTestCriteria] = useState('The response is helpful, concise, and policy-aware.');
  const [testResponse, setTestResponse] = useState('Refunds are available within 30 days if the purchase is eligible.');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/scoring-templates');
        const templates = response.data || {};
        const nextSystemPrompt = templates.system_prompt || '';
        const nextUserTemplate = templates.user_template || '';
        setSystemPrompt(nextSystemPrompt);
        setUserTemplate(nextUserTemplate);
        setSavedSystemPrompt(nextSystemPrompt);
        setSavedUserTemplate(nextUserTemplate);

        const storedHistory = typeof window !== 'undefined' ? window.localStorage.getItem(HISTORY_KEY) : null;
        setHistory(storedHistory ? JSON.parse(storedHistory) as TemplateHistoryItem[] : []);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load scoring templates');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const previewMessage = useMemo(() => {
    return {
      system: systemPrompt || '(empty system prompt)',
      user: formatPrompt(userTemplate || '{input}\n\nCriteria: {criteria}\nResponse: {response}', {
        input: testInput,
        criteria: testCriteria,
        response: testResponse,
      }),
    };
  }, [systemPrompt, userTemplate, testInput, testCriteria, testResponse]);

  const localScore = useMemo(() => fallbackHeuristic(testInput, testCriteria, testResponse), [testInput, testCriteria, testResponse]);

  const pushHistory = (nextSystemPrompt: string, nextUserTemplate: string) => {
    const nextHistory: TemplateHistoryItem[] = [
      { system_prompt: nextSystemPrompt, user_template: nextUserTemplate, saved_at: new Date().toISOString() },
      ...history,
    ].slice(0, 10);
    setHistory(nextHistory);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    }
  };

  const saveTemplates = async () => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      if (systemPrompt.trim() === '' || userTemplate.trim() === '') {
        throw new Error('Both system_prompt and user_template are required');
      }

      pushHistory(savedSystemPrompt || systemPrompt, savedUserTemplate || userTemplate);
      await api.post('/admin/scoring-templates', {
        system_prompt: systemPrompt,
        user_template: userTemplate,
      });
      await mutate('/admin/scoring-templates');
      setSavedSystemPrompt(systemPrompt);
      setSavedUserTemplate(userTemplate);
      setMessage('Scoring templates saved. New versions will use this prompt immediately.');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to save scoring templates');
    } finally {
      setBusy(false);
    }
  };

  const rollbackTemplate = (item: TemplateHistoryItem) => {
    setSystemPrompt(item.system_prompt);
    setUserTemplate(item.user_template);
    setMessage(`Loaded template snapshot from ${formatDateTime(item.saved_at)}. Save to apply it.`);
  };

  const generatedCases = [
    { input: 'Tell me the shipping time.', criteria: 'Helpful and concise shipping answer.', response: 'Shipping usually takes 2 to 5 business days.' },
    { input: 'Refuse a harmful request.', criteria: 'Must refuse unsafe content.', response: 'I cannot help with that request.' },
    { input: 'Summarize the meeting notes.', criteria: 'Accurate and short summary.', response: 'The meeting covered roadmap, pricing, and support follow-ups.' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scoring Templates</h1>
          <p className="text-muted-foreground">Edit the live scorer prompt, preview the formatted message, and keep a rollback history.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Runtime store</Badge>
          <Badge variant="outline">Local history</Badge>
        </div>
      </div>

      {(message || error) && (
        <Card className={error ? 'border-destructive/40 bg-destructive/5' : 'border-primary/40 bg-primary/5'}>
          <CardContent className="p-4 text-sm">
            <p className={error ? 'text-destructive' : 'text-foreground'}>{error || message}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="editor" className="w-full">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="preview">Live preview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="fuzz">Fuzz harness</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="mt-4 space-y-4">
          <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> System prompt</CardTitle>
                <CardDescription>The system prompt should anchor the scorer behavior and force the response format you expect.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="min-h-80 font-mono text-sm" placeholder="You are a strict evaluator..." />
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-primary" /> User template</CardTitle>
                <CardDescription>Supports the same placeholders used by the backend scorer: <code>{'{input}'}</code>, <code>{'{criteria}'}</code>, and <code>{'{response}'}</code>.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea value={userTemplate} onChange={(e) => setUserTemplate(e.target.value)} className="min-h-80 font-mono text-sm" placeholder="Input: {input}\nCriteria: {criteria}\nResponse: {response}" />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={saveTemplates} disabled={busy || isLoading}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save templates
            </Button>
            <Button variant="outline" onClick={() => { setSystemPrompt(savedSystemPrompt); setUserTemplate(savedUserTemplate); }} disabled={busy || isLoading}>
              Revert unsaved changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-4 space-y-4">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>Test prompt runner</CardTitle>
                <CardDescription>Enter a sample case and inspect the exact payload the scorer template produces.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-input">Input</Label>
                  <Input id="test-input" value={testInput} onChange={(e) => setTestInput(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test-criteria">Criteria</Label>
                  <Input id="test-criteria" value={testCriteria} onChange={(e) => setTestCriteria(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test-response">Response</Label>
                  <Textarea id="test-response" value={testResponse} onChange={(e) => setTestResponse(e.target.value)} className="min-h-28" />
                </div>
                <div className="rounded-2xl border border-border bg-muted/20 p-4">
                  <p className="text-sm font-medium">Approximate fallback score</p>
                  <p className="mt-1 text-3xl font-semibold">{localScore.toFixed(2)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">This is a local preview of the scoring fallback so you can see how the UI will react when the scorer cannot parse a strict JSON response.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>Formatted message</CardTitle>
                <CardDescription>Exactly what the backend scorer receives after placeholder substitution.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">System message</p>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-sm">{previewMessage.system}</pre>
                </div>
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">User message</p>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-sm">{previewMessage.user}</pre>
                </div>
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Expected JSON shape: <code>{safeJsonString({ overall: 0.92, rationale: 'short explanation' })}</code>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Versioned templates</CardTitle>
              <CardDescription>Snapshots are stored locally so you can roll back quickly during experiments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length > 0 ? history.map((item, index) => (
                <div key={`${item.saved_at}-${index}`} className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">Snapshot {index + 1}</p>
                      <p className="text-xs text-muted-foreground">Saved {formatDateTime(item.saved_at)}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => rollbackTemplate(item)}>
                      <History className="mr-2 h-4 w-4" />Rollback
                    </Button>
                  </div>
                  <Separator className="my-3" />
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">System prompt</p>
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{item.system_prompt}</pre>
                  <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">User template</p>
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{item.user_template}</pre>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">No local template history yet. Save a template to start building rollback snapshots.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fuzz" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            {generatedCases.map((sample) => (
              <Card key={sample.input} className="border-border/70">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-4 w-4 text-primary" /> Mock case</CardTitle>
                  <CardDescription>{sample.input}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Criteria</p>
                    <p className="mt-1 text-muted-foreground">{sample.criteria}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Response</p>
                    <p className="mt-1 text-muted-foreground">{sample.response}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Fallback score</p>
                    <p className="mt-1 text-2xl font-semibold">{fallbackHeuristic(sample.input, sample.criteria, sample.response).toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Guidance</CardTitle>
              <CardDescription>Use this page to confirm the scorer prompt is stable before you regrade large batches.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Keep the system prompt strict and machine-readable.</p>
              <p>• Keep the user template small enough that the LLM can reliably return JSON.</p>
              <p>• Use the live preview before saving, especially when changing the output schema.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
