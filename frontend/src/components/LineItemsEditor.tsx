import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface LineItemFormValues {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
}

export interface DocumentFormShape {
  items: LineItemFormValues[];
  discount: { type: 'percent' | 'fixed'; value: number };
}

export function LineItemsEditor({
  form,
  taxOptions,
}: {
  form: UseFormReturn<any>;
  taxOptions: { value: string; label: string; rate: number }[];
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items' as never,
  });

  const items = (form.watch('items' as never) ?? []) as LineItemFormValues[];
  const register = form.register;

  const subtotal = items.reduce((s, i) => s + (Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0), 0);

  const addRow = () => append({ description: '', quantity: 1, unitPrice: 0, taxPercent: 0 } as never);

  return (
    <div className="rounded-lg border border-ink-100">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/60">
              <th className="th w-10">#</th>
              <th className="th">Description</th>
              <th className="th w-24 text-right">Qty</th>
              <th className="th w-36 text-right">Unit price</th>
              <th className="th w-36 text-right">Tax</th>
              <th className="th w-40 text-right">Amount</th>
              <th className="th w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {fields.map((field, index) => {
              const item = items[index];
              const amount = (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0);
              const itemsErrors = (form.formState.errors?.items as Record<string, { description?: { message?: string } }> | undefined);
              const rowErrors = itemsErrors?.[index];
              return (
                <tr key={field.id}>
                  <td className="td text-center text-xs text-ink-400">{index + 1}</td>
                  <td className="td">
                    <input
                      className="input-base"
                      placeholder="What is this line item?"
                      {...register(`items.${index}.description` as never)}
                    />
                    {rowErrors?.description && (
                      <p className="mt-1 text-xs text-red-500">{rowErrors.description.message as string}</p>
                    )}
                  </td>
                  <td className="td">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="input-base text-right"
                      placeholder="0"
                      {...register(`items.${index}.quantity` as never, { valueAsNumber: true })}
                    />
                  </td>
                  <td className="td">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-base text-right"
                      placeholder="0.00"
                      {...register(`items.${index}.unitPrice` as never, { valueAsNumber: true })}
                    />
                  </td>
                  <td className="td">
                    <select
                      className="input-base"
                      {...register(`items.${index}.taxPercent` as never, { valueAsNumber: true })}
                    >
                      {taxOptions.map((t) => (
                        <option key={t.value} value={t.rate}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td text-right text-sm font-semibold text-ink-900">{amount.toFixed(2)}</td>
                  <td className="td text-right">
                    <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-50" onClick={() => remove(index)} aria-label="Remove line">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-ink-100 px-3 py-2.5">
        <Button variant="secondary" size="sm" type="button" onClick={addRow}>
          <Plus className="h-4 w-4" /> Add line item
        </Button>
        <p className="text-sm text-ink-500">
          Subtotal: <span className="font-semibold text-ink-900">{subtotal.toFixed(2)}</span>
        </p>
      </div>
    </div>
  );
}