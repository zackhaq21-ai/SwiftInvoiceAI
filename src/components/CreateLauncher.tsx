import { useEffect } from 'react';
import { FileText, FileSpreadsheet, User, Receipt, Package, X, Sparkles, Mic } from 'lucide-react';
import type { View } from '@/App';

interface CreateLauncherProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: View) => void;
}

const CREATE_OPTIONS = [
  { id: 'invoice', label: 'Invoice', desc: 'Create and send a new invoice', icon: FileText, view: { name: 'editor' } as View, accent: 'from-indigo-500 to-blue-500' },
  { id: 'estimate', label: 'Estimate', desc: 'Send a quote or estimate', icon: FileSpreadsheet, view: { name: 'editor', documentType: 'estimate' } as View, accent: 'from-cyan-500 to-teal-500' },
  { id: 'ai', label: 'Create with AI', desc: 'Describe a job, let AI build it', icon: Sparkles, view: { name: 'editor', aiMode: true } as View, accent: 'from-violet-500 to-indigo-500' },
  { id: 'voice', label: 'Voice Invoice', desc: 'Speak your invoice', icon: Mic, view: { name: 'voice' } as View, accent: 'from-blue-500 to-cyan-500' },
  { id: 'customer', label: 'Customer', desc: 'Add a new customer', icon: User, view: { name: 'clients' } as View, accent: 'from-emerald-500 to-teal-500' },
  { id: 'expense', label: 'Expense', desc: 'Record a business expense', icon: Receipt, view: { name: 'expenses' } as View, accent: 'from-amber-500 to-orange-500' },
  { id: 'item', label: 'Item / Service', desc: 'Add a product or service', icon: Package, view: { name: 'products' } as View, accent: 'from-slate-500 to-slate-600' },
] as const;

export default function CreateLauncher({ open, onClose, onNavigate }: CreateLauncherProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSelect = (view: View) => {
    onClose();
    onNavigate(view);
  };

  return (
    <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-slate-900/40 animate-overlay backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="relative w-full bg-white rounded-t-3xl shadow-2xl animate-sheet-in safe-area-pb max-h-[85vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Create new"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Create</h2>
            <p className="text-sm text-slate-500">What would you like to make?</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors min-touch"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="px-4 pb-6 grid grid-cols-2 gap-3">
          {CREATE_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt.view)}
                className="flex flex-col items-start gap-2.5 p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] transition-all text-left min-touch"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${opt.accent} flex items-center justify-center shadow-sm`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 leading-tight">{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
