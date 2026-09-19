import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, getErrorMessage } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const schema = z
  .object({
    email: z.string().email('Enter a valid email address'),
    code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must include uppercase, lowercase and a number'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const { confirmPassword, ...payload } = values;
      void confirmPassword;
      await api.post('/auth/reset-password', payload);
      toast.success('Password updated', 'You can now sign in with your new password.');
      navigate('/login');
    } catch (err) {
      toast.error('Could not reset password', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Use the reset code from your email together with a new password."
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
        <Input
          label="Reset code"
          placeholder="123456"
          maxLength={6}
          {...register('code')}
          error={errors.code?.message}
          inputMode="numeric"
        />
        <Input
          label="New password"
          type="password"
          {...register('newPassword')}
          error={errors.newPassword?.message}
          autoComplete="new-password"
        />
        <Input
          label="Confirm new password"
          type="password"
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message}
          autoComplete="new-password"
        />
        <Button type="submit" className="w-full" loading={loading} size="lg">
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}