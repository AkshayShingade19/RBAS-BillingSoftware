import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, getErrorMessage } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', values);
      setSent(true);
      toast.success('Reset code sent', 'Check your inbox for a password reset code.');
    } catch (err) {
      toast.error('Could not send reset code', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset code."
      footer={
        <span>
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input label="Email address" {...register('email')} error={errors.email?.message} autoComplete="email" />
        <Button type="submit" className="w-full" loading={loading} size="lg">
          Send reset code
        </Button>
      </form>
      {sent && (
        <p className="mt-6 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-center text-sm text-emerald-700">
          Check your inbox. Once you have the code, continue on the{' '}
          <Link to="/reset-password" className="font-medium underline">
            reset password page
          </Link>
          .
        </p>
      )}
    </AuthShell>
  );
}