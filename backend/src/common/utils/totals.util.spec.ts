import { computeTotals, LineItemInput } from './totals.util';

describe('computeTotals', () => {
  const base: LineItemInput[] = [
    { description: 'Consulting', quantity: 2, unitPrice: 500, taxPercent: 10 },
    { description: 'Setup fee', quantity: 1, unitPrice: 250, taxPercent: 5 },
  ];

  it('computes simple totals without discount', () => {
    const r = computeTotals(base);
    expect(r.subtotal).toBe(1250);
    expect(r.discountAmount).toBe(0);
    expect(r.total).toBe(1362.5);
    expect(r.items[0].amount).toBe(1000);
    expect(r.items[0].taxAmount).toBe(100);
    expect(r.items[1].taxAmount).toBe(12.5);
  });

  it('applies a fixed discount proportionally across line tax', () => {
    const r = computeTotals(base, { type: 'fixed', value: 150 });
    expect(r.discountAmount).toBe(150);
    expect(r.subtotal - r.discountAmount).toBe(1100);
    const ratio = 1100 / 1250;
    expect(r.items[0].taxAmount).toBe(Math.round(1000 * ratio * 0.1 * 100) / 100);
    expect(r.items[1].taxAmount).toBe(Math.round(250 * ratio * 0.05 * 100) / 100);
    expect(r.taxTotal).toBe(99);
    expect(r.total).toBe(1199);
  });

  it('applies a percent discount', () => {
    const r = computeTotals(base, { type: 'percent', value: 20 });
    expect(r.discountAmount).toBe(250);
    expect(r.taxTotal).toBe(90);
    expect(r.total).toBe(1090);
  });

  it('never applies a negative subtotal', () => {
    const bad: LineItemInput[] = [
      { description: 'bad', quantity: -3, unitPrice: -100, taxPercent: -10 },
    ];
    const r = computeTotals(bad);
    expect(r.items[0].quantity).toBe(0);
    expect(r.items[0].unitPrice).toBe(0);
    expect(r.subtotal).toBe(0);
    expect(r.total).toBe(0);
  });

  it('caps fixed discount at subtotal', () => {
    const r = computeTotals(base, { type: 'fixed', value: 99999 });
    expect(r.discountAmount).toBe(1250);
    expect(r.taxTotal).toBe(0);
    expect(r.total).toBe(0);
  });
});