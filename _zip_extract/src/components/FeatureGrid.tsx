import { useState, ReactNode } from 'react';
import { 
  GitBranch, 
  Settings, 
  RotateCcw, 
  FileCode, 
  ShieldCheck, 
  Network, 
  Eye, 
  Gauge, 
  AlertTriangle, 
  Clock, 
  Cpu, 
  ClipboardCheck, 
  Lock, 
  FileText 
} from 'lucide-react';
import { motion } from 'motion/react';

interface FeatureCardProps {
  title: string;
  badge?: string;
  description: string;
  icon: any;
  children?: ReactNode;
}

function FeatureCard({ title, badge, description, icon: Icon, children }: FeatureCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -4, borderColor: 'rgb(115,115,115)' }}
      className="bg-[#111111] hover:bg-[#141414] border border-neutral-850 p-6 rounded-2xl flex flex-col justify-between gap-5 transition-all duration-300 shadow-sm"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white">
            <Icon className="w-5 h-5 text-white/90" />
          </div>
          {badge && (
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-neutral-400 bg-neutral-900 border border-neutral-800 px-2.5 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        
        <div className="space-y-1.5">
          <h3 className="font-serif text-lg font-bold text-white tracking-tight leading-snug">{title}</h3>
          <p className="text-xs text-neutral-400 leading-relaxed font-sans">{description}</p>
        </div>
      </div>

      {children && (
        <div className="bg-[#090909] border border-neutral-905 rounded-xl p-3.5 mt-1 overflow-hidden">
          {children}
        </div>
      )}
    </motion.div>
  );
}

