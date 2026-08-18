import { Check, Circle, Clock, Mail, Eye, DollarSign, FileText, Send } from 'lucide-react';
import { buildDeliveryTimeline, type DeliveryStage } from '@/lib/deliveryTimeline';
import { formatDate } from '@/lib/format';
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

export default function DeliveryTimeline({ invoice }: DeliveryTimelineProps) {
  const timeline = buildDeliveryTimeline(invoice);
  const unverifiedStages = timeline.filter(e => !e.verified && e.stage !== 'created');

  return (
    <div className="space-y-0.5">
      {timeline.map((event, i) => {
        const Icon = STAGE_ICONS[event.stage] || Circle;
        const isLast = i === timeline.length - 1;

        return (
          <div key={event.stage} className="flex gap-3">
            {/* Icon column */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  event.completed && event.verified
                    ? 'bg-emerald-100 text-emerald-600'
                    : event.completed
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-slate-50 text-slate-300 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              {!isLast && (
                <div className={`w-0.5 flex-1 my-0.5 ${event.completed && event.verified ? 'bg-emerald-200' : 'bg-slate-100'}`} style={{ minHeight: '20px' }} />
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
                <p className="text-xs text-slate-400 mt-0.5 italic">Not yet tracked</p>
              ) : (
                <p className="text-xs text-slate-400 mt-0.5">Pending</p>
              )}
            </div>
          </div>
        );
      })}

      {unverifiedStages.length > 0 && (
        <div className="mt-3 ml-11 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
          <p className="text-[11px] text-slate-400">
            <Clock className="w-3 h-3 inline mr-1" />
            Delivery and open tracking require email tracking infrastructure (not yet active). These stages appear only when verified data exists.
          </p>
        </div>
      )}
    </div>
  );
}
