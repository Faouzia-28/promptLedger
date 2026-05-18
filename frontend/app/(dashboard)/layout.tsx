'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LogOut, LayoutDashboard, Target, TriangleAlert, ClipboardList, Settings, GitBranch, BarChart3, FlaskConical, FileCog } from 'lucide-react';

const navItems = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/units', label: 'Behavior Units', icon: Target },
  { href: '/evals', label: 'Evals', icon: FileCog },
  { href: '/drift', label: 'Drift Events', icon: TriangleAlert },
  { href: '/audit', label: 'Audit Log', icon: ClipboardList },
  { href: '/github', label: 'GitHub Sync', icon: GitBranch },
  { href: '/templates', label: 'Scoring Templates', icon: FlaskConical },
  { href: '/metrics', label: 'Metrics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useCurrentUser();
  const [mounted, setMounted] = useState(false);

  const isActivePath = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    setMounted(true);
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a] text-zinc-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-[rgba(255,255,255,0.06)] md:bg-[#0f0f0f]">
        <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
          <div className="rounded-xl bg-[#111111] px-2.5 py-1.5 text-2xl font-light tracking-[-0.02em] text-zinc-100 shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_16px_rgba(255,255,255,0.05)]">PL</div>
          <div>
            <div className="font-semibold text-zinc-100">PromptLedger</div>
            <div className="text-xs text-zinc-400">
              Org {user?.org_id ? user.org_id.slice(0, 8) : 'unknown'}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-all ${isActivePath(item.href) ? 'border-l-2 border-l-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.06)] pl-[14px] text-zinc-100' : 'border-l-2 border-l-transparent px-3 text-zinc-400 hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-100'}`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-[rgba(255,255,255,0.06)] px-3 py-4 space-y-2">
          <div className="truncate px-3 py-2 text-xs text-zinc-400">{user?.email}</div>
          <Button
            variant="ghost"
            className="w-full justify-start text-zinc-400 hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-100"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[rgba(10,10,10,0.72)] px-4 py-3 backdrop-blur-[8px]">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-[#111111] px-2 py-1 text-xl font-light tracking-[-0.02em] text-zinc-100 shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_16px_rgba(255,255,255,0.05)]">PL</div>
            <div className="text-sm font-semibold text-zinc-100">PromptLedger</div>
          </div>
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Open navigation menu" />
              }
            >
              <Menu className="w-5 h-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-r border-[rgba(255,255,255,0.06)] bg-[#0f0f0f] p-0">
              <nav className="space-y-1 px-3 py-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-all ${isActivePath(item.href) ? 'border-l-2 border-l-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.06)] pl-[14px] text-zinc-100' : 'border-l-2 border-l-transparent px-3 text-zinc-400 hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-100'}`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-[#0a0a0a]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
