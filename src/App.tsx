import { lazy, Suspense, useState, useEffect } from 'react';
import {
  LayoutDashboard, FileText, Users, Mic, Settings,
  LogOut, Crown, Boxes, Receipt,
  BarChart3, FileSpreadsheet, Zap,
} from 'lucide-react';
import { useBusinessProfile } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { useBreakpoint } from '@/lib/useBreakpoint';
import { LogoWordmark, LogoMark } from '@/components/Logo';
import MobileBottomNav from '@/components/MobileBottomNav';
import MobileTopBar from '@/components/MobileTopBar';
import CreateLauncher from '@/components/CreateLauncher';
import Login from '@/views/Login';
import AdminGuard from '@/components/AdminGuard';
import AppErrorBoundary from '@/components/AppErrorBoundary';

const Dashboard = lazy(() => import('@/views/Dashboard'));
const InvoiceList = lazy(() => import('@/views/InvoiceList'));
const InvoiceEditor = lazy(() => import('@/views/InvoiceEditor'));
const InvoicePreview = lazy(() => import('@/views/InvoicePreview'));
const Clients = lazy(() => import('@/views/Clients'));
const Products = lazy(() => import('@/views/Products'));
const VoiceInvoice = lazy(() => import('@/views/VoiceInvoice'));
const SettingsView = lazy(() => import('@/views/Settings'));
const UpgradeModal = lazy(() => import('@/views/UpgradeModal'));
const PayInvoice = lazy(() => import('@/views/PayInvoice'));
const Expenses = lazy(() => import('@/views/Expenses'));
const Reports = lazy(() => import('@/views/Reports'));
const Estimates = lazy(() => import('@/views/Estimates'));
const Legal = lazy(() => import('@/views/Legal'));
const PaidCustomers = lazy(() => import('@/views/PaidCustomers'));
const QuickInvoice = lazy(() => import('@/views/QuickInvoice'));
const Team = lazy(() => import('@/views/Team'));

export type View =
  | { name: 'dashboard' }
  | { name: 'invoices' }
  | { name: 'quick-invoice' }
  | { name: 'editor'; invoiceId?: string; documentType?: 'invoice' | 'estimate'; aiMode?: boolean }
  | { name: 'preview'; invoiceId: string }
  | { name: 'estimates' }
  | { name: 'clients' }
  | { name: 'products' }
  | { name: 'expenses' }
  | { name: 'reports' }
  | { name: 'voice' }
  | { name: 'settings' }
  | { name: 'team' }
  | { name: 'paid-customers' }
  | { name: 'pay'; invoiceId: string }
  | { name: 'legal'; page: string };

function viewFromPath(): View {
  const path = window.location.pathname;
  const payMatch = path.match(/^\/pay\/([a-f0-9-]+)$/i);
  if (payMatch) return { name: 'pay', invoiceId: payMatch[1] };
  if (path === '/invoices/new') return { name: 'editor' };
  const editorMatch = path.match(/^\/invoices\/([a-f0-9-]+)\/edit$/i);
  if (editorMatch) return { name: 'editor', invoiceId: editorMatch[1] };
  const previewMatch = path.match(/^\/invoices\/([a-f0-9-]+)$/i);
  if (previewMatch) return { name: 'preview', invoiceId: previewMatch[1] };
  const navMap: Record<string, View> = {
    '/dashboard': { name: 'dashboard' },
    '/invoices': { name: 'invoices' },
    '/quick-invoice': { name: 'quick-invoice' },
    '/estimates': { name: 'estimates' },
    '/voice': { name: 'voice' },
    '/clients': { name: 'clients' },
    '/products': { name: 'products' },
    '/expenses': { name: 'expenses' },
    '/reports': { name: 'reports' },
    '/settings': { name: 'settings' },
    '/paid-customers': { name: 'paid-customers' },
    '/team': { name: 'team' },
    '/privacy': { name: 'legal', page: 'privacy' },
    '/terms': { name: 'legal', page: 'terms' },
    '/refund': { name: 'legal', page: 'refund' },
    '/contact': { name: 'legal', page: 'contact' },
  };
  return navMap[path] || { name: 'dashboard' };
}

