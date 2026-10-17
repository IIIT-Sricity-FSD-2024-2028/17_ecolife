import { useState } from 'react';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { useZodForm } from '../../../hooks/useZodForm';
import { useAnnouncements, useCreateAnnouncement, useRemoveAnnouncement } from '../../../hooks/useCollaboration';
import { useDepartments } from '../../../hooks/useOrgData';
import { announcementSchema } from '../../../schemas/formSchemas';
import { Card, CardHeader } from '../../../components/ui/Card';
import { Drawer } from '../../../components/ui/Drawer';
import { Button } from '../../../components/ui/Button';
import { FormField, TextInput, TextArea, Select } from '../../../components/ui/FormField';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtDate } from '../../../utils/format';

function AnnouncementForm({ open, onClose }) {
  const { data: departments = [] } = useDepartments();
  const create = useCreateAnnouncement();
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useZodForm(announcementSchema, { title: '', body: '', departmentId: '', expiresInDays: 14 });

  const close = () => { reset(); onClose(); };
  const onSubmit = async (values) => {
    try {
      await create.mutateAsync({
        title: values.title,
        body: values.body,
        expiresInDays: values.expiresInDays,
        ...(values.departmentId ? { departmentId: values.departmentId } : {}),
      });
      showToast('Announcement posted.', 'success');
      close();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
    }
  };

  return (
    <Drawer variant="modal" open={open} onClose={close} title="New announcement" subtitle="Shown as a banner to the people it is for.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Title" error={errors.title} required><TextInput maxLength={100} placeholder="e.g. March data due Friday" error={errors.title} {...register('title')} /></FormField>
        <FormField label="Message" error={errors.body} required><TextArea rows={4} maxLength={1000} error={errors.body} {...register('body')} /></FormField>
        <div className="split-2">
          <FormField label="Who should see it" error={errors.departmentId}>
            <Select {...register('departmentId')}>
              <option value="">Whole organization</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name} only</option>)}
            </Select>
          </FormField>
          <FormField label="Keep visible for (days)" error={errors.expiresInDays} required>
            <TextInput type="number" inputMode="numeric" min="1" max="60" step="1" error={errors.expiresInDays} {...register('expiresInDays')} />
          </FormField>
        </div>
        <div className="row-actions">
          <Button type="submit" icon={Megaphone} loading={isSubmitting}>Post announcement</Button>
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
        </div>
      </form>
    </Drawer>
  );
}

/** Org Admin: post and remove announcements. Everyone in the organization sees them as a banner. */
export function AnnouncementsManager() {
  const { data: items = [] } = useAnnouncements();
  const remove = useRemoveAnnouncement();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [creating, setCreating] = useState(false);

  const onRemove = async (a) => {
    const ok = await confirm({ title: 'Remove this announcement?', message: 'It disappears for everyone straight away.', confirmLabel: 'Remove', danger: true, icon: Trash2 });
    if (!ok) return;
    try { await remove.mutateAsync(a.id); showToast('Announcement removed.', 'success'); }
    catch (err) { showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error'); }
  };

  return (
    <Card>
      <CardHeader
        title="Announcements"
        subtitle="Deadlines and reminders for your whole organization or one department."
        icon={Megaphone}
        actions={<Button size="sm" icon={Plus} onClick={() => setCreating(true)}>New announcement</Button>}
      />
      {items.length === 0 ? (
        <EmptyState icon={Megaphone} title="No active announcements" description="Post one to remind your team of a deadline." />
      ) : (
        <ul className="comment-list">
          {items.map((a) => (
            <li key={a.id} className="comment" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{a.title}</strong>
                <p className="comment__body">{a.body}</p>
                <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                  {a.departmentName ? `${a.departmentName} only` : 'Whole organization'} · posted {fmtDate(a.createdAt)} by {a.createdByName} · visible until {fmtDate(a.expiresAt)}
                </span>
              </div>
              <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onRemove(a)} aria-label={`Remove ${a.title}`} />
            </li>
          ))}
        </ul>
      )}
      <AnnouncementForm open={creating} onClose={() => setCreating(false)} />
    </Card>
  );
}
