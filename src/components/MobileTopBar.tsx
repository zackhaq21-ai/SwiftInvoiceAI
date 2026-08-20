import { MoreVertical } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import type { View } from '@/App';

interface MobileTopBarProps {
  title: string;
  onNavigate: (view: View) => void;
  onSignOut: () => void;
}

export default function MobileTopBar({ title, onNavigate, onSignOut }: MobileTopBarProps) {
  const { user, tier } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const secondaryNav: { label: string; view: View }[] = [
    { label: 'Products & Services', view: { name: 'products' } },
    { label: 'Expenses', view: { name: 'expenses' } },
    { label: 'Reports', view: { name: 'reports' } },
    { label: 'Settings', view: { name: 'settings' } },
  ];

  return (
    <header className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 safe-area-pt">
      <div className="flex items-center justify-between px-4 h-14">
        <h1 className="text-base font-bold text-slate-900 truncate">{title}</h1>

        <div className="flex items-center gap-1">
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors min-touch"
              aria-label="More options"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-11 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 animate-scale-in origin-top-right">
                {/* User info */}
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-900 truncate">{user?.email}</p>
                  <p className="text-xs text-slate-400 capitalize">{tier === 'admin' ? 'Admin' : `${tier} plan`}</p>
                </div>

                {/* Secondary nav */}
                <div className="py-1">
                  {secondaryNav.map(item => (
                    <button
                      key={item.label}
                      onClick={() => { onNavigate(item.view); setMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors min-touch"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-100 py-1">
                  <button
                    onClick={() => { onSignOut(); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors min-touch"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