export default function FeatureGrid() {
  const [activeBranchTab, setActiveBranchTab] = useState<'main' | 'challenger'>('challenger');
  const [vectorDiffValue, setVectorDiffValue] = useState<number>(0.74);
  const [selectedPersona, setSelectedPersona] = useState<'agent' | 'user'>('agent');

  return (
    <div id="platform-features" className="space-y-8">
      
      {/* Bento Layout Header */}
      <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-3">
        <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-500 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
          Deep Behavioral Governance
        </span>
        <h2 className="font-serif text-3xl sm:text-4xl text-white font-bold tracking-tight">
          Reliability tools, built for prompt-driven workloads
        </h2>
        <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
          PromptLedger integrates directly into your pipeline, analyzing LLM response drift and testing constraints cryptographically on every commit.
        </p>
      </div>

      {/* Feature Grid Bento Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* 1. Version Control for Prompts */}
        <FeatureCard
          title="Version Control for Prompts"
          badge="Git Integrated"
          description="Every prompt, model config, and system instruction is versioned like a Git commit. Access full history, diff viewer, and rollback in one click."
          icon={GitBranch}
        >
          {/* Visual: Mini Commit Log Selector */}
          <div className="space-y-2 text-[10px] font-mono">
            <div className="flex justify-between items-center text-neutral-500 border-b border-neutral-900 pb-1">
              <span>COMMIT HISTORY</span>
              <span>SHA-256</span>
            </div>
            
            <div 
              onClick={() => setActiveBranchTab('main')}
              className={`p-1.5 rounded flex items-center justify-between cursor-pointer transition ${
                activeBranchTab === 'main' ? 'bg-[#1a1a1a] text-white border border-neutral-800' : 'text-neutral-400 opacity-60 hover:opacity-100'
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                v2.12.0 - "Safe Support agent bounds"
              </span>
              <span>8f2a93b</span>
            </div>

            <div 
              onClick={() => setActiveBranchTab('challenger')}
              className={`p-1.5 rounded flex items-center justify-between cursor-pointer transition ${
                activeBranchTab === 'challenger' ? 'bg-amber-950/20 text-amber-300 border border-amber-900/45' : 'text-neutral-400 opacity-60 hover:opacity-100'
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                v2.13.0 - "Friendly hipster tone"
              </span>
              <span className="text-amber-500 font-bold">1 Click Rollback</span>
            </div>
          </div>
        </FeatureCard>

        {/* 2. Behavioral Regression Testing */}
        <FeatureCard
          title="Behavioral Regression Testing"
          badge="Auto Evals"
          description="Push a change and PromptLedger automatically runs your custom evaluation suite. Score outputs on accuracy, safety, helpfulness, and tone to block degraded builds."
          icon={ShieldCheck}
        >
          {/* Visual: Grid of Gate Checkboxes */}
          <div className="space-y-2 text-[10px] font-mono">
            <span className="text-[9px] text-neutral-500 block">EVALUATION GATE CHECKS</span>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center bg-black/40 px-2 py-1 rounded">
                <span className="text-emerald-400 font-bold">✓ ACCURACY GATE</span>
                <span className="text-neutral-350">PASS (98/100)</span>
              </div>
              <div className="flex justify-between items-center bg-black/40 px-2 py-1 rounded">
                <span className="text-red-400 font-bold">✗ POLICY COMPLIANCE</span>
                <span className="text-red-300 font-bold">FAIL (10/100)</span>
              </div>
              <div className="flex justify-between items-center bg-neutral-900/60 p-1 rounded font-sans text-[10px] text-center text-neutral-400 border border-neutral-900">
                Gate rule triggered: Block branch merge
              </div>
            </div>
          </div>
        </FeatureCard>

        {/* 3. Semantic Diff */}
        <FeatureCard
          title="Semantic Diff"
          badge="Vector Sim"
          description="See not just what characters or lines changed, but how the AI's actual semantic behavior changed. Measures embedding vector distance, refusal rate deltas, and tone shifts."
          icon={Network}
        >
          {/* Visual: Semantic Distance Slider */}
          <div className="space-y-2.5 text-[10.5px] font-mono">
            <div className="flex justify-between items-center text-neutral-400">
              <span>Embedding Shift</span>
              <span className={vectorDiffValue > 0.6 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                {vectorDiffValue} Distance
              </span>
            </div>
            
            <input 
              type="range" 
              min="0.10" 
              max="0.99" 
              step="0.05"
              value={vectorDiffValue}
              onChange={(e) => setVectorDiffValue(parseFloat(e.target.value))}
              className="w-full accent-white bg-neutral-900 h-1 rounded-lg outline-none cursor-pointer"
            />
            
            <div className="text-[9px] text-neutral-500 leading-tight">
              {vectorDiffValue > 0.6 
                ? 'CRITICAL ALERT: Drastic semantic shift. The model behaves differently on baseline tests.' 
                : 'HEALTHY bounds: Minor textual tweaking detected without behavioral regression.'}
            </div>
          </div>
        </FeatureCard>

        {/* 4. Production Drift Detection */}
        <FeatureCard
          title="Production Drift Detection"
          badge="30m Cycle"
          description="Continuously sample production logs. PromptLedger maps live responses against the reference behavioral fingerprint to catch silent model updates or drift."
          icon={Gauge}
        >
          {/* Visual: Chrono timer loop */}
          <div className="flex items-center justify-between font-mono text-[10px] gap-3">
            <div className="flex items-center gap-1.5 text-neutral-400 bg-neutral-950 p-2 rounded border border-neutral-900">
              <Clock className="w-3.5 h-3.5 text-white animate-spin" strokeWidth={1.5} />
              <span>Next Check: 14m 32s</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-neutral-500 block">SAMPLING METRIC</span>
              <span className="text-white font-bold">1:20 Ratio</span>
            </div>
          </div>
        </FeatureCard>

        {/* 5. Root Cause Analysis */}
        <FeatureCard
          title="Root Cause Analysis"
          badge="Autonomous Agent"
          description="When behavioral anomalies or drift are detected, an automated AI agent investigates recent deploys, failed evals, or provider latency to issue structural incident reports."
          icon={Cpu}
        >
          {/* Visual: AI agent trace logs */}
          <div className="space-y-1.5 font-mono text-[9px] text-neutral-400">
            <div className="flex gap-2 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>DRIFT ERROR TRIGGERED (dea5eb0b6)</span>
            </div>
            <p className="bg-black p-2 rounded text-neutral-300 italic">
              "Investigated commit #f3ca. Tone adjustment introduced casual banking terminology, leading to a 42% drop in SEC compliance benchmarks."
            </p>
          </div>
        </FeatureCard>

        {/* 6. Compliance & Audit */}
        <FeatureCard
          title="Compliance & Audit"
          badge="EU AI Act"
          description="Every prompt transaction and pipeline audit is cryptographically signed. Generate robust, Article 13 compliance reports as high-fidelity auditable PDFs instantly."
          icon={ClipboardCheck}
        >
          {/* Visual: Cryptographic sign signature */}
          <div className="space-y-2 text-[10px] font-mono">
            <div className="flex items-center justify-between text-neutral-500">
              <span>SIGNATURE</span>
              <span>VERIFIED</span>
            </div>
            <div className="p-2 bg-neutral-950 border border-neutral-900 rounded flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate text-emerald-400 truncate max-w-[130px]">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>sha256-cf892af13...</span>
              </div>
              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/20">CRYPT-SEALED</span>
            </div>
          </div>
        </FeatureCard>

      </div>

    </div>
  );
}
