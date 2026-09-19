import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

type FormValues = z.infer<typeof schema>;

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.get('email') ?? '' },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await api.post('/auth/verify-email', values);
      toast.success('Email verified', 'You can now sign in.');
      navigate('/login');
    } catch (err) {
      toast.error('Could not verify', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await api.post('/auth/request-otp', { email: getEmail() });
      toast.success('Code sent', 'A new verification code is on its way.');
    } catch (err) {
      toast.error('Could not resend code', getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  const getEmail = () => {
    const raw = params.get('email');
    if (raw) return raw;
    return (document.querySelector('input[name="email"]') as HTMLInputElement | null)?.value ?? '';
  };

  return (
    <AuthShell
      title="Verify your email"
      subtitle="Enter the 6-digit code we sent to your inbox."
      footer={
        <span>
          Remembered your password?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input label="Email address" {...register('email')} error={errors.email?.message} autoComplete="email" />
        <Input
          label="Verification code"
          placeholder="123456"
          maxLength={6}
          {...register('code')}
          error={errors.code?.message}
          inputMode="numeric"
        />
        <Button type="submit" className="w-full" loading={loading} size="lg">
          Verify email
        </Button>
      </form>
      <div className="mt-6 text-center text-sm text-ink-500">
        Didn't get a code?{' '}
        <button onClick={resend} disabled={resending} className="font-medium text-brand-600 hover:underline disabled:opacity-50">
          {resending ? 'Sending…' : 'Resend code'}
        </button>
      </div>
    </AuthShell>
  );
}