import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { login as apiLogin, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/components/ui/Toast';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = ['admin@ledgerly.dev', 'manager@ledgerly.dev', 'accountant@ledgerly.dev', 'viewer@ledgerly.dev'];

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const signIn = async (email: string, password: string) => {
    const tokens = await apiLogin(email, password);
    const me = await apiGetMe();
    setAuth({
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      user: {
        id: me.id,
        email: me.email,
        role: me.role,
        name: me.name,
        status: me.status,
        emailVerified: me.emailVerified,
        permissions: me.permissions ?? [],
      },
    });
    navigate('/dashboard', { replace: true });
  };

  const apiGetMe = async () => {
    const { api } = await import('@/lib/api');
    const res = await api.get<{
      id: string;
      name: string;
      email: string;
      status: string;
      emailVerified: boolean;
      role: string;
      roleName?: string;
      permissions?: string[];
    }>('/me');
    return res.data;
  };

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await signIn(values.email, values.password);
    } catch (err) {
      toast.error('Sign in failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const signInAsDemo = async (email: string) => {
    setDemoLoading(email);
    try {
      await signIn(email, 'Admin123!');
    } catch (err) {
      toast.error('Demo sign in failed', getErrorMessage(err));
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your workspace to continue."
      footer={
        <span>
          New here?{' '}
          <Link to="/signup" className="font-medium text-brand-600 hover:underline">
            Create an account
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input label="Email address" {...register('email')} error={errors.email?.message} autoComplete="email" />
        <div>
          <Input
            label="Password"
            type="password"
            {...register('password')}
            error={errors.password?.message}
            autoComplete="current-password"
          />
          <div className="mt-1.5 flex justify-end">
            <Link to="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" className="w-full" loading={loading} size="lg">
          Sign in
        </Button>
      </form>

      <div className="mt-8 rounded-lg border border-ink-100 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Demo workspace logins</p>
        <p className="mt-1 text-xs text-ink-500">
          One-click demo accounts (password <span className="font-mono">Admin123!</span>):
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {DEMO_ACCOUNTS.map((email) => (
            <Button
              key={email}
              variant="secondary"
              size="sm"
              loading={demoLoading === email}
              onClick={() => signInAsDemo(email)}
            >
              {email}
            </Button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}