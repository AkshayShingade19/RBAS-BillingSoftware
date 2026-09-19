import { useEffect, useState } from 'react';
import type { ReactNode, ChangeEvent, FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings2, Save, Globe2, UserPlus, Wrench } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { SystemConfig } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { Card, LoadingBlock } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/auth';
import { cn } from '@/lib/utils';

const DEFAULTS: SystemConfig = {
  appName: 'Ledgerly',
  signupsEnabled: true,
  maintenanceMode: false,
  footerCompanyName: 'Ledgerly by RBAS TechLabs',
  supportEmail: '',
};

export default function SystemPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('system.manage');

  const { data, isLoading } = useQuery({
    queryKey: ['system', 'config'],
    queryFn: async () => (await api.get<SystemConfig>('/system/config')).data,
  });

  const [form, setForm] = useState<SystemConfig>(DEFAULTS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) setForm({ ...DEFAULTS, ...data });
  }, [data]);

  const save = useMutation({
    mutationFn: async (body: Partial<SystemConfig>) => api.patch('/system/config', body),
    onSuccess: async () => {
      toast.success('Platform settings saved');
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: ['system', 'config'] });
    },
    onError: (err) => toast.error('Could not save platform settings', getErrorMessage(err)),
  });

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setDirty(true);
  };

  const onToggle = (name: keyof SystemConfig) => {
    setForm((prev) => ({ ...prev, [name]: !prev[name] }));
    setDirty(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(form);
  };

  if (isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System settings"
        subtitle="Platform-level configuration."
        actions={canManage ? (
          <Button type="submit" form="system-form" loading={save.isPending} disabled={!dirty}>
            <Save className="h-4 w-4" /> Save changes
          </Button>
        ) : <span className="text-xs text-ink-400">Read-only</span>}
      />

      <form id="system-form" onSubmit={submit} className="space-y-6">
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink-900">
            <Settings2 className="h-4 w-4 text-brand-500" /> Branding
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Product name" name="appName" value={form.appName} onChange={onChange} disabled={!canManage} maxLength={80} />
            <Input label="Footer company name" name="footerCompanyName" value={form.footerCompanyName} onChange={onChange} disabled={!canManage} maxLength={120} />
            <Input label="Support email" name="supportEmail" value={form.supportEmail} onChange={onChange} disabled={!canManage} maxLength={120} />
            <Field label="Invite link / signup URL">
              <input className="input-base" value={`${window.location.origin}/signup`} readOnly />
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink-900">
            <Globe2 className="h-4 w-4 text-brand-500" /> Platform toggles
          </h2>
          <div className="divide-y divide-ink-100">
            <ToggleRow
              icon={<UserPlus className="h-5 w-5 text-ink-500" />}
              title="Open signups"
              description="Allow new accounts to self-register. Turn off to keep the workspace invitation-only."
              checked={form.signupsEnabled}
              disabled={!canManage}
              onToggle={() => onToggle('signupsEnabled')}
            />
            <ToggleRow
              icon={<Wrench className="h-5 w-5 text-ink-500" />}
              title="Maintenance mode"
              description="Show a maintenance notice to all users. Only a super admin can disable it."
              checked={form.maintenanceMode}
              disabled={!canManage}
              onToggle={() => onToggle('maintenanceMode')}
              danger
            />
          </div>
        </Card>

        {!canManage && (
          <p className="text-sm text-ink-400">You need the system.manage permission to change these settings.</p>
        )}
      </form>
    </div>
  );
}

function ToggleRow({
  icon, title, description, checked, disabled, danger, onToggle,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  danger?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-4 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-50">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <p className="text-xs text-ink-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60',
          checked ? (danger ? 'bg-red-500' : 'bg-brand-500') : 'bg-ink-200',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}