import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wrench, Power, ShieldCheck, UserPlus, Save } from 'lucide-react';
import { platformAdminService } from '../../../services/platformAdminService';
import { Card, CardHeader } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { FormField, TextInput, TextArea } from '../../../components/ui/FormField';
import { Checkbox } from '../../../components/ui/Checkbox';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { PageHeader } from '../../../components/ui/PageHeader';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { PLATFORM_ROLES } from '../../../constants/roles';

/** Whole number within [min, max], or an error message. Mirrors the backend DTO limits. */
const checkInt = (value, min, max, label) => {
  const n = Number(value);
  if (value === '' || !Number.isInteger(n)) return `${label} must be a whole number`;
  if (n < min || n > max) return `${label} must be between ${min} and ${max}`;
  return null;
};

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { admin } = useAdminAuth();
  // The backend returns 403 when a Platform Admin changes security or sign-up
  // settings, so those controls are read-only unless the user is a Super Admin.
  const canEditPolicy = admin?.role === PLATFORM_ROLES.SUPER_ADMIN;
  const { data: settings } = useQuery({ queryKey: ['platform-settings'], queryFn: platformAdminService.getSettings });
  const update = useMutation({
    mutationFn: platformAdminService.updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-settings'] }),
  });

  const [message, setMessage] = useState('');
  const [security, setSecurity] = useState({ sessionMin: '', maxFailed: '', lockoutMin: '' });
  const [access, setAccess] = useState({ allowRegistration: true, requireWorkEmail: true });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!settings) return;
    setMessage(settings.maintenanceMessage ?? '');
    setSecurity({
      sessionMin: String(settings.defaultSessionTimeoutMin),
      maxFailed: String(settings.maxFailedLogins),
      lockoutMin: String(settings.lockoutMinutes),
    });
    setAccess({ allowRegistration: settings.allowRegistration, requireWorkEmail: settings.requireWorkEmail });
  }, [settings]);

  const save = async (payload, successText) => {
    try {
      await update.mutateAsync(payload);
      showToast(successText, 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
    }
  };

  const toggleMaintenance = async () => {
    const turningOn = !settings.maintenanceMode;
    const ok = await confirm({
      title: turningOn ? 'Turn on maintenance mode?' : 'Turn off maintenance mode?',
      message: turningOn
        ? 'Every organization user will be blocked from using Tropos until you turn it off. Admins can still sign in.'
        : 'Organization users will be able to sign in and use Tropos again.',
      confirmLabel: turningOn ? 'Turn on' : 'Turn off',
      danger: turningOn,
      icon: Wrench,
    });
    if (!ok) return;
    await save({ maintenanceMode: turningOn }, turningOn ? 'Maintenance mode on.' : 'Maintenance mode off.');
  };

  const saveMessage = () => {
    if (message.length > 500) return setErrors({ message: 'Message must be at most 500 characters' });
    setErrors({});
    return save({ maintenanceMessage: message.trim() }, 'Maintenance message saved.');
  };

  const saveSecurity = async () => {
    const next = {
      sessionMin: checkInt(security.sessionMin, 5, 1440, 'Session length'),
      maxFailed: checkInt(security.maxFailed, 3, 20, 'Failed attempts'),
      lockoutMin: checkInt(security.lockoutMin, 1, 1440, 'Lockout time'),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    const ok = await confirm({
      title: 'Save security settings?',
      message: 'Session length applies to sign-ins from now on; people already signed in keep their current session. Lockout rules apply immediately.',
      confirmLabel: 'Save settings',
      icon: ShieldCheck,
    });
    if (!ok) return;
    await save(
      {
        defaultSessionTimeoutMin: Number(security.sessionMin),
        maxFailedLogins: Number(security.maxFailed),
        lockoutMinutes: Number(security.lockoutMin),
      },
      'Security settings saved.',
    );
  };

  const saveAccess = async () => {
    if (!access.allowRegistration && settings.allowRegistration !== access.allowRegistration) {
      const ok = await confirm({
        title: 'Close new sign-ups?',
        message: 'No new organization will be able to register until you open sign-ups again. Existing organizations are not affected.',
        confirmLabel: 'Close sign-ups',
        danger: true,
        icon: UserPlus,
      });
      if (!ok) return;
    }
    await save(access, 'Sign-up settings saved.');
  };

  if (!settings) return <p className="text-muted">Loading…</p>;

  return (
    <div className="stack">
      <PageHeader subtitle="Platform-wide controls that affect every organization." />

      <Card>
        <CardHeader icon={Wrench} title="Maintenance mode" subtitle="Temporarily block organization users, for example during an upgrade. Admins can still sign in." />
        <p style={{ marginBottom: 'var(--space-3)' }}>
          Maintenance mode is currently <strong>{settings.maintenanceMode ? 'ON' : 'OFF'}</strong>.
        </p>
        <FormField label="Message shown to blocked users" error={errors.message} hint="Leave empty to use the default message.">
          <TextArea rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="We're upgrading Tropos and will be back at 6 pm IST." error={errors.message} />
        </FormField>
        <div className="row-actions">
          <Button variant="secondary" icon={Save} onClick={saveMessage} loading={update.isPending}>Save message</Button>
          <Button icon={settings.maintenanceMode ? Power : Wrench} variant={settings.maintenanceMode ? 'secondary' : 'danger'} onClick={toggleMaintenance} loading={update.isPending}>
            {settings.maintenanceMode ? 'Turn off maintenance mode' : 'Turn on maintenance mode'}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader icon={ShieldCheck} title="Security" subtitle={canEditPolicy ? 'Sign-in rules for organization users and platform admins.' : 'Sign-in rules for organization users and platform admins. Only a Super Admin can change these.'} />
        <div className="split-2">
          <FormField label="Session length (minutes)" error={errors.sessionMin} hint="Users are signed out after this long. 5–1440.">
            <TextInput type="number" min={5} max={1440} value={security.sessionMin} onChange={(e) => setSecurity({ ...security, sessionMin: e.target.value })} error={errors.sessionMin} disabled={!canEditPolicy} />
          </FormField>
          <div />
          <FormField label="Failed sign-ins before lockout" error={errors.maxFailed} hint="Wrong passwords in a row. 3–20.">
            <TextInput type="number" min={3} max={20} value={security.maxFailed} onChange={(e) => setSecurity({ ...security, maxFailed: e.target.value })} error={errors.maxFailed} disabled={!canEditPolicy} />
          </FormField>
          <FormField label="Lockout time (minutes)" error={errors.lockoutMin} hint="How long the account stays locked. Resetting the password unlocks it. 1–1440.">
            <TextInput type="number" min={1} max={1440} value={security.lockoutMin} onChange={(e) => setSecurity({ ...security, lockoutMin: e.target.value })} error={errors.lockoutMin} disabled={!canEditPolicy} />
          </FormField>
        </div>
        <Button icon={Save} onClick={saveSecurity} loading={update.isPending} disabled={!canEditPolicy}>Save security settings</Button>
      </Card>

      <Card>
        <CardHeader icon={UserPlus} title="Sign-ups" subtitle={canEditPolicy ? 'Who can create a new organization on Tropos.' : 'Who can create a new organization on Tropos. Only a Super Admin can change these.'} />
        <div className="stack" style={{ marginBottom: 'var(--space-4)' }}>
          <Checkbox label="Allow new organizations to register" checked={access.allowRegistration} disabled={!canEditPolicy} onChange={(e) => setAccess({ ...access, allowRegistration: e.target.checked })} />
          <Checkbox label="Require a work email (blocks personal and disposable addresses)" checked={access.requireWorkEmail} disabled={!canEditPolicy} onChange={(e) => setAccess({ ...access, requireWorkEmail: e.target.checked })} />
        </div>
        <Button icon={Save} onClick={saveAccess} loading={update.isPending} disabled={!canEditPolicy}>Save sign-up settings</Button>
      </Card>
    </div>
  );
}
