import { useState } from 'react';
import { 
  GitFork, 
  ChevronDown, 
  Check, 
  Play, 
  Terminal, 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  ExternalLink,
  Github, 
  Sparkles, 
  Layers, 
  Lock,
  FileCheck,
  AlertOctagon,
  LifeBuoy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import ProblemStatement from './components/ProblemStatement';
import DashboardSimulation from './components/DashboardSimulation';
import FeatureGrid from './components/FeatureGrid';
import HowItWorks from './components/HowItWorks';
import PersonasAndMetrics from './components/PersonasAndMetrics';

export default function App() {
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<string>('');
  const [githubStars, setGithubStars] = useState<number>(3412);
  const [hasStarred, setHasStarred] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authOrgName, setAuthOrgName] = useState<string>('');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [authSuccess, setAuthSuccess] = useState<string>('');

  // Trigger non-blocking user alert
  const triggerNotification = (msg: string) => {
    setNotificationMsg(msg);
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
    }, 4000);
  };

  const handleStarToggle = () => {
    if (!hasStarred) {
      setGithubStars(p => p + 1);
      setHasStarred(true);
      triggerNotification("Thanks for starring PromptLedger on GitHub! 🌟");
    } else {
      setGithubStars(p => p - 1);
      setHasStarred(false);
    }
  };

  const scrollToAuth = () => {
    document.getElementById('auth-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const submitAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    const endpoint = authMode === 'signin' ? '/api/v1/auth/login' : '/api/v1/auth/register';
    const payload = authMode === 'signin'
      ? { email: authEmail, password: authPassword }
      : { org_name: authOrgName, email: authEmail, password: authPassword };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || data?.message || (authMode === 'signin' ? 'Login failed' : 'Registration failed'));
      }

      if (data?.access_token) {
        localStorage.setItem('access_token', data.access_token);
      }

      if (data?.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      setAuthSuccess(authMode === 'signin'
        ? 'Signed in successfully. Your session is active right here on the landing page.'
        : 'Account created successfully. Your session is active right here on the landing page.');

      triggerNotification(authMode === 'signin'
        ? 'Signed in without leaving the landing page.'
        : 'Created your account without leaving the landing page.');
    } catch (error: any) {
      const networkError = error.message?.includes('Failed to fetch')
        ? 'Cannot reach the backend API at /api/v1. Start it and try again.'
        : null;
      setAuthError(networkError || error.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200 selection:bg-neutral-800 selection:text-white relative overflow-x-hidden font-sans">
      
      {/* Background grids / glowing radial nodes */}
      <div className="absolute top-0 inset-x-0 h-[700px] radial-glow pulsate-subtle pointer-events-none" />
      <div className="absolute top-[1200px] right-0 w-[500px] h-[500px] bg-neutral-900/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[400px] left-0 w-[600px] h-[600px] bg-neutral-900/5 blur-[140px] pointer-events-none" />

      {/* Floating System-Wide Alerts Node */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#161616] border border-neutral-750 px-5 py-3 rounded-full text-xs font-mono text-white flex items-center gap-2.5 shadow-2xl backdrop-blur-md"
          >
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notificationMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. THE LANDING PAGE CANVAS (MAIN WRAPPER) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-24 sm:space-y-32">
        
        {/* HERO BLOCK WITH DISPLAY TYPOGRAPHY */}
        <section className="text-center pt-8 sm:pt-14 pb-4 space-y-8 flex flex-col items-center min-h-screen justify-center">
          
          {/* Tiny Pill label */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#101010] border border-neutral-850 px-3.5 py-1 rounded-full text-[10px] font-mono font-medium text-neutral-400 flex items-center gap-2 shadow"
          >
            <GitFork className="w-3.5 h-3.5 text-neutral-450" />
            <span>Continuous Integrity Layer for AI Behaviours</span>
          </motion.div>

          {/* Headings */}
          <div className="space-y-4 max-w-4xl">
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.1]">
              Git for AI Behavior. <br />
              <span className="italic font-normal text-neutral-400">CI/CD for LLM Prompts.</span>
            </h1>
            <p className="text-sm sm:text-lg text-neutral-400 leading-relaxed max-w-2xl mx-auto font-sans font-light">
              PromptLedger versions every prompt change, runs deep behavioral regression tests automatically, and alerts your team the moment your AI starts acting differently in production.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
            <button
              onClick={scrollToAuth}
              className="w-full sm:w-auto bg-[#eeeeee] hover:bg-white text-black font-semibold text-sm px-7 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-white/5 transition cursor-pointer"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => triggerNotification("Redirecting to source repository... Git connector enabled.")}
              className="w-full sm:w-auto bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 hover:border-neutral-750 text-white font-semibold text-sm px-7 py-3 rounded-xl flex items-center justify-center gap-2 transition"
            >
              <Github className="w-4 h-4" />
              <span>View on GitHub</span>
            </button>
          </div>

          <motion.section
            id="auth-panel"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="w-full max-w-5xl mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] items-stretch"
          >
            <div className="rounded-3xl border border-neutral-850 bg-[#070707]/90 p-6 sm:p-8 text-left space-y-4 shadow-2xl shadow-black/30 backdrop-blur-md">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-emerald-300">
                <Lock className="w-3.5 h-3.5" />
                <span>Inline auth flow</span>
              </div>
              <div className="space-y-2">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Sign in or create an account without leaving the landing page.
                </h2>
                <p className="text-sm text-neutral-400 leading-relaxed max-w-xl">
                  Keep the first interaction on-brand. The form below submits directly from the landing experience and stores your session locally when the backend responds.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 text-xs font-mono text-neutral-400">
                <div className="rounded-2xl border border-neutral-900 bg-black/40 p-3">
                  <div className="text-white font-semibold mb-1">No redirect</div>
                  <p>Auth happens inside the page.</p>
                </div>
                <div className="rounded-2xl border border-neutral-900 bg-black/40 p-3">
                  <div className="text-white font-semibold mb-1">Session ready</div>
                  <p>Tokens are saved when returned.</p>
                </div>
                <div className="rounded-2xl border border-neutral-900 bg-black/40 p-3">
                  <div className="text-white font-semibold mb-1">Switch modes</div>
                  <p>Use one card for both flows.</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-850 bg-[#0a0a0a]/95 p-6 sm:p-8 shadow-2xl shadow-black/30 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div>
                  <div className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">Workspace access</div>
                  <div className="mt-1 text-lg font-semibold text-white">{authMode === 'signin' ? 'Welcome back' : 'Create your workspace'}</div>
                </div>
                <div className="inline-flex rounded-full border border-neutral-800 bg-black/40 p-1 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signin'); setAuthError(''); setAuthSuccess(''); }}
                    className={`rounded-full px-3 py-1 transition ${authMode === 'signin' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthSuccess(''); }}
                    className={`rounded-full px-3 py-1 transition ${authMode === 'signup' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              <form onSubmit={submitAuth} className="space-y-4">
                {authError && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {authError}
                  </div>
                )}

                {authSuccess && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                    {authSuccess}
                  </div>
                )}

                {authMode === 'signup' && (
                  <label className="block space-y-2 text-sm">
                    <span className="text-neutral-300 font-medium">Organization Name</span>
                    <input
                      type="text"
                      value={authOrgName}
                      onChange={(e) => setAuthOrgName(e.target.value)}
                      placeholder="Acme Labs"
                      disabled={authLoading}
                      required
                      className="w-full rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-white placeholder:text-neutral-600 outline-none transition focus:border-neutral-700"
                    />
                  </label>
                )}

                <label className="block space-y-2 text-sm">
                  <span className="text-neutral-300 font-medium">Email</span>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@company.com"
                    disabled={authLoading}
                    required
                    className="w-full rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-white placeholder:text-neutral-600 outline-none transition focus:border-neutral-700"
                  />
                </label>

                <label className="block space-y-2 text-sm">
                  <span className="text-neutral-300 font-medium">Password</span>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={authLoading}
                    required
                    className="w-full rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-white placeholder:text-neutral-600 outline-none transition focus:border-neutral-700"
                  />
                </label>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {authLoading ? (authMode === 'signin' ? 'Signing in...' : 'Creating account...') : (authMode === 'signin' ? 'Sign In' : 'Create Account')}
                </button>

                <p className="text-center text-xs text-neutral-500">
                  {authMode === 'signin'
                    ? 'Signing in keeps you on this landing page and stores the session locally.'
                    : 'Signing up keeps you on this landing page and stores the session locally.'}
                </p>
              </form>
            </div>
          </motion.section>

          {/* Metrics Quick Strip */}
          <div className="pt-6 grid grid-cols-3 gap-6 sm:gap-12 border-t border-neutral-900/80 w-full max-w-lg text-center font-mono">
            <div className="space-y-0.5">
              <span className="text-white text-sm sm:text-lg font-bold">1 Click</span>
              <p className="text-[9.5px] text-neutral-500 tracking-wider">ROLLBACK SECURE</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-white text-sm sm:text-lg font-bold">5-D</span>
              <p className="text-[9.5px] text-neutral-500 tracking-wider">EVAL SIGNALS</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-white text-sm sm:text-lg font-bold">$0</span>
              <p className="text-[9.5px] text-neutral-500 tracking-wider">LOCAL RUN COSTS</p>
            </div>
          </div>

        </section>

        {/* SECTION: PROBLEM statement (RED ALERTS CARDS) */}
        <section id="problem-canvas">
          <ProblemStatement />
        </section>

        {/* SECTION: LIVE WORKSPACE SIMULATOR (REPLICA OF USER DASHBOARD) */}
        <section className="space-y-6">
          <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
              Brand Interface Demo
            </span>
            <h2 className="font-serif text-3xl text-white font-bold tracking-tight">
              Compare prompt changes and run regression gates live
            </h2>
            <p className="text-xs text-neutral-400 font-sans leading-relaxed">
              Interact directly with the sandbox below: toggle evaluation templates, run synthetic regression tests, and explore the SOC2/EU AI compliant audit logs.
            </p>
          </div>
          
          <DashboardSimulation />
        </section>

        {/* SECTION: THE 6 BENTO FEATURE CARDS */}
        <section>
          <FeatureGrid />
        </section>

        {/* SECTION: HOW IT WORKS PIPELINE */}
        <section>
          <HowItWorks />
        </section>

        {/* SECTION: TARGET PERSONAS & SPECS METRICS */}
        <section>
          <PersonasAndMetrics />
        </section>

        {/* BOTTOM CALL-TO-ACTION BLOCK */}
        <section className="text-center bg-gradient-to-t from-[#090909] to-[#040404] border border-neutral-850 p-8 sm:p-14 rounded-3xl relative overflow-hidden space-y-6">
          
          {/* Absolute background flare */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0)_60%)] pointer-events-none" />

          <div className="space-y-3 relative z-10">
            <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
              Instant Self Host
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-white font-bold tracking-tight">
              Start monitoring your AI behavior today.
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 font-medium">
              Free to self-host. No credit card required. Connect seamlessly with Ollama.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm relative z-10">
            <button 
              onClick={() => {
                window.location.href = '/register';
              }}
              className="bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-2.5 rounded-lg flex items-center gap-1.5 w-full sm:w-auto justify-center cursor-pointer transition"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => triggerNotification("Opening PromptLedger Open Source repository...")}
              className="bg-[#111111] hover:bg-[#161616] border border-neutral-800 text-white font-medium px-6 py-2.5 rounded-lg flex items-center gap-1.5 w-full sm:w-auto justify-center transition"
            >
              <Github className="w-3.5 h-3.5" />
              <span>View on GitHub</span>
            </button>
          </div>

        </section>

      </main>

      {/* 3. SOLID TYPOGRAPHIC BRAND FOOTER */}
      <footer className="bg-[#060606] border-t border-neutral-900/80 py-12 mt-12 text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-neutral-900/60">
            {/* Left brand details */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center font-serif text-[#050505] font-extrabold text-[11px] shadow-sm">
                  PL
                </div>
                <span className="font-serif font-black text-xs text-white tracking-tight">
                  PromptLedger
                </span>
              </div>
              <p className="text-neutral-400 font-serif italic max-w-sm">
                "The reliability layer between writing a prompt and trusting it in production."
              </p>
            </div>

            {/* Right links strip */}
            <div className="flex gap-8">
              <div className="space-y-2">
                <p className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest font-bold">RESOURCES</p>
                <div className="flex flex-col gap-1.5">
                  <a href="#how-it-works" className="hover:text-neutral-300">Self Hosting Docs</a>
                  <a href="#simulated-workspace" className="hover:text-neutral-300">Semantic Align Rules</a>
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest font-bold">COMPLIANCE</p>
                <div className="flex flex-col gap-1.5">
                  <span className="text-neutral-500 cursor-not-allowed">Article 13 Guide</span>
                  <span className="text-neutral-500 cursor-not-allowed">SOC2 Governance</span>
                </div>
              </div>
            </div>
          </div>

          {/* Final Row */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[10.5px] font-mono text-neutral-600">
            <span>&copy; {new Date().getFullYear()} PromptLedger Project. Released under local Apache-2.0 License guidelines.</span>
            <div className="flex gap-4">
              <span className="hover:text-neutral-400 cursor-pointer" onClick={() => triggerNotification("Secure gateway protocol: AES-256 TLS 1.3 active.")}>Security Protocol</span>
              <span>&middot;</span>
              <span className="hover:text-neutral-400 cursor-pointer" onClick={() => triggerNotification("All cryptographic trails signed locally with verified keypairs.")}>Audit Compliance</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
