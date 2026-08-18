import { Shield } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';

interface AdminGuardProps {
  children: ReactNode;
}

/**
 * Reusable admin route/view guard. Prevents any protected component
 * from mounting for non-admin users. Shows an "Admin Access Required"
 * screen instead. The protected children never render for non-admins,
 * so no hooks, data fetches, or effects inside them execute.
 *
 * During auth loading, shows a neutral loading state so no protected
 * content flashes before the admin check completes.
 */
export default function AdminGuard({ children }: AdminGuardProps) {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Shield className="h-10 w-10 text-slate-200" />
          <p className="text-sm font-medium text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <div className="card p-10 text-center">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Admin Access Required</h2>
          <p className="text-sm text-slate-500">
            This page is restricted to administrators. If you believe you should have access, contact your account manager.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