function ScreenLoader() {
  return (
    <div className="mx-auto w-full max-w-7xl p-4 md:p-8" role="status" aria-label="Loading screen">
      <div className="animate-pulse space-y-5">
        <div className="h-8 w-44 rounded-xl bg-slate-200/80" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map(item => <div key={item} className="h-28 rounded-2xl bg-white/80 shadow-sm" />)}
        </div>
        <div className="h-64 rounded-3xl bg-white/80 shadow-sm" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export default function App() {
  const { user, loading, tier, isAdmin, signOut } = useAuth();
  const { isMobile } = useBreakpoint();
  const [view, setView] = useState<View>(viewFromPath());
  const [sidebarOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { profile } = useBusinessProfile();

  const accent = profile?.accent_color || '#111827';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'quick-invoice', label: 'Quick Invoice', icon: Zap },
    { id: 'estimates', label: 'Estimates', icon: FileSpreadsheet },
    { id: 'voice', label: 'Voice Invoice', icon: Mic },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'products', label: 'Products', icon: Boxes },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  const adminNavItems = [
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'paid-customers', label: 'Paid Customers', icon: Crown },
  ] as const;

  function navigate(newView: View) {
    setView(newView);
    setCreateOpen(false);
    let path = '/';
    if (newView.name === 'pay') path = `/pay/${newView.invoiceId}`;
    else if (newView.name === 'editor') path = newView.invoiceId ? `/invoices/${newView.invoiceId}/edit` : '/invoices/new';
    else if (newView.name === 'preview') path = `/invoices/${newView.invoiceId}`;
    else if (newView.name === 'legal') path = `/${newView.page}`;
    else if (newView.name === 'team') path = '/team';
    else if (newView.name !== 'dashboard') path = `/${newView.name}`;
    window.history.pushState({ view: newView }, '', path);
  }

  async function handleSignOut() {
    await signOut();
    const loginView: View = { name: 'dashboard' };
    setView(loginView);
    setCreateOpen(false);
    setShowUpgrade(false);
    window.history.replaceState({ view: loginView }, '', '/');
  }

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
  }, [accent]);

  useEffect(() => {
    const onPop = () => setView(viewFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const currentNav = view.name === 'editor' || view.name === 'preview' ? 'invoices' : view.name;

  const mobileTitles: Record<string, string> = {
    dashboard: 'VELZICO',
    invoices: 'Invoices',
    'quick-invoice': 'Quick Invoice',
    editor: 'Edit Invoice',
    preview: 'Invoice',
    estimates: 'Estimates',
    clients: 'Customers',
    products: 'Products & Services',
    expenses: 'Expenses',
    reports: 'Reports',
    voice: 'Voice Invoice',
    settings: 'Settings',
    team: 'Team',
    'paid-customers': 'Paid Customers',
  };
  const mobileTitle = mobileTitles[view.name] || 'VELZICO';

  function renderView() {
    if (view.name === 'dashboard') return <Dashboard onNavigate={navigate} />;
    if (view.name === 'invoices') return <InvoiceList onNavigate={navigate} />;
    if (view.name === 'quick-invoice') return <QuickInvoice onNavigate={navigate} onUpgrade={() => setShowUpgrade(true)} />;
    if (view.name === 'editor') return <InvoiceEditor invoiceId={view.invoiceId} documentType={view.documentType} aiMode={view.aiMode} onNavigate={navigate} />;
    if (view.name === 'preview') return <InvoicePreview invoiceId={view.invoiceId} onNavigate={navigate} />;
    if (view.name === 'estimates') return <Estimates onNavigate={navigate} />;
    if (view.name === 'clients') return <Clients onNavigate={navigate} />;
    if (view.name === 'products') return <Products onNavigate={navigate} />;
    if (view.name === 'expenses') return <Expenses onNavigate={navigate} />;
    if (view.name === 'reports') return <AdminGuard><Reports onNavigate={navigate} /></AdminGuard>;
    if (view.name === 'voice') return <VoiceInvoice onNavigate={navigate} />;
    if (view.name === 'settings') return <SettingsView onUpgrade={() => setShowUpgrade(true)} />;
    if (view.name === 'team') return <Team onNavigate={navigate} />;
    if (view.name === 'paid-customers') return <AdminGuard><PaidCustomers accentColor={accent} /></AdminGuard>;
    if (view.name === 'pay') return <PayInvoice invoiceId={view.invoiceId} />;
    if (view.name === 'legal') return <Legal page={view.page} onNavigate={navigate} />;
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <LogoMark className="h-14 w-14" />
          <p className="text-sm font-medium text-slate-400">Loading VELZICO…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (view.name === 'pay') {
      return <Suspense fallback={<ScreenLoader />}><PayInvoice invoiceId={view.invoiceId} /></Suspense>;
    }
    if (view.name === 'legal') {
      return <Suspense fallback={<ScreenLoader />}><Legal page={view.page} onNavigate={navigate} /></Suspense>;
    }
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop / Tablet Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200/80 flex-col z-50 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } hidden md:flex`}
      >
        {/* Logo */}
        <div className="px-6 py-6 flex items-center justify-between">
          <LogoWordmark className="h-8 w-auto" showTagline />
        </div>

        {/* Quick Invoice button */}
        <div className="px-4 pb-4">
          <button
            onClick={() => navigate({ name: 'quick-invoice' })}
            className="w-full btn-primary"
            style={{ background: accent, boxShadow: `0 2px 8px ${accent}30` }}
          >
            <Zap className="w-4 h-4" />
            Quick Invoice
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = currentNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate({ name: item.id } as View)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'text-slate-900 bg-slate-100'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" style={active ? { color: accent } : undefined} />
                {item.label}
                {item.id === 'quick-invoice' && (
                  <span
                    className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: accent }}
                  >
                    FAST
                  </span>
                )}
                {item.id === 'voice' && (
                  <span
                    className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: accent }}
                  >
                    AI
                  </span>
                )}
              </button>
            );
          })}
          {/* Team nav */}
          <button
            onClick={() => navigate({ name: 'team' })}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              currentNav === 'team'
                ? 'text-slate-900 bg-slate-100'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Users className="w-[18px] h-[18px]" style={currentNav === 'team' ? { color: accent } : undefined} />
            Team
          </button>
          {isAdmin && (
            <div className="pt-3 mt-3 border-t border-slate-100">
              <p className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin</p>
              {adminNavItems.map(item => {
                const Icon = item.icon;
                const active = currentNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate({ name: item.id } as View)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'text-slate-900 bg-slate-100'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" style={active ? { color: accent } : undefined} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* Upgrade banner for free users */}
        {tier === 'free' && (
          <div className="px-3 pb-3">
            <button
              onClick={() => setShowUpgrade(true)}
              className="w-full bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-3 text-left hover:scale-[1.02] transition-transform"
            >
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-4 h-4" />
                <span className="text-sm font-semibold">Upgrade to Pro</span>
              </div>
              <p className="text-xs text-white/60">Unlimited invoices, email sending & more</p>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: accent }}
            >
              {(user.email || 'M').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700 truncate">{user.email}</p>
              <p className="text-xs text-slate-400 truncate capitalize">{tier === 'admin' ? 'Admin' : `${tier} plan`}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        {isMobile && view.name !== 'pay' && (
          <MobileTopBar title={mobileTitle} onNavigate={navigate} onSignOut={handleSignOut} />
        )}

        {/* Views */}
        <main className="flex-1 overflow-x-hidden pb-bottom-nav md:pb-0">
          <AppErrorBoundary onReset={() => navigate({ name: 'dashboard' })}>
            <Suspense fallback={<ScreenLoader />}>
              {renderView()}
            </Suspense>
          </AppErrorBoundary>
        </main>

        {/* Footer — desktop only */}
        <footer className="hidden md:block border-t border-slate-200/80 bg-white px-6 py-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <p>&copy; {new Date().getFullYear()} VELZICO. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <button onClick={() => navigate({ name: 'legal', page: 'privacy' })} className="hover:text-slate-600 transition-colors">Privacy Policy</button>
              <button onClick={() => navigate({ name: 'legal', page: 'terms' })} className="hover:text-slate-600 transition-colors">Terms of Service</button>
              <button onClick={() => navigate({ name: 'legal', page: 'refund' })} className="hover:text-slate-600 transition-colors">Refund &amp; Cancellation</button>
              <button onClick={() => navigate({ name: 'legal', page: 'contact' })} className="hover:text-slate-600 transition-colors">Contact &amp; Support</button>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile bottom navigation */}
      {isMobile && view.name !== 'pay' && (
        <MobileBottomNav current={currentNav} onNavigate={navigate} onCreate={() => setCreateOpen(true)} />
      )}

      {/* Mobile create launcher */}
      <CreateLauncher open={createOpen} onClose={() => setCreateOpen(false)} onNavigate={navigate} />

      <Suspense fallback={null}>
        <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      </Suspense>
    </div>
  );
}
