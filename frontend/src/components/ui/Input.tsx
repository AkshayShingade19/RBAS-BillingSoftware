import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputExtras {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & InputExtras;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, containerClassName, ...props }, ref) => (
    <Field label={label} error={error} hint={hint} className={containerClassName}>
      <input ref={ref} className={cn('input-base', error && 'input-error', className)} {...props} />
    </Field>
  ),
);
Input.displayName = 'Input';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & InputExtras;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, containerClassName, ...props }, ref) => (
    <Field label={label} error={error} hint={hint} className={containerClassName}>
      <textarea ref={ref} className={cn('input-base min-h-[80px]', error && 'input-error', className)} {...props} />
    </Field>
  ),
);
Textarea.displayName = 'Textarea';

export interface SelectOption {
  value: string;
  label: string;
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & InputExtras & { placeholder?: string };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, containerClassName, placeholder, children, ...props }, ref) => (
    <Field label={label} error={error} hint={hint} className={containerClassName}>
      <select ref={ref} className={cn('input-base', error && 'input-error', className)} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children}
      </select>
    </Field>
  ),
);
Select.displayName = 'Select';

export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <label className={cn('mb-1 block text-sm font-medium text-ink-700', className)}>{children}</label>;
}

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <FieldLabel>{label}</FieldLabel>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
