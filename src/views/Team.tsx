import { UsersRound, MessageSquare, Calendar, CheckSquare, Megaphone, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import type { View } from '@/App';

interface TeamProps {
  onNavigate: (view: View) => void;
}

type Tab = 'directory' | 'messages' | 'tasks' | 'calendar' | 'ai';

const TABS: { id: Tab; label: string; icon: typeof UsersRound }[] = [
  { id: 'directory', label: 'Directory', icon: UsersRound },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'ai', label: 'Team AI', icon: Sparkles },
];

export default function Team({ onNavigate }: TeamProps) {
  void onNavigate;
  const { user } = useAuth();

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto pb-bottom-nav md:pb-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Team Workspace</h1>
        <p className="text-sm text-slate-500 mt-1">Collaborate with your team on invoices, customers, and jobs.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-thin">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors whitespace-nowrap min-touch"
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Coming soon / not-yet-configured state */}
      <div className="card p-8 md:p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
          <UsersRound className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Team workspace setup required</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          The team collaboration hub is being set up for your workspace. Once enabled, you'll be able to
          invite team members, assign roles, chat, share files, manage tasks, and get AI-powered summaries.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left">
          {[
            { icon: UsersRound, title: 'Member Directory', desc: 'Invite and manage team roles' },
            { icon: MessageSquare, title: 'Messages', desc: '1-on-1 and group conversations' },
            { icon: CheckSquare, title: 'Tasks', desc: 'Assign work with due dates and priority' },
            { icon: Calendar, title: 'Shared Calendar', desc: 'Stay aligned on schedules' },
            { icon: Megaphone, title: 'Announcements', desc: 'Keep the team informed' },
            { icon: Sparkles, title: 'Team AI', desc: 'Summaries, task extraction, and recaps' },
          ].map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{feature.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{feature.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-slate-400 mt-6">
          Signed in as {user?.email}. Workspace setup will be available soon.
        </p>
      </div>
    </div>
  );
}
