import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice } from '../invoices/schemas/invoice.schema';
import { Payment } from '../payments/schemas/payment.schema';
import { Expense } from '../expenses/schemas/expense.schema';
import { toCsv } from '../../common/utils/csv.util';

export interface ReportQuery {
  from?: string;
  to?: string;
  limit?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
  ) {}

  private range(query: ReportQuery): { from: Date; to: Date } {
    const from = query.from ? new Date(query.from) : new Date(0);
    const to = query.to ? new Date(query.to) : new Date();
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  async revenue(query: ReportQuery) {
    const { from, to } = this.range(query);
    const [payments, invoices, expenses] = await Promise.all([
      this.paymentModel.aggregate([
        { $match: { status: 'completed', paidAt: { $gte: from, $lte: to } } },
        {
          $facet: {
            total: [{ $group: { _id: null, sum: { $sum: '$amount' }, count: { $sum: 1 } } }],
            byMonth: [
              {
                $group: {
                  _id: { y: { $year: '$paidAt' }, m: { $month: '$paidAt' } },
                  sum: { $sum: '$amount' },
                  count: { $sum: 1 },
                },
              },
              { $sort: { '_id.y': 1, '_id.m': 1 } },
            ],
            byMethod: [
              { $group: { _id: '$method', sum: { $sum: '$amount' } } },
            ],
          },
        },
      ]).exec(),
      this.invoiceModel.aggregate([
        { $match: { status: 'paid', paidAt: { $gte: from, $lte: to } } },
        { $group: { _id: null, sum: { $sum: '$total' } } },
      ]).exec(),
      this.expenseModel.aggregate([
        { $match: { expenseDate: { $gte: from, $lte: to } } },
        { $group: { _id: null, sum: { $sum: '$amount' } } },
      ]).exec(),
    ]);

    const paid = payments[0]?.total?.[0]?.sum ?? 0;
    const count = payments[0]?.total?.[0]?.count ?? 0;
    const invoiced = invoices[0]?.sum ?? 0;
    const expensesTotal = expenses[0]?.sum ?? 0;

    return {
      from,
      to,
      paymentsReceived: paid,
      paymentCount: count,
      invoiced,
      expenses: expensesTotal,
      net: paid - expensesTotal,
      byMonth: (payments[0]?.byMonth ?? []).map((m: { _id: { y: number; m: number }; sum: number; count: number }) => ({
        year: m._id.y,
        month: m._id.m,
        sum: m.sum,
        count: m.count,
      })),
      byMethod: (payments[0]?.byMethod ?? []).map((m: { _id: string; sum: number }) => ({
        method: m._id,
        sum: m.sum,
      })),
    };
  }

  async invoiceStatus(query: ReportQuery) {
    const { from, to } = this.range(query);
    const data = await this.invoiceModel.aggregate([
      {
        $match: {
          issueDate: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$total' },
          paid: { $sum: '$amountPaid' },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec();
    return data.map((d) => ({
      status: d._id,
      count: d.count,
      total: d.total,
      paid: d.paid,
      balance: d.total - d.paid,
    }));
  }

  async topClients(query: ReportQuery) {
    const { from, to } = this.range(query);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const data = await this.invoiceModel.aggregate([
      { $match: { issueDate: { $gte: from, $lte: to }, status: { $ne: 'void' } } },
      {
        $group: {
          _id: '$clientName',
          invoiced: { $sum: '$total' },
          paid: { $sum: '$amountPaid' },
          count: { $sum: 1 },
        },
      },
      { $sort: { invoiced: -1 } },
      { $limit: limit },
    ]).exec();
    return data.map((d) => ({
      client: d._id,
      count: d.count,
      invoiced: d.invoiced,
      paid: d.paid,
      balance: d.invoiced - d.paid,
      share: d.invoiced,
    }));
  }

  async overdueAging(query: ReportQuery) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const invoices = await this.invoiceModel.find({ status: 'overdue' }).lean().exec();
    const buckets = [
      { label: '1-30 days', min: 0, max: 30, invoices: [] as Invoice[] },
      { label: '31-60 days', min: 30, max: 60, invoices: [] as Invoice[] },
      { label: '61-90 days', min: 60, max: 90, invoices: [] as Invoice[] },
      { label: '90+ days', min: 90, max: Infinity, invoices: [] as Invoice[] },
    ];
    for (const inv of invoices) {
      const diff = Math.max(0, Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000));
      const bucket = buckets.find((b) => diff > b.min && diff <= b.max) ?? buckets[buckets.length - 1];
      bucket.invoices.push(inv);
    }
    return buckets
      .map((b) => ({
        label: b.label,
        count: b.invoices.length,
        total: b.invoices.reduce((s, i) => s + (Number(i.total) - Number(i.amountPaid)), 0),
      }))
      .filter((b) => b.count > 0 || query.from || query.to);
  }

  async taxSummary(query: ReportQuery) {
    const { from, to } = this.range(query);
    const data = await this.invoiceModel.aggregate([
      { $match: { issueDate: { $gte: from, $lte: to }, status: { $ne: 'void' } } },
      {
        $group: {
          _id: null,
          taxTotal: { $sum: '$taxTotal' },
          subtotal: { $sum: '$subtotal' },
        },
      },
    ]).exec();
    return [
      {
        period: `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`,
        subtotal: data[0]?.subtotal ?? 0,
        taxTotal: data[0]?.taxTotal ?? 0,
        percent: data[0]?.subtotal ? (Number(data[0].taxTotal) / Number(data[0].subtotal)) * 100 : 0,
      },
    ];
  }

  async toCsv(section: 'revenue' | 'invoice-status' | 'top-clients' | 'overdue-aging' | 'tax-summary', query: ReportQuery) {
    let rows: Record<string, unknown>[] = [];
    if (section === 'revenue') {
      const r = await this.revenue(query);
      rows = r.byMonth.map((m: { year: number; month: number; sum: number; count: number }) => ({
        month: `${m.year}-${String(m.month).padStart(2, '0')}`,
        sum: m.sum,
        count: m.count,
      }));
    } else if (section === 'invoice-status') {
      rows = (await this.invoiceStatus(query)) as unknown as Record<string, unknown>[];
    } else if (section === 'top-clients') {
      rows = (await this.topClients(query)) as unknown as Record<string, unknown>[];
    } else if (section === 'overdue-aging') {
      rows = (await this.overdueAging(query)) as unknown as Record<string, unknown>[];
    } else {
      const t = await this.taxSummary(query);
      rows = t as unknown as Record<string, unknown>[];
    }
    return toCsv(rows);
  }

  async dashboard() {
    const from = new Date(new Date().getFullYear(), 0, 1);
    const today = new Date();
    const [revenue, invoices, expenses, recentPayments, overdueCount] = await Promise.all([
      this.revenue({ from: from.toISOString(), to: today.toISOString() }),
      this.invoiceStatus({ from: from.toISOString(), to: today.toISOString() }),
      this.expenseModel.aggregate([
        { $match: { expenseDate: { $gte: from, $lte: today } } },
        { $group: { _id: null, sum: { $sum: '$amount' } } },
      ]).exec(),
      this.paymentModel.find().sort({ paidAt: -1 }).limit(5).lean().exec(),
      this.invoiceModel.countDocuments({ status: 'overdue' }),
    ]);
    return {
      revenue,
      expenses: expenses[0]?.sum ?? 0,
      recentPayments: recentPayments.map((p) => ({
        id: String(p._id),
        paymentNumber: p.paymentNumber,
        clientName: p.clientName,
        amount: p.amount,
        paidAt: p.paidAt,
      })),
      overdueCount,
    };
  }
}