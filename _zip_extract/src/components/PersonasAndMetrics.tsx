import { 
  Terminal, 
  Settings, 
  ClipboardCheck, 
  Cpu, 
  Activity, 
  ShieldCheck, 
  Lock, 
  FileCheck, 
  Coins 
} from 'lucide-react';
import { motion } from 'motion/react';

export default function PersonasAndMetrics() {
  const personas = [
    {
      title: 'AI Engineering Teams',
      role: 'PROMPT SHIP SPEED',
      desc: 'Ship prompt changes fast without breaking production behavior. Safely test refinements against concrete historical regression test baselines before deploying.',
      icon: Terminal,
      color: 'border-neutral-800'
    },
    {
      title: 'ML Platform Teams',
      role: 'ENTERPRISE GOVERNANCE',
      desc: 'Add behavioral governance and drift detection nodes to your existing LLM orchestration layer in minutes. Easily proxy outputs and capture drift metrics automatically.',
      icon: Settings,
      color: 'border-neutral-800'
    },
    {
      title: 'Compliance & Safety Teams',
      role: 'REGULATORY RISK',
      desc: 'Instantly construct tamper-proof audit trails, signed behavioral logs, and one-click Article 13 reports. Meet EU AI Act specifications with absolute diagnostic security.',
      icon: ClipboardCheck,
      color: 'border-neutral-800'
    }
  ];

  const metrics = [
    { value: '6-Agent', label: 'Autonomous Pipelines', description: 'Collaborating agents to audit prompt drift causes.' },
    { value: '5-Dim', label: 'Behavioral Evaluators', description: 'Scores accuracy, safety, safety parameters, tone and alignment.' },
    { value: '30-Min', label: 'Drift Sampling Loop', description: 'Continuous baseline fingerprint comparison cycles.' },
    { value: '100%', label: 'Signed Audit Trails', description: 'Cryptographically sealed SHA logs for every single prompt version.' },
    { value: 'EU Act', label: 'Article 13 Compliance', description: 'Fully conformant out-of-the-box system logging.' },
    { value: '$0 / mo', label: 'Ollama Integration', description: 'Run evaluations totally free using local quantized model endpoints.' }
  ];

  return (
    <div id="personas-and-metrics" className="space-y-16">
      
      {/* 1. METRICS / STATS SECTION */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
            PromptLedger Specifications
          </span>
          <h2 className="font-serif text-3xl text-white font-bold tracking-tight">
            Designed for critical enterprise precision
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {metrics.map((m, idx) => (
            <motion.div
              key={idx}
              whileHover={{ scale: 1.02, borderColor: 'rgba(255,255,255,0.2)' }}
              className="bg-[#0b0b0b]/90 border border-neutral-900 rounded-xl p-4 space-y-1 text-center flex flex-col justify-between transition-all"
            >
              <div className="space-y-1">
                <span className="text-2xl sm:text-3xl font-serif text-white font-bold leading-none tracking-tight block">
                  {m.value}
                </span>
                <span className="text-xs font-semibold font-mono text-neutral-300 block">
                  {m.label}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-900 leading-normal">
                {m.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 2. PERSONAS SECTION */}
      <div className="space-y-8">
        <div className="flex flex-col items-center text-center max-w-xl mx-auto space-y-2">
          <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
            User Profiles
          </span>
          <h2 className="font-serif text-3xl text-white font-bold tracking-tight">
            Tailor-made for LLM delivery structures
          </h2>
          <p className="text-xs text-neutral-400 font-sans leading-relaxed">
            Whether your day revolves around writing hooks, operating containers, or auditing compliance structures.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {personas.map((persona, idx) => {
            const Icon = persona.icon;
            return (
              <motion.div
                key={idx}
                whileHover={{ y: -3 }}
                className={`bg-[#111111] hover:bg-[#131313] border ${persona.color} p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden transition-all duration-300`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] font-mono font-bold tracking-wider text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                      {persona.role}
                    </span>
                    <Icon className="w-5 h-5 text-neutral-450" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-serif text-lg font-bold text-white tracking-tight">
                      {persona.title}
                    </h3>
                    <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                      {persona.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-950 mt-5 flex items-center gap-1 text-[11px] font-mono text-neutral-400">
                  <span>Standard capabilities included</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
