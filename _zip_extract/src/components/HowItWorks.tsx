import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GitFork, 
  Terminal, 
  Activity, 
  Cpu, 
  Bot, 
  ShieldAlert, 
  Play, 
  Lock, 
  Sparkles, 
  RotateCcw,
  RefreshCw
} from 'lucide-react';

interface Step {
  num: string;
  title: string;
  description: string;
  badge: string;
  icon: any;
  mockLogs: string[];
}

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps: Step[] = [
    {
      num: '01',
      title: 'Link and Sync',
      badge: 'Step 1 — Connect',
      description: 'Link your GitHub repo in minutes. PromptLedger scans files, establishes your behavioral baseline automatically, and listens for pull requests containing system instruction changes.',
      icon: GitFork,
      mockLogs: [
        'git init --baseline ./prompts',
        'Watching: /prompts/support_agent.txt',
        'Watching: /prompts/sql_coder.txt',
        'Webhook active: listening on merge event...'
      ]
    },
    {
      num: '02',
      title: 'Evaluate Behaviors',
      badge: 'Step 2 — Test',
      description: 'Every version change triggers a behavioral regression run. PromptLedger evaluates safety, helpfulness, tone, and accuracy. If the output falls below safety gates, the merge gets blocked with a root cause report.',
      icon: Activity,
      mockLogs: [
        'Evaluating branch: feat/friendly-support',
        'Running synthetic eval suite: 120 tokens analyzed',
        'Safety compliance check: FAILING on fee waivers policies',
        'Error: Build blocked! Compliance gate unmet.'
      ]
    },
    {
      num: '03',
      title: 'Continuous Tracking',
      badge: 'Step 3 — Monitor',
      description: 'Production outputs are continuously sampled. The moment your live LLM drifts from tested standards, PromptLedger alerts you, generating a structured root cause analysis so your team can roll back.',
      icon: ShieldAlert,
      mockLogs: [
        'Live Daemon active: sampling production traffic (interval: 30m)',
        'Fidelity drift matching active: 78% similitude calculated',
        'Incident #drift-32 generated for Slack/PagerDuty routing',
        'Automed rollback plan: Ready for v2.4.1 execution'
      ]
    }
  ];

  return (
    <div id="how-it-works" className="max-w-5xl mx-auto space-y-10">
      
      {/* Title */}
      <div className="flex flex-col items-center text-center max-w-xl mx-auto space-y-2.5">
        <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-550">
          Workflow Pipelines
        </span>
        <h2 className="font-serif text-3xl text-white font-bold tracking-tight">
          Three steps to complete behavioral testing
        </h2>
        <p className="text-xs text-neutral-450 leading-relaxed font-sans">
          From developer sandbox to continuous runtime monitoring, automate the entire prompt iteration lifecycle.
        </p>
      </div>

      {/* Step Indicators Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left column selector step buttons */}
        <div className="lg:col-span-5 space-y-3">
          {steps.map((step, idx) => {
            const stepNum = idx + 1;
            const isActive = activeStep === stepNum;
            const Icon = step.icon;
            
            return (
              <button
                key={step.num}
                onClick={() => setActiveStep(stepNum)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-300 flex items-start gap-4 ${
                  isActive 
                    ? 'bg-[#121212] border-neutral-700 text-white shadow-md shadow-black/30' 
                    : 'bg-transparent border-neutral-900 hover:border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-white border-white text-black' : 'bg-[#0a0a0a] border-neutral-800 text-neutral-500'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-neutral-500">
                      {step.badge}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </div>
                  <h3 className="font-serif text-base font-bold text-white tracking-tight leading-snug">{step.title}</h3>
                  <p className="text-xs text-neutral-400 leading-normal line-clamp-2">{step.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right column: Interactive mock code terminal simulation */}
        <div className="lg:col-span-7">
          <div className="bg-[#0b0b0b] border border-neutral-800/80 rounded-2xl overflow-hidden shadow-xl">
            {/* Window header */}
            <div className="px-4 py-3 bg-[#0d0d0d] border-b border-neutral-900 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/30" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/30" />
                <span className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/30" />
              </div>
              <span className="text-[10px] font-mono text-neutral-500 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-neutral-500" />
                system_daemon_trace.log
              </span>
            </div>

            {/* Terminal contents with logs */}
            <div className="p-5 font-mono text-xs text-neutral-300 space-y-4 min-h-[220px] flex flex-col justify-between">
              
              <div className="space-y-2">
                <div className="text-[11.5px] text-neutral-500 font-bold border-b border-neutral-900 pb-1.5 mb-2.5 flex justify-between items-center">
                  <span>ACTIVE SEQUENCE FOR STEP {steps[activeStep - 1].num}</span>
                  <span className="text-white hover:underline cursor-pointer flex items-center gap-1 text-[10px]" onClick={() => setActiveStep(prev => prev === 3 ? 1 : prev + 1)}>
                    Next Step
                    <RefreshCw className="w-2.5 h-2.5 animate-spin-slow" />
                  </span>
                </div>
                
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, x: 5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-2"
                  >
                    {steps[activeStep - 1].mockLogs.map((log, lIdx) => (
                      <div key={lIdx} className="flex items-start gap-2.5 leading-relaxed text-[11.5px]">
                        <span className="text-neutral-600 shrink-0 select-none">$&gt;</span>
                        <span className={log.includes('Error') || log.includes('FAILING') ? 'text-red-400' : log.includes('active') || log.includes('baselines') ? 'text-emerald-400' : 'text-neutral-300'}>
                          {log}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Status bar */}
              <div className="pt-4 border-t border-neutral-900 flex items-center justify-between text-[10px] text-neutral-500">
                <span>PromptLedger Cluster node-4</span>
                <span className="bg-[#121212] px-2 py-0.5 rounded border border-neutral-850">
                  SHA: cf807a
                </span>
              </div>

            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
