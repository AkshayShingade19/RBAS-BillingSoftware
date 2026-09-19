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

const schema = z.object({
  name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must include uppercase, lowercase and a number'),
});

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
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
      await api.post('/auth/signup', values);
      toast.success('Account created', 'Check your email for a verification code.');
      navigate(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      toast.error('Sign up failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start billing your clients in minutes."
      footer={
        <span>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input label="Full name" placeholder="Jane Doe" {...register('name')} error={errors.name?.message} autoComplete="name" />
        <Input label="Email address" placeholder="you@company.com" {...register('email')} error={errors.email?.message} autoComplete="email" />
        <Input
          label="Password"
          type="password"
          placeholder="At least 8 chars with A-Z, a-z, 0-9"
          {...register('password')}
          error={errors.password?.message}
          autoComplete="new-password"
        />
        <Button type="submit" className="w-full" loading={loading} size="lg">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-xs leading-relaxed text-ink-400">
        The first account in a fresh workspace becomes the workspace admin. Subsequent sign-ups are
        held for admin approval before they can sign in.
      </p>
    </AuthShell>
  );
}