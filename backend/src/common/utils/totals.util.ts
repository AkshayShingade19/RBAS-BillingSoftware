import { round2 } from '../../common/utils/money.util';

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
}

export interface LineItemResult extends LineItemInput {
  amount: number;
  taxAmount: number;
}

export interface ComputedTotals {
  items: LineItemResult[];
  subtotal: number;
  discountAmount: number;
  taxTotal: number;
  total: number;
}

export interface DiscountInput {
  type: 'percent' | 'fixed';
  value: number;
}

export function computeTotals(
  input: LineItemInput[],
  discount: DiscountInput = { type: 'fixed', value: 0 },
): ComputedTotals {
  const items: LineItemResult[] = input.map((it) => {
    const quantity = Math.max(0, Number(it.quantity) || 0);
    const unitPrice = Math.max(0, Number(it.unitPrice) || 0);
    const taxPercent = Math.max(0, Math.min(100, Number(it.taxPercent) || 0));
    return {
      ...it,
      quantity,
      unitPrice,
      taxPercent,
      amount: round2(quantity * unitPrice),
      taxAmount: 0,
    };
  });

  const subtotal = round2(items.reduce((sum, it) => sum + it.amount, 0));

  let discountAmount = 0;
  if (discount.type === 'percent' && discount.value > 0) {
    const percent = Math.min(100, Math.abs(Number(discount.value) || 0));
    discountAmount = round2((subtotal * percent) / 100);
  } else if (discount.type === 'fixed' && discount.value > 0) {
    discountAmount = Math.min(subtotal, Math.max(0, Number(discount.value) || 0));
  }

  const discountRatio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 1;

  let taxTotal = 0;
  for (const it of items) {
    const taxableAmount = round2(it.amount * discountRatio);
    const taxAmount = round2((taxableAmount * it.taxPercent) / 100);
    it.taxAmount = taxAmount;
    taxTotal += taxAmount;
  }
  taxTotal = round2(taxTotal);

  const total = round2(subtotal - discountAmount + taxTotal);

  return { items, subtotal, discountAmount, taxTotal, total };
}