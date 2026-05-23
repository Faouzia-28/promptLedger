import { AlertOctagon, Sparkles, UserCheck, ShieldAlert, BadgeAlert } from 'lucide-react';
import { motion } from 'motion/react';

export default function ProblemStatement() {
  const problemPoints = [
    { text: 'A prompt tweak in staging', color: 'text-neutral-300' },
    { text: 'An silent underlying model update', color: 'text-neutral-300' },
    { text: 'A minor temperature parameter shift', color: 'text-neutral-300' }
  ];

  return (
    <div className="max-w-4xl mx-auto rounded-2xl border border-red-950/40 bg-gradient-to-b from-[#0e0a0a] to-[#070505] p-6 sm:p-10 shadow-lg relative overflow-hidden">
      
      {/* Absolute positioning background element */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-red-950/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
        
        {/* Core Message side */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2">
            <span className="bg-red-500/10 text-red-400 text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border border-red-500/15 flex items-center gap-1">
              <BadgeAlert className="w-3 h-3" />
              <span>The Production Blindspot</span>
            </span>
          </div>

          <h3 className="font-serif text-2xl sm:text-3xl text-white font-bold tracking-tight leading-tight">
            Your AI passed QA. <br />Then something changed.
          </h3>

          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed max-w-xl">
            A minor prompt tweak. A model configuration upgrade. An unannounced third-party provider weight change. Now it's refusing valid queries, hallucinating credentials, or leaking technical tokens — and you only found out from an angry user complaint.
          </p>

          <p className="text-xs sm:text-sm text-neutral-300 font-medium">
            There was no CI gate. No semantic regression test. No continuous live alert.
          </p>
          
          <div className="text-xs sm:text-sm text-white font-semibold flex items-center gap-2 pt-1 border-t border-neutral-900">
            <span>That's the critical gap PromptLedger fill-stops.</span>
          </div>
        </div>

        {/* Visual failure checklist side */}
        <div className="w-full md:w-80 shrink-0 bg-[#0f0b0b] border border-red-900/10 p-5 rounded-xl space-y-4 shadow-inner">
          <div className="text-[10px] font-mono text-red-400 font-bold tracking-widest flex items-center justify-between">
            <span>WITHOUT PROMPTLEDGER</span>
            <AlertOctagon className="w-4 h-4 text-red-500" />
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center gap-2.5 text-neutral-400 line-through decoration-red-900/50">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500/40" />
              <span>CI deployment gate limits</span>
            </div>
            <div className="flex items-center gap-2.5 text-neutral-400 line-through decoration-red-900/50">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500/40" />
              <span>Semantic correlation checks</span>
            </div>
            <div className="flex items-center gap-2.5 text-neutral-400 line-through decoration-red-900/50">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500/40" />
              <span>Ongoing model drift triggers</span>
            </div>
          </div>

          <div className="bg-red-500/5 border border-red-505/10 rounded p-2.5 text-[10.5px] text-red-400/95 font-sans leading-relaxed">
            <b>Result:</b> Silent system regression triggers, affecting production user sessions before alerts trigger.
          </div>
        </div>

      </div>

    </div>
  );
}
