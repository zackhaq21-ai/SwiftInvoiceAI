import type { Invoice } from './types';

export type DeliveryStage = 'created' | 'sent' | 'delivered' | 'opened' | 'paid';

export interface TimelineEvent {
  stage: DeliveryStage;
  label: string;
  timestamp: string | null;
  completed: boolean;
  /** Whether we have verified tracking data for this stage */
  verified: boolean;
}

const STAGE_ORDER: DeliveryStage[] = ['created', 'sent', 'delivered', 'opened', 'paid'];

const STAGE_LABELS: Record<DeliveryStage, string> = {
  created: 'Created',
  sent: 'Sent',
  delivered: 'Delivered',
  opened: 'Opened',
  paid: 'Paid',
};

export function buildDeliveryTimeline(invoice: Invoice): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];

  // "created" — always verified from invoice record
  timeline.push({
    stage: 'created',
    label: STAGE_LABELS.created,
    timestamp: invoice.created_at,
    completed: true,
    verified: true,
  });

  // "sent" — verified when status is sent, overdue, or paid (i.e. it was sent at some point)
  // We check the status rather than fabricating a send timestamp.
  const wasSent = ['sent', 'overdue', 'paid'].includes(invoice.status);
  timeline.push({
    stage: 'sent',
    label: STAGE_LABELS.sent,
    timestamp: null, // We don't have an explicit sent_at column — don't fabricate
    completed: wasSent,
    verified: wasSent,
  });

  // "delivered" and "opened" — these require tracking infrastructure (e.g. email open tracking pixels,
  // delivery receipts) that is NOT currently implemented. We never fabricate these stages.
  // They will only show as completed if verified metadata exists in the future.
  const deliveredMeta = invoice.metadata?.delivery_confirmed;
  const openedMeta = invoice.metadata?.opened_at;

  timeline.push({
    stage: 'delivered',
    label: STAGE_LABELS.delivered,
    timestamp: deliveredMeta ? deliveredMeta : null,
    completed: Boolean(deliveredMeta),
    verified: Boolean(deliveredMeta),
  });

  timeline.push({
    stage: 'opened',
    label: STAGE_LABELS.opened,
    timestamp: openedMeta || null,
    completed: Boolean(openedMeta),
    verified: Boolean(openedMeta),
  });

  // "paid" — verified when payment_status is paid or partial
  const isPaid = invoice.payment_status === 'paid';
  const isPartial = invoice.payment_status === 'partial';
  // Find the most recent payment timestamp if available
  let paidTimestamp: string | null = null;
  if (isPaid && invoice.invoice_payments && invoice.invoice_payments.length > 0) {
    const sorted = [...invoice.invoice_payments].sort((a, b) =>
      new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
    );
    paidTimestamp = sorted[0].paid_at;
  }

  timeline.push({
    stage: 'paid',
    label: isPartial ? 'Partially paid' : STAGE_LABELS.paid,
    timestamp: paidTimestamp,
    completed: isPaid || isPartial,
    verified: isPaid || isPartial,
  });

  return timeline;
}

export function getLatestVerifiedStage(timeline: TimelineEvent[]): DeliveryStage | null {
  let latest: DeliveryStage | null = null;
  for (const event of timeline) {
    if (event.verified && event.completed) {
      latest = event.stage;
    }
  }
  return latest;
}

export function getUnverifiedStages(timeline: TimelineEvent[]): DeliveryStage[] {
  return timeline
    .filter(e => !e.verified)
    .map(e => e.stage);
}

export { STAGE_ORDER, STAGE_LABELS };
