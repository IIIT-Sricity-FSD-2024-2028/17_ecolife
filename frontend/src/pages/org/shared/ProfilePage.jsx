import { useEffect, useState } from 'react';
import { useZodForm } from '../../../hooks/useZodForm';
import { profileDetailsSchema, changePasswordSchema } from '../../../schemas/formSchemas';
import { User, KeyRound, Save, Clock, Building2, CalendarDays, Crown } from 'lucide-react';
import { Card, CardHeader } from '../../../components/ui/Card';
import { FormField, TextInput, PasswordInput } from '../../../components/ui/FormField';
import { PasswordRules } from '../../../components/ui/PasswordRules';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileService, adminProfileService } from '../../../services/profileService';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { ORG_ROLE_LABELS, PLATFORM_ROLE_LABELS } from '../../../constants/roles';
import { fmtDate, fmtDateTime } from '../../../utils/format';

const initialsOf = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';


/** Same page for every role: name/phone, read-only email & role, change password.
 * `variant="admin"` talks to the platform-admin endpoints instead of the org ones. */
export function ProfilePage({ variant = 'org' }) {
  const svc = variant === 'admin' ? adminProfileService : profileService;
  const key = variant === 'admin' ? ['admin-me'] : ['me'];
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery({ queryKey: key, queryFn: svc.get });
  const update = useMutation({ mutationFn: svc.update, onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const changePassword = useMutation({ mutationFn: svc.changePassword });
  const { showToast } = useToast();
  const confirm = useConfirm();

  const details = useZodForm(profileDetailsSchema, { fullName: '', jobTitle: '', phone: '' });
  useEffect(() => {
    if (profile) details.reset({ fullName: profile.fullName, jobTitle: profile.jobTitle ?? '', phone: profile.phone ?? '' });
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const [pwError, setPwError] = useState(null);
  const pw = useZodForm(changePasswordSchema, { currentPassword: '', newPassword: '', confirmPassword: '' });
  const newPassword = pw.watch('newPassword');

  if (isLoading || !profile) return <p className="text-muted">Loading…</p>;

  const saveDetails = async (values) => {
    const ok = await confirm({ title: 'Save your profile changes?', message: 'Your name, job title and phone number will be updated.', confirmLabel: 'Save changes', icon: Save });
    if (!ok) return;
    try {
      await update.mutateAsync({ fullName: values.fullName.trim(), jobTitle: (values.jobTitle ?? '').trim(), phone: values.phone.trim() });
      showToast('Profile updated.', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
    }
  };

  const savePassword = async (values) => {
    setPwError(null);
    const ok = await confirm({ title: 'Change your password?', message: 'You will use the new password the next time you sign in.', confirmLabel: 'Update password', icon: KeyRound });
    if (!ok) return;
    try {
      await changePassword.mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      showToast('Password changed.', 'success');
      pw.reset();
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  return (
    <div className="stack" style={{ width: '100%' }}>
      <PageHeader subtitle="Your details and password." />

      <Card>
        <div className="profile-hero">
          <span className="avatar avatar--lg" aria-hidden="true">{initialsOf(profile.fullName)}</span>
          <div className="profile-hero__main">
            <h2 className="profile-hero__name">{profile.fullName}</h2>
            {profile.jobTitle && <p className="profile-hero__title text-muted">{profile.jobTitle}</p>}
            <div className="profile-hero__badges">
              <span className="popover__role">{variant === 'admin' ? PLATFORM_ROLE_LABELS[profile.role] : ORG_ROLE_LABELS[profile.role]}</span>
              {variant !== 'admin' && profile.isOwner && <span className="profile-hero__owner"><Crown size={12} aria-hidden="true" /> Owner</span>}
            </div>
          </div>
          <dl className="profile-hero__meta">
            {variant !== 'admin' && (
              <div><dt><Building2 size={13} aria-hidden="true" /> Organization</dt><dd>{profile.organizationName}{profile.departmentName ? ` · ${profile.departmentName}` : ''}</dd></div>
            )}
            <div><dt><CalendarDays size={13} aria-hidden="true" /> Member since</dt><dd>{fmtDate(profile.createdAt)}</dd></div>
          </dl>
        </div>
      </Card>

      <Card>
        <CardHeader icon={User} title="Your details" subtitle={variant === 'admin' ? PLATFORM_ROLE_LABELS[profile.role] : `${ORG_ROLE_LABELS[profile.role]} · ${profile.organizationName}${profile.departmentName ? ` · ${profile.departmentName}` : ''}`} />
        <form onSubmit={details.handleSubmit(saveDetails)} noValidate>
          <FormField label="Full Name" error={details.formState.errors.fullName} required>
            <TextInput placeholder="Your full name" error={details.formState.errors.fullName} {...details.register('fullName')} />
          </FormField>
          <FormField label="Job Title" error={details.formState.errors.jobTitle}>
            <TextInput placeholder="e.g. Sustainability Analyst" error={details.formState.errors.jobTitle} {...details.register('jobTitle')} />
          </FormField>
          <FormField label="Email Address" hint="Your email is your sign-in and can't be changed here.">
            <TextInput value={profile.email} readOnly disabled />
          </FormField>
          <FormField label="Phone">
            <TextInput type="tel" autoComplete="tel" placeholder="+91 98765 43210" {...details.register('phone')} />
          </FormField>
          <p className="text-muted inline-icon" style={{ fontSize: 'var(--font-size-xs)', display: 'flex', marginBottom: 'var(--space-3)' }}><Clock size={13} aria-hidden="true" /> Last sign-in {fmtDateTime(profile.lastLogin)}</p>
          <Button type="submit" icon={Save} loading={update.isPending}>Save changes</Button>
        </form>
      </Card>

      <Card>
        <CardHeader icon={KeyRound} title="Change password" subtitle={profile.passwordChangedAt ? `Password last changed ${fmtDateTime(profile.passwordChangedAt)}` : 'Password not changed since the account was created'} />
        <form onSubmit={pw.handleSubmit(savePassword)} noValidate>
          <FormField label="Current Password" error={pw.formState.errors.currentPassword} required>
            <PasswordInput autoComplete="current-password" placeholder="Enter your current password" error={pw.formState.errors.currentPassword} {...pw.register('currentPassword')} />
          </FormField>
          <FormField label="New Password" error={pw.formState.errors.newPassword} required>
            <PasswordInput autoComplete="new-password" placeholder="Create a new password" error={pw.formState.errors.newPassword} {...pw.register('newPassword')} />
          </FormField>
          <PasswordRules value={newPassword} />
          <FormField label="Confirm New Password" error={pw.formState.errors.confirmPassword} required>
            <PasswordInput autoComplete="new-password" placeholder="Re-enter the new password" error={pw.formState.errors.confirmPassword} {...pw.register('confirmPassword')} />
          </FormField>
          {pwError && <p className="auth-error" role="alert">{pwError}</p>}
          <Button type="submit" icon={KeyRound} loading={changePassword.isPending}>Update password</Button>
        </form>
      </Card>
    </div>
  );
}
