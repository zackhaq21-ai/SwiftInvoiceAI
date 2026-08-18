import type { Invoice } from './types';

export interface ReportMetrics {
  totalRevenue: number;
  outstanding: number;
  overdue: number;
  overdueCount: number;
  paidCount: number;
  totalInvoices: number;
  estimatesCount: number;
  estimateConversionRate: number;
  avgTimeToPay: number | null;
  avgInvoiceValue: number;
  paidThisMonth: number;
  createdThisMonth: number;
}

export function computeReportMetrics(invoices: Invoice[]): ReportMetrics {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalRevenue = 0;
  let outstanding = 0;
  let overdue = 0;
  let overdueCount = 0;
  let paidCount = 0;
  let estimatesCount = 0;
  let convertedEstimates = 0;
  let totalInvoiceAmount = 0;
  let paidThisMonth = 0;
  let createdThisMonth = 0;
  let timeToPaySum = 0;
  let timeToPayCount = 0;

  for (const inv of invoices) {
    const isInvoice = inv.document_type === 'invoice';
    const isEstimate = inv.document_type === 'estimate';
    const createdDate = new Date(inv.created_at);

    if (isInvoice) {
      totalInvoiceAmount += inv.total;

      if (inv.payment_status === 'paid') {
        totalRevenue += inv.total;
        paidCount++;

        // Calculate time to pay from creation to last payment
        if (inv.invoice_payments && inv.invoice_payments.length > 0) {
          const lastPayment = [...inv.invoice_payments].sort((a, b) =>
            new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
          )[0];
          const payDate = new Date(lastPayment.paid_at);
          const daysToPay = Math.round(
            (payDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysToPay >= 0) {
            timeToPaySum += daysToPay;
            timeToPayCount++;
          }
        }

        if (createdDate >= monthStart) {
          paidThisMonth += inv.total;
        }
      } else if (inv.payment_status === 'partial') {
        // For partial payments, count the paid portion as revenue
        const paidAmount = inv.invoice_payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
        totalRevenue += paidAmount;
        outstanding += inv.total - paidAmount;
      } else {
        // Unpaid invoices contribute to outstanding
        if (inv.status !== 'draft') {
          outstanding += inv.total;
        }
      }

      if (inv.status === 'overdue') {
        overdue += inv.total;
        overdueCount++;
      }

      if (createdDate >= monthStart) {
        createdThisMonth++;
      }
    }

    if (isEstimate) {
      estimatesCount++;
      if (inv.converted_at) {
        convertedEstimates++;
      }
    }
  }

  const totalInvoices = invoices.filter(i => i.document_type === 'invoice').length;
  const estimateConversionRate = estimatesCount > 0
    ? Math.round((convertedEstimates / estimatesCount) * 100)
    : 0;
  const avgTimeToPay = timeToPayCount > 0
    ? Math.round(timeToPaySum / timeToPayCount)
    : null;
  const avgInvoiceValue = totalInvoices > 0
    ? Math.round(totalInvoiceAmount / totalInvoices * 100) / 100
    : 0;

  return {
    totalRevenue,
    outstanding,
    overdue,
    overdueCount,
    paidCount,
    totalInvoices,
    estimatesCount,
    estimateConversionRate,
    avgTimeToPay,
    avgInvoiceValue,
    paidThisMonth,
    createdThisMonth,
  };
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  count: number;
}

export function computeMonthlyRevenue(invoices: Invoice[], months = 6): MonthlyRevenue[] {
  const now = new Date();
  const result: MonthlyRevenue[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = monthStart.toLocaleDateString('en-US', { month: 'short' });

    let revenue = 0;
    let count = 0;

    for (const inv of invoices) {
      if (inv.document_type !== 'invoice') continue;
      if (inv.payment_status !== 'paid') continue;

      // Use payment date for revenue attribution
      if (inv.invoice_payments) {
        for (const payment of inv.invoice_payments) {
          const payDate = new Date(payment.paid_at);
          if (payDate >= monthStart && payDate < monthEnd) {
            revenue += payment.amount;
            count++;
          }
        }
      }
    }

    result.push({ month: label, revenue, count });
  }

  return result;
}

export interface ClientSummary {
  clientName: string;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  invoiceCount: number;
}

export function computeClientSummary(invoices: Invoice[]): ClientSummary[] {
  const map = new Map<string, ClientSummary>();

  for (const inv of invoices) {
    if (inv.document_type !== 'invoice') continue;
    const name = inv.client_name || 'Unknown';
    const existing = map.get(name) || {
      clientName: name,
      totalBilled: 0,
      totalPaid: 0,
      outstanding: 0,
      invoiceCount: 0,
    };

    existing.totalBilled += inv.total;
    existing.invoiceCount++;

    if (inv.payment_status === 'paid') {
      existing.totalPaid += inv.total;
    } else if (inv.payment_status === 'partial') {
      const paid = inv.invoice_payments?.reduce((s, p) => s + p.amount, 0) || 0;
      existing.totalPaid += paid;
      existing.outstanding += inv.total - paid;
    } else if (inv.status !== 'draft') {
      existing.outstanding += inv.total;
    }

    map.set(name, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.totalBilled - a.totalBilled);
}
