import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  Activity, 
  ShieldAlert, 
  FileText, 
  GitFork, 
  Target, 
  BarChart, 
  Settings as SettingsIcon, 
  Bell, 
  LogOut, 
  Play, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  FileCheck, 
  ArrowRight,
  Sparkles,
  Search,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MOCK_PR_PAIRS, 
  MOCK_DRIFT_EVENTS, 
  MOCK_AUDIT_LOGS, 
  PromptSet, 
  DriftIncident 
} from '../types';

export default function DashboardSimulation() {
  const [activeTab, setActiveTab] = useState<string>('Overview');
  const [selectedPromptId, setSelectedPromptId] = useState<string>('support-agent');
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalProgress, setEvalProgress] = useState<number>(0);
  const [healthScore, setHealthScore] = useState<number>(94);
  const [evalOutputActive, setEvalOutputActive] = useState<boolean>(false);
  const [simulationPrompt, setSimulationPrompt] = useState<PromptSet>(MOCK_PR_PAIRS[0]);
  const [driftIncidents, setDriftIncidents] = useState<DriftIncident[]>(MOCK_DRIFT_EVENTS);
  const [customPromptA, setCustomPromptA] = useState<string>('');
  const [customPromptB, setCustomPromptB] = useState<string>('');
  const [customMode, setCustomMode] = useState<boolean>(false);

  // Update simulation prompt when selection changes
  useEffect(() => {
    if (!customMode) {
      const p = MOCK_PR_PAIRS.find(x => x.id === selectedPromptId);
      if (p) setSimulationPrompt(p);
    }
  }, [selectedPromptId, customMode]);

  const triggerEvaluation = () => {
    setIsEvaluating(true);
    setEvalProgress(0);
    setEvalOutputActive(false);
    
    const interval = setInterval(() => {
      setEvalProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsEvaluating(false);
          setEvalOutputActive(true);
          // Set dynamic health score based on prompt selection outcome
          if (customMode) {
            setHealthScore(65);
          } else {
            setHealthScore(selectedPromptId === 'sql-generator' ? 82 : selectedPromptId === 'support-agent' ? 35 : 42);
          }
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  const menuItems = [
    { name: 'Overview', icon: LayoutDashboard },
    { name: 'Behavior Units', icon: Layers },
    { name: 'Evals', icon: Activity },
    { name: 'Drift Events', icon: ShieldAlert, badge: driftIncidents.filter(x => x.status === 'open').length },
    { name: 'Audit Log', icon: FileText },
    { name: 'GitHub Sync', icon: GitFork },
    { name: 'Scoring Templates', icon: Target },
    { name: 'Metrics', icon: BarChart },
    { name: 'Settings', icon: SettingsIcon }
  ];

  // Helper to get severity color
  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'high':
      case 'critical':
        return 'bg-red-950/60 border border-red-850 text-red-400 text-xs px-2 py-0.5 rounded-full';
      case 'medium':
      case 'warning':
        return 'bg-amber-955/65 border border-amber-850 text-amber-400 text-xs px-2 py-0.5 rounded-full';
      default:
        return 'bg-blue-955/65 border border-blue-850 text-blue-400 text-xs px-2 py-0.5 rounded-full';
    }
  };

  // Helper for rendering glowing line graphs inside mock overview
  const renderSVGGraph = (hScore: number) => {
    const points = hScore < 50 
      ? "M 10 120 Q 90 100 170 110 T 330 115 T 490 135 T 650 145" // downward trend for bad health
      : "M 10 130 C 150 130, 250 120, 350 90 S 550 50, 650 45"; // upward trend for good health
    
    return (
      <svg className="w-full h-full" viewBox="0 0 660 160" preserveAspectRatio="none">
        <defs>
          <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.25" />
          </linearGradient>
          <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Animated Background under gradient */}
        <path 
          d={`${points} L 650 160 L 10 160 Z`} 
          fill="url(#glowGrad)" 
          className="transition-all duration-1000 ease-in-out"
        />
        
        {/* Main Line with white glow and gradient */}
        <motion.path 
          d={points} 
          fill="none" 
          stroke="#ffffff" 
          strokeWidth="3.5"
          filter="url(#glowFilter)"
          className="transition-all duration-1000 ease-in-out"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5 }}
        />
        
        {/* Interactive glow points on the graph */}
        <circle cx="650" cy={hScore < 50 ? "145" : "45"} r="5" fill="#ffffff" className="animate-ping" />
        <circle cx="650" cy={hScore < 50 ? "145" : "45"} r="4" fill="#ffffff" />
      </svg>
    );
  };

  return (
    <div id="simulated-workspace" className="w-full rounded-2xl border border-neutral-800/80 bg-[#060606] text-neutral-200 overflow-hidden shadow-2xl flex flex-col md:flex-row h-[680px]">
      
      {/* 1. SIDEBAR (MATCHES SCREENSHOT) */}
      <div className="w-full md:w-64 bg-[#090909] border-r border-neutral-900 flex flex-col justify-between shrink-0 h-1/5 md:h-full overflow-y-auto">
        <div>
          {/* Logo Brand Header */}
          <div className="p-4 flex items-center gap-3 border-b border-neutral-900/50">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-serif text-[#080808] font-bold text-base shadow-sm">
              PL
            </div>
            <div>
              <div className="font-serif font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                PromptLedger
              </div>
              <div className="text-[10px] font-mono text-neutral-550 leading-tight">
                Org dea5eb0b6
              </div>
            </div>
          </div>

          {/* Menus Layout */}
          <nav className="p-2 space-y-1 mt-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => setActiveTab(item.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-normal rounded-md transition-all duration-200 ${
                    isSelected 
                      ? 'bg-[#181818] text-white font-medium border-l-[3px] border-white/80 pl-2.5' 
                      : 'text-neutral-400 hover:text-neutral-100 hover:bg-[#111111]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-neutral-500'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && item.badge > 0 ? (
                    <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] px-1.5 py-0.5 rounded-md font-bold scale-90">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Account Profile at bottom of sidebar */}
        <div className="p-4 border-t border-neutral-900 bg-[#070707] flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 overflow-hidden">
            <div className="truncate">
              <p className="text-[10px] font-mono text-neutral-500">SIGNED IN AS</p>
              <p className="text-xs text-white/95 font-medium truncate">faouziaindira@gmail.com</p>
            </div>
            <button className="text-neutral-500 hover:text-white shrink-0">
              <Bell className="w-3.5 h-3.5 animate-pulse" />
            </button>
          </div>
          <button className="flex items-center gap-1.5 text-red-400/80 hover:text-red-400 text-[11px] font-mono pt-1">
            <LogOut className="w-3 h-3" />
            <span>Logout session</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN COGNITIVE WORKSPACE AREA */}
      <div className="flex-1 flex flex-col bg-[#0b0b0b] overflow-y-auto h-4/5 md:h-full">
        
        {/* Workspace Top Bar Header */}
        <header className="px-6 py-4 border-b border-neutral-900/60 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
              <Sparkles className="w-3 h-3 text-neutral-500" />
              <span>Promptledger Dashboard</span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-white tracking-tight mt-0.5">
              {activeTab === 'Overview' ? 'Hello faouziaindira' : activeTab}
            </h1>
            <p className="text-xs text-neutral-500 font-mono">
              dea5eb0b6-f3c / {activeTab.toLowerCase().replace(' ', '_')}
            </p>
          </div>
          <button className="relative w-10 h-10 rounded-full bg-[#111] hover:bg-[#181818] border border-neutral-800 flex items-center justify-center text-neutral-400 transition-all">
            <Bell className="w-4 h-4 text-white" />
            <div className="absolute top-2 w-2 h-2 rounded-full bg-red-500 animate-ping" />
          </button>
        </header>

        {/* Tabs Switching Content */}
        <div className="p-6 flex-1 space-y-6">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'Overview' && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Interactive Info Banner alert */}
              <div className="bg-[#121212] rounded-xl border border-neutral-800/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div className="space-y-1">
                  <span className="bg-emerald-950/40 text-emerald-400 text-[10px] px-2.5 py-1 rounded-md font-mono font-semibold border border-emerald-900/30">
                    INTERACTIVE PLATFORM SIMULATOR
                  </span>
                  <p className="text-xs text-neutral-300 mt-1.5 max-w-xl">
                    Change parameters, evaluate drift triggers, and observe how regression results and behavioral health charts respond directly in PromptLedger's interface.
                  </p>
                </div>
                <button 
                  onClick={() => setActiveTab('Evals')}
                  className="bg-white text-black hover:bg-neutral-200 text-xs py-1.5 px-3.5 rounded-lg font-medium flex items-center gap-1.5 self-end sm:self-auto shadow-md transition-all duration-200"
                >
                  <span>Go to Evals Screen</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                  <button
                    onClick={() => { window.location.href = '/'; }}
                    className="bg-white text-black hover:bg-neutral-200 text-xs py-1.5 px-3.5 rounded-lg font-medium flex items-center gap-1.5 self-end sm:self-auto shadow-md transition-all duration-200"
                  >
                    <span>Open Project</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
              </div>

              {/* HEALTH DASHBOARD BLOCK (MATCHES IMAGE SPEC) */}
              <div className="bg-[#111111] rounded-xl border border-neutral-800 p-5 shadow-lg relative overflow-hidden flex flex-col xl:flex-row justify-between gap-5">
                
                {/* Left Graph Panel */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-white tracking-tight">Health dashboard</h3>
                      <p className="text-xs text-neutral-400">Highlighted status for the latest runs, drift, and score trend.</p>
                    </div>
                    
                    {/* Glowing Health Score Badge */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-md border text-white font-bold tracking-tight ${
                        healthScore < 50 
                          ? 'bg-red-950/60 border-red-800/50 text-red-400' 
                          : 'bg-emerald-950/80 border-emerald-800/50 text-emerald-300'
                      }`}>
                        {healthScore}% health
                      </span>
                    </div>
                  </div>

                  {/* SVG glowing graph container */}
                  <div className="h-44 w-full bg-[#080808]/90 border border-neutral-900 rounded-lg p-2 relative overflow-hidden flex items-end">
                    <div className="absolute inset-0 pt-4 px-2 select-none pointer-events-none flex flex-col justify-between text-[9px] font-mono text-neutral-600">
                      <div className="flex justify-between border-b border-neutral-900/40 pb-1">
                        <span>100% BEHAVIORAL FIDELITY</span>
                        <span>DEPLOYED MATCH</span>
                      </div>
                      <div className="flex justify-between border-b border-neutral-900/40 pb-1">
                        <span>50% SPECIFICATIONS COMPLYING</span>
                        <span>DRIFT THRESHOLD LIMIT</span>
                      </div>
                      <div className="flex justify-between">
                        <span>0% CRITICAL FAILURES</span>
                        <span>BENCHMARK NOMINAL</span>
                      </div>
                    </div>
                    
                    {/* SVG canvas */}
                    <div className="w-full h-full relative z-10 pt-2 transition-all">
                      {renderSVGGraph(healthScore)}
                    </div>

                    {/* Chart overlay controls */}
                    <div className="absolute bottom-2 left-3 z-20 flex items-center gap-1.5 bg-[#0e0e0e]/90 border border-neutral-800/85 px-2.5 py-1 rounded-md text-[10px] font-mono text-neutral-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span>{healthScore < 50 ? 'TRENDING DOWN (DRIFT DETECTED)' : 'TRENDING UP (HEALTHY)'}</span>
                    </div>
                  </div>
                </div>

                {/* Right Summary Column cards */}
                <div className="w-full xl:w-72 flex flex-col gap-3 justify-center">
                  <div className="bg-[#0b0b0b] border border-neutral-850 p-4 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Behavior Units</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-serif font-bold text-white">
                        {customMode ? '2' : '1'}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400">active prompts</span>
                    </div>
                    <p className="text-[11.5px] text-neutral-400">Registered prompt surface endpoints currently syncing from version repo.</p>
                  </div>

                  <div className="bg-[#0b0b0b] border border-neutral-850 p-4 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Open Drift</span>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-3xl font-serif font-bold ${healthScore < 50 ? 'text-amber-400' : 'text-neutral-400'}`}>
                        {healthScore < 50 ? '1' : '0'}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400">active alerts</span>
                    </div>
                    <p className="text-[11.5px] text-neutral-400">{healthScore}% current behavioral health score matching benchmarks.</p>
                  </div>
                </div>
              </div>

              {/* BOTTOM ROW (4 METRIC DETAILS) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="bg-[#101010] border border-neutral-850/80 p-4 rounded-xl space-y-2">
                  <span className="text-[9.5px] font-mono uppercase tracking-wider text-neutral-400">Behavior Units</span>
                  <div className="text-3xl font-serif font-bold text-white">1</div>
                  <p className="text-[11px] text-neutral-550">Registered prompt surfaces</p>
                </div>

                <div className="bg-[#101010] border border-neutral-850/80 p-4 rounded-xl space-y-2">
                  <span className="text-[9.5px] font-mono uppercase tracking-wider text-neutral-400">Eval Runs</span>
                  <div className="text-3xl font-serif font-bold text-white flex items-center justify-between">
                    <span>{isEvaluating ? '4' : '3'}</span>
                    {isEvaluating && <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />}
                  </div>
                  <p className="text-[11px] text-neutral-550">{isEvaluating ? '1 run still evaluating...' : '0 runs still active'}</p>
                </div>

                <div className="bg-[#101010] border border-neutral-850/80 p-4 rounded-xl space-y-2">
                  <span className="text-[9.5px] font-mono uppercase tracking-wider text-neutral-400">Open Drift</span>
                  <div className="text-3xl font-serif font-bold text-white">{healthScore < 50 ? '1' : '0'}</div>
                  <p className="text-[11px] text-neutral-550">{healthScore}% health score</p>
                </div>

                <div className="bg-[#101010] border border-neutral-850/80 p-4 rounded-xl space-y-2">
                  <span className="text-[9.5px] font-mono uppercase tracking-wider text-neutral-400">Connected Repos</span>
                  <div className="text-3xl font-serif font-bold text-white">0</div>
                  <p className="text-[11px] text-neutral-550">0 GitHub PAT / Webhooks</p>
                </div>

              </div>

              {/* QUICK DEMO TRIGGERS PANEL */}
              <div className="border border-dashed border-neutral-800 rounded-xl p-5 bg-[#080808] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">Behavioral Drift Simulation</h4>
                  <p className="text-xs text-neutral-400">Trigger a simulated system update to see how the dashboard captures prompt modifications.</p>
                </div>
                <div className="flex gap-2.5 flex-wrap">
                  <button 
                    onClick={() => {
                      setHealthScore(94);
                    }}
                    className="bg-[#121212] hover:bg-[#1b1b1b] border border-neutral-800 text-neutral-300 text-xs font-mono py-1.5 px-3.5 rounded-lg transition-all"
                  >
                    Set Healthy (94%)
                  </button>
                  <button 
                    onClick={() => {
                      setHealthScore(35);
                    }}
                    className="bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-mono py-1.5 px-3.5 rounded-lg transition-all"
                  >
                    Force Drift Alert (35%)
                  </button>
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 2: BEHAVIOR UNITS */}
          {activeTab === 'Behavior Units' && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="flex justify-between items-center">
                <div className="text-sm font-mono text-neutral-400">Registered Prompt Surfaces</div>
                <button className="bg-white text-black px-3.5 py-1.5 rounded-lg text-xs font-medium">
                  + Register surface
                </button>
              </div>

              <div className="bg-[#111111] rounded-xl border border-neutral-800/80 overflow-hidden shadow-md">
                <table className="w-full text-left text-xs text-neutral-400">
                  <thead className="bg-[#151515] text-[10px] font-mono text-neutral-400 uppercase border-b border-neutral-850">
                    <tr>
                      <th className="p-4 font-semibold">Surface Endpoint Name</th>
                      <th className="p-4 font-semibold">Category</th>
                      <th className="p-4 font-semibold">Current Prompt Version</th>
                      <th className="p-4 font-semibold">Last Checked</th>
                      <th className="p-4 font-semibold">Fidelity Health</th>
                      <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900">
                    <tr className="hover:bg-[#141414] transition-colors">
                      <td className="p-4 font-medium text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        <span>Support Line Routing</span>
                      </td>
                      <td className="p-4">Customer Support</td>
                      <td className="p-4 font-mono text-neutral-300">v2.4.1 (8f2a93b)</td>
                      <td className="p-4">12 mins ago</td>
                      <td className="p-4 text-emerald-400 font-semibold">{healthScore}%</td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => { setActiveTab('Evals'); setSelectedPromptId('support-agent'); }}
                          className="bg-[#1f1f1f] text-neutral-200 px-2.5 py-1 rounded hover:bg-[#252525] transition"
                        >
                          Configure Evals
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* TAB 3: EVALS (THE ACTUAL COMPARISON PLAYGROUND SCREEN!) */}
          {activeTab === 'Evals' && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Selector Col */}
                <div className="space-y-4">
                  <div className="bg-[#121212] border border-neutral-850 p-4 rounded-xl space-y-4">
                    <h3 className="text-sm font-semibold text-white flex items-center justify-between">
                      <span>Regression Scenario</span>
                      <span className="text-[9px] font-mono text-neutral-500 bg-neutral-900 px-1.5 py-0.5 rounded">CI Sieve</span>
                    </h3>

                    {/* Pre-written test templates */}
                    <div className="space-y-2">
                      {MOCK_PR_PAIRS.map((set) => (
                        <button
                          key={set.id}
                          onClick={() => {
                            setCustomMode(false);
                            setSelectedPromptId(set.id);
                            setEvalOutputActive(false);
                          }}
                          className={`w-full text-left p-3 rounded-lg border text-xs transition duration-200 ${
                            selectedPromptId === set.id && !customMode
                              ? 'bg-neutral-900 border-neutral-700 text-white'
                              : 'bg-[#0f0f0f] border-neutral-900 hover:border-neutral-800 text-neutral-400'
                          }`}
                        >
                          <div className="font-semibold flex items-center justify-between">
                            <span>{set.name}</span>
                            <span className={getSeverityBadge(set.severity)}>{set.category}</span>
                          </div>
                          <p className="text-[11px] text-neutral-500 mt-1.5 truncate">{set.systemPromptA.substring(0, 50)}...</p>
                        </button>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-neutral-900">
                      <button 
                        onClick={() => {
                          setCustomMode(true);
                          setCustomPromptA("You are a helpful customer support representative.");
                          setCustomPromptB("You are a super chatty buddy representetative, reply yolo.");
                          setSelectedPromptId('custom');
                          setEvalOutputActive(false);
                        }}
                        className={`w-full text-center py-2 rounded-lg text-xs font-mono border transition ${
                          customMode 
                            ? 'bg-white text-black border-white' 
                            : 'bg-transparent text-neutral-400 border-neutral-850 hover:text-white hover:border-neutral-750'
                        }`}
                      >
                        Write Custom Prompt Diff
                      </button>
                    </div>

                    {/* CI Run Button */}
                    <button
                      onClick={triggerEvaluation}
                      disabled={isEvaluating}
                      className="w-full bg-[#eeeeee] hover:bg-white text-black font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition"
                    >
                      {isEvaluating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>EVALUATING IN PROGRESS ({evalProgress}%)</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>CHALLENGE NEW PROMPT</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  {/* CI pipeline steps check */}
                  {isEvaluating && (
                    <div className="bg-[#0e0e0e] border border-neutral-850 p-4 rounded-xl space-y-3 text-xs">
                      <div className="font-semibold text-white font-mono text-[10px] tracking-wider text-neutral-500 uppercase">PIPELINE TRACE</div>
                      <div className="space-y-2 font-mono text-[11px]">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Git watch hook triggered successfully.</span>
                        </div>
                        <div className={`flex items-center gap-2 ${evalProgress >= 40 ? 'text-emerald-400' : 'text-neutral-500'}`}>
                          {evalProgress >= 40 ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />}
                          <span>Generating LLM challenge synthetics...</span>
                        </div>
                        <div className={`flex items-center gap-2 ${evalProgress >= 70 ? 'text-emerald-400' : 'text-neutral-500'}`}>
                          {evalProgress >= 70 ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />}
                          <span>Computing semantic embedding distance.</span>
                        </div>
                        <div className={`flex items-center gap-2 ${evalProgress >= 100 ? 'text-emerald-400' : 'text-neutral-500'}`}>
                          {evalProgress >= 100 ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />}
                          <span>Compiling Article 13 signed compliance trail.</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Diffs & Output comparison Column (Middle & Right side combined) */}
                <div className="lg:col-span-2 space-y-4">
                  {customMode ? (
                    <div className="bg-[#121212] border border-neutral-850 p-4 rounded-xl space-y-4">
                      <h4 className="text-sm font-semibold text-white font-serif">Compose System Prompts Comparison</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono text-neutral-400 uppercase">Version A (Reference)</label>
                          <textarea 
                            value={customPromptA}
                            onChange={(e) => setCustomPromptA(e.target.value)}
                            className="w-full h-24 bg-[#0d0d0d] border border-neutral-850 rounded-lg p-3 text-xs text-neutral-300 focus:outline-none focus:border-neutral-700"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono text-neutral-400 uppercase font-semibold text-amber-500">Version B (Proposed / Challenger)</label>
                          <textarea 
                            value={customPromptB}
                            onChange={(e) => setCustomPromptB(e.target.value)}
                            className="w-full h-24 bg-[#0d0d0d] border border-neutral-850 rounded-lg p-3 text-xs text-neutral-300 focus:outline-none focus:border-amber-900"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#121212] border border-neutral-850 p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-center bg-[#181818] px-3.5 py-1.5 rounded-lg border border-neutral-800">
                        <span className="text-[11px] font-mono font-bold text-white uppercase">{simulationPrompt.name} (Active Workspace)</span>
                        <span className="text-[10px] font-mono text-neutral-400">Embedding Delta: <b>{simulationPrompt.embeddingDistance}</b></span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="p-3 bg-[#101010] border border-neutral-900 rounded-lg space-y-1.5">
                          <div className="text-[10px] font-mono text-neutral-500 font-semibold uppercase">Version A (Production Reference)</div>
                          <p className="text-neutral-300 italic">"{simulationPrompt.systemPromptA}"</p>
                        </div>
                        <div className="p-3 bg-[#101010] border border-neutral-900 rounded-lg space-y-1.5">
                          <div className="text-[10px] font-mono text-amber-450 font-semibold uppercase">Version B (Challenger)</div>
                          <p className="text-neutral-300 italic border-l-2 border-amber-600/50 pl-2">"{simulationPrompt.systemPromptB}"</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Test Outputs */}
                  <div className="bg-[#121212] border border-neutral-850 rounded-xl overflow-hidden shadow-md">
                    <div className="p-4 border-b border-neutral-850 bg-[#151515] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#2a2a2a] text-neutral-300 text-[10px] font-mono px-2 py-0.5 rounded">REGRESSION TEST INPUT</span>
                        <span className="text-xs text-neutral-400 truncate">"{simulationPrompt.userQuery}"</span>
                      </div>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs h-40 overflow-y-auto bg-[#0a0a0a]">
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono text-emerald-400 font-semibold">OUTPUT A (NOMINAL RESPONSE)</span>
                        <div className="p-2.5 bg-[#121212] rounded border border-neutral-900 text-neutral-300 leading-relaxed max-h-28 overflow-y-auto font-mono text-[11px]">
                          {simulationPrompt.outputA}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] font-mono text-red-400 font-semibold">OUTPUT B (CHALLENGER REGRESSION)</span>
                        <div className="p-2.5 bg-[#121212] rounded border border-neutral-900 text-neutral-300 leading-relaxed max-h-28 overflow-y-auto font-mono text-[11px]">
                          {simulationPrompt.outputB}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Outputs Scores Evals (Visible on success or after click) */}
                  <AnimatePresence>
                    {(evalOutputActive || !isEvaluating) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-[#121212] border border-neutral-850 p-4 rounded-xl space-y-4 overflow-hidden"
                      >
                        <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-bold border-b border-neutral-900 pb-2 flex items-center justify-between">
                          <span>BEHAVIORAL REGRESSION STATS (GATE ANALYSIS)</span>
                          <span className={`${simulationPrompt.severity === 'high' ? 'text-red-400 bg-red-955/40 border border-red-500/20' : 'text-amber-400 bg-amber-955/40 border border-amber-500/20'} text-[10px] px-2 py-0.5 rounded font-bold`}>
                            {simulationPrompt.severity === 'high' ? 'GATE FAIL' : 'GATE CAUTION'}
                          </span>
                        </h4>

                        <div className="space-y-3.5">
                          <div>
                            <div className="text-[11px] text-neutral-400 mb-1.5">
                              <b>Behavior Incident Detection:</b> {simulationPrompt.diffExplanation}
                            </div>
                          </div>

                          {/* 5-dimension indicators */}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {simulationPrompt.evalDimensions.map((dim) => (
                              <div key={dim.name} className="bg-[#0f0f0f] p-2.5 rounded-lg border border-neutral-900/60 text-center space-y-1">
                                <span className="text-[9.5px] text-neutral-400 tracking-tight block truncate font-medium">{dim.name}</span>
                                <div className="text-base font-bold font-mono flex items-baseline justify-center gap-1">
                                  <span className="text-neutral-500 text-xs">{dim.scoreA}</span>
                                  <span className="text-neutral-400">→</span>
                                  <span className={dim.status === 'failed' ? 'text-red-400' : 'text-emerald-400'}>{dim.scoreB}</span>
                                </div>
                                <span className={`text-[9px] font-mono uppercase tracking-tighter px-1.5 py-0.5 rounded leading-none ${
                                  dim.status === 'failed' 
                                    ? 'bg-red-950/40 text-red-400 border border-red-900/30' 
                                    : dim.status === 'passed' 
                                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30'
                                      : 'bg-neutral-900 text-neutral-400 border border-neutral-850'
                                }`}>
                                  {dim.status.toUpperCase()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>

              </div>

            </motion.div>
          )}

          {/* TAB 4: DRIFT EVENTS */}
          {activeTab === 'Drift Events' && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="flex justify-between items-center border-b border-neutral-900 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">Live Production Drift Log</h3>
                  <p className="text-xs text-neutral-500 font-mono">Continuous checking sampled output aggregates every 30 minutes</p>
                </div>
                <div className="bg-[#121212] border border-neutral-850 px-3 py-1.5 rounded-lg text-xs font-mono text-neutral-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Drift Daemon Running: Stable</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {driftIncidents.map((incident) => (
                  <div key={incident.id} className="bg-[#111111] border border-neutral-850 rounded-xl p-4 space-y-3.5 shadow-md hover:border-neutral-750 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={`text-[9.5px] font-mono px-2 py-0.5 rounded-full ${
                          incident.severity === 'critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {incident.severity.toUpperCase()}
                        </span>
                        <h4 className="text-sm font-semibold text-white tracking-tight mt-1.5">{incident.title}</h4>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-500">{incident.detectedAt}</span>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed border-l-2 border-neutral-800 pl-2">
                      {incident.description}
                    </p>

                    <div className="bg-[#0b0b0b] p-3 rounded-lg space-y-2 text-xs">
                      <div>
                        <span className="text-[9.5px] font-mono text-neutral-500 block">ROOT CAUSE INVESTIGATION</span>
                        <p className="text-[11.5px] text-neutral-300">{incident.rootCause}</p>
                      </div>
                      <div>
                        <span className="text-[9.5px] font-mono text-emerald-400 block">SOLUTIVE RECOMMENDATION</span>
                        <p className="text-[11.5px] text-neutral-300">{incident.recommendedAction}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <div className="text-[10px] font-mono text-neutral-400">
                        Fingerprint Change: <b>+{incident.behavioralFingerprintDelta}</b>
                      </div>
                      <button className="bg-neutral-200 hover:bg-white text-black text-xs font-semibold px-2.5 py-1 rounded transition">
                        Inspect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 5: AUDIT LOG */}
          {activeTab === 'Audit Log' && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 shrink-0"
            >
              <div className="flex justify-between items-center pb-2 border-b border-neutral-900">
                <div>
                  <h3 className="text-base font-bold text-white">Cryptographically Signed Audit Log</h3>
                  <p className="text-xs text-neutral-500 font-mono">Meets EU AI Act Article 13 & SOC2 Traceability rules</p>
                </div>
                <button 
                  onClick={() => alert("Downloading Signed EU AI Act Article 13 PDF Audit Report...\nCryptographic hash verified: cf8291a82f3\nActor: faouziaindira@gmail.com")}
                  className="bg-white hover:bg-neutral-200 text-black px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Export compliance PDF</span>
                </button>
              </div>

              <div className="space-y-2">
                {MOCK_AUDIT_LOGS.map((log) => (
                  <div key={log.id} className="bg-[#111] p-4 rounded-xl border border-neutral-850 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-mono">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#1f1f1f] text-neutral-300 text-[10px] px-1.5 py-0.5 rounded">SIGNED OPERATION</span>
                        <span className="text-white font-serif text-[13px]">{log.target}</span>
                      </div>
                      <p className="text-neutral-400 font-sans text-xs pt-1">{log.action}</p>
                    </div>

                    <div className="text-left md:text-right text-[11px] space-y-1 flex flex-row md:flex-col justify-between w-full md:w-auto border-t border-neutral-900 md:border-0 pt-2 md:pt-0">
                      <div className="text-neutral-400">Actor: <b className="text-white font-sans font-medium">{log.actor}</b></div>
                      <div className="text-[10px] text-neutral-500">SHA-256: {log.sha256}</div>
                      <div className="text-[10px] text-neutral-500">{log.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 6: GITHUB SYNC */}
          {activeTab === 'GitHub Sync' && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="bg-[#111111] border border-neutral-850 p-6 rounded-xl max-w-xl mx-auto space-y-4 text-center">
                <GitFork className="w-12 h-12 text-white/40 mx-auto animate-bounce" />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white font-serif">Connect GitHub Version Repo</h3>
                  <p className="text-xs text-neutral-400">
                    Connect and listen to any prompt file modifications. Code deployments automatically coordinate with PromptLedger's evaluation runner.
                  </p>
                </div>
                
                <div className="text-left bg-black border border-neutral-850 p-4 rounded-lg font-mono text-xs space-y-2">
                  <div className="flex justify-between text-neutral-500">
                    <span>WEBHOOK ENDPOINT</span>
                    <span className="text-emerald-400 font-bold">READY</span>
                  </div>
                  <div className="bg-[#111] p-2 rounded text-neutral-300 truncate tracking-tight">
                    https://api.promptledger.org/v1/webhooks/dea5eb0b6-f3c
                  </div>
                </div>

                <div className="pt-2">
                  <button className="bg-white text-black font-semibold text-xs py-2 px-6 rounded-lg shadow hover:bg-neutral-200 transition">
                    Sign in with GitHub
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* OTHERS: GENERIC FALLBACK */}
          {['Scoring Templates', 'Metrics', 'Settings'].includes(activeTab) && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 bg-[#111] rounded-xl border border-neutral-850 text-center space-y-2"
            >
              <SettingsIcon className="w-8 h-8 text-neutral-500 mx-auto animate-spin" />
              <h4 className="text-white font-serif text-sm font-semibold">{activeTab} Panel Config</h4>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                These controls synchronize with local configuration repositories. Review PromptLedger workspace properties to override compliance models.
              </p>
            </motion.div>
          )}

        </div>
      </div>

    </div>
  );
}
