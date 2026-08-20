import { Check, Clock, Mail, Eye, DollarSign, FileText, Send } from 'lucide-react';
import { buildDeliveryTimeline, getLatestVerifiedStage, type DeliveryStage } from '@/lib/deliveryTimeline';
import { formatDate, relativeTime } from '@/lib/format';
import type { Invoice } from '@/lib/types';

interface DeliveryTimelineProps {
  invoice: Invoice;
}

const STAGE_ICONS: Record<DeliveryStage, typeof FileText> = {
  created: FileText,
  sent: Send,
  delivered: Mail,
  opened: Eye,
  paid: DollarSign,
};

const SUMMARY_COPY: Record<DeliveryStage, string> = {
  created: 'Saved as a draft',
  sent: 'Sent to client',
  delivered: 'Delivered to inbox',
  opened: 'Opened by client',
  paid: 'Paid',
};

const SUMMARY_STYLE: Record<DeliveryStage, { bg: string; ring: string; icon: string; text: string; sub: string }> = {
  created: { bg: 'bg-slate-50', ring: 'ring-slate-100', icon: 'bg-slate-100 text-slate-500', text: 'text-slate-800', sub: 'text-slate-400' },
  sent: { bg: 'bg-slate-50', ring: 'ring-slate-100', icon: 'bg-slate-100 text-slate-500', text: 'text-slate-800', sub: 'text-slate-400' },
  delivered: { bg: 'bg-blue-50/60', ring: 'ring-blue-100', icon: 'bg-blue-100 text-blue-600', text: 'text-blue-900', sub: 'text-blue-500/80' },
  opened: { bg: 'bg-indigo-50/60', ring: 'ring-indigo-100', icon: 'bg-indigo-100 text-indigo-600', text: 'text-indigo-900', sub: 'text-indigo-500/80' },
  paid: { bg: 'bg-emerald-50/60', ring: 'ring-emerald-100', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-900', sub: 'text-emerald-600/80' },
};

const DAY_MS = 1000 * 60 * 60 * 24;

export default function DeliveryTimeline({ invoice }: DeliveryTimelineProps) {
  const timeline = buildDeliveryTimeline(invoice);
  const unverifiedStages = timeline.filter(e => !e.verified && e.stage !== 'created');
  const latestStage = getLatestVerifiedStage(timeline);
  const latestEvent = latestStage ? timeline.find(e => e.stage === latestStage) : undefined;
  const isFresh = Boolean(
    latestEvent?.timestamp && Date.now() - new Date(latestEvent.timestamp).getTime() < DAY_MS
  );

  return (
    <div>
      {/* At-a-glance summary of where this document stands right now */}
      {latestStage && latestEvent && (
        <div className={`flex items-center gap-3 mb-5 p-3.5 rounded-2xl ring-1 ${SUMMARY_STYLE[latestStage].bg} ${SUMMARY_STYLE[latestStage].ring}`}>
          <div className={`relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${SUMMARY_STYLE[latestStage].icon}`}>
            {(() => { const LatestIcon = STAGE_ICONS[latestStage]; return <LatestIcon className="w-[18px] h-[18px]" />; })()}
            {isFresh && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-current" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${SUMMARY_STYLE[latestStage].text}`}>{SUMMARY_COPY[latestStage]}</p>
            <p className={`text-xs mt-0.5 ${SUMMARY_STYLE[latestStage].sub}`}>
              {latestEvent.timestamp ? relativeTime(latestEvent.timestamp) : `Status: ${invoice.status}`}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-0.5">
        {timeline.map((event, i) => {
          const Icon = STAGE_ICONS[event.stage];
          const isLast = i === timeline.length - 1;

          return (
            <div key={event.stage} className="flex gap-3">
              {/* Icon column */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    event.completed && event.verified
                      ? 'bg-emerald-100 text-emerald-600'
                      : event.completed
                        ? 'bg-slate-100 text-slate-500'
                        : 'bg-slate-50 text-slate-300 border border-dashed border-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 my-0.5 transition-colors duration-300 ${event.completed && event.verified ? 'bg-emerald-200' : 'bg-slate-100'}`} style={{ minHeight: '20px' }} />
                )}
              </div>

              {/* Content */}
              <div className={`pb-3 ${isLast ? 'pb-0' : ''}`}>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${
                    event.completed && event.verified
                      ? 'text-slate-900'
                      : event.completed
                        ? 'text-slate-600'
                        : 'text-slate-400'
                  }`}>
                    {event.label}
                  </p>
                  {event.completed && event.verified && (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                </div>
                {event.verified && event.timestamp ? (
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(event.timestamp)}</p>
                ) : event.verified && event.completed && event.stage === 'sent' ? (
                  <p className="text-xs text-slate-400 mt-0.5">Status: {invoice.status}</p>
                ) : !event.verified ? (
                  <p className="text-xs text-slate-300 mt-0.5 italic">Not yet tracked</p>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">Pending</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {unverifiedStages.length > 0 && (
        <div className="mt-3 ml-11 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />
            {unverifiedStages.length === 1
              ? `"${unverifiedStages[0].label}" only appears here once it actually happens — never guessed.`
              : 'These steps only appear here once they actually happen — never guessed.'}
          </p>
        </div>
      )}
    </div>
  );
}
