import { Home, Users, FileText, UsersRound, Plus } from 'lucide-react';
import type { View } from '@/App';

interface MobileBottomNavProps {
  current: string;
  onNavigate: (view: View) => void;
  onCreate: () => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'clients', label: 'Customers', icon: Users },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'team', label: 'Team', icon: UsersRound },
] as const;

export default function MobileBottomNav({ current, onNavigate, onCreate }: MobileBottomNavProps) {
  const leftNav = NAV_ITEMS.slice(0, 2);
  const rightNav = NAV_ITEMS.slice(2);

  const renderItem = (item: typeof NAV_ITEMS[number]) => {
    const Icon = item.icon;
    const active = current === item.id || (item.id === 'invoices' && (current === 'editor' || current === 'preview'));
    return (
      <button
        key={item.id}
        onClick={() => onNavigate({ name: item.id } as View)}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 min-touch transition-colors"
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
      >
        <Icon
          className={`w-5 h-5 transition-colors ${active ? 'text-indigo-600' : 'text-slate-400'}`}
          strokeWidth={active ? 2.4 : 2}
        />
        <span className={`text-[10px] font-medium transition-colors ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 safe-area-pb"
      aria-label="Primary navigation"
    >
      <div className="flex items-center justify-around px-2 h-16 relative">
        {leftNav.map(renderItem)}

        {/* Center Create action */}
        <div className="flex flex-col items-center -mt-6">
          <button
            onClick={onCreate}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 active:scale-95 transition-transform min-touch"
            aria-label="Create new"
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </button>
        </div>

        {rightNav.map(renderItem)}
      </div>
    </nav>
  );
}
