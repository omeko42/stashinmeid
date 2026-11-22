'use client';

import { useTranslations } from 'next-intl';
import { KeyRound, Loader2, Trash2, UserCheck } from 'lucide-react';
import type { UserRole } from '@/types/finance';
import { Modal } from '@/components/ui/Modal';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { APP_TIMEZONE } from '@/lib/format';

export interface ManagedUser {
  id: string;
  email: string;
  client_name: string;
  role: UserRole;
  created_at: string;
}

interface UsersTabProps {
  users: ManagedUser[];
  loading: boolean;
  error: string | null;
  editingUserId: string | null;
  editUserEmail: string;
  editUserClient: string;
  onRefresh: () => void;
  onChangeRole: (userId: string, role: UserRole) => void;
  onResetPassword: (email: string) => void;
  onImpersonate: (user: ManagedUser) => void;
  onDelete: (userId: string) => void;
  onToggleEdit: (user: ManagedUser) => void;
  onEditFieldChange: (field: 'email' | 'client_name', value: string) => void;
  onSaveEdit: (userId: string) => void;
  onCancelEdit: () => void;
}

/**
 * Manajemen user (khusus superadmin).
 *
 * Daftar baris datar - tiap user adalah baris dengan email, workspace, dan
 * aksi. Edit memakai modal pop-up, dan perubahan disimpan ke DB lewat
 * /api/admin/users.
 */
export function UsersTab({
  users,
  loading,
  error,
  editingUserId,
  editUserEmail,
  editUserClient,
  onRefresh,
  onChangeRole,
  onResetPassword,
  onImpersonate,
  onDelete,
  onToggleEdit,
  onEditFieldChange,
  onSaveEdit,
  onCancelEdit,
}: UsersTabProps) {
  const tUsers = useTranslations('users');
  const tCommon = useTranslations('common');

  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'admin', label: tUsers('roles.admin') },
    { value: 'user', label: tUsers('roles.user') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text)]">
            {tUsers('title')}
          </h2>
          <p className="text-[12px] text-[var(--text-muted)]">
            {tUsers('subtitle')}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={onRefresh}
          loading={loading}
        >
          {tUsers('refresh')}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--due)]/30 bg-[var(--due-soft)] px-4 py-3 text-[12px] text-[var(--due)]">
          {error}
        </div>
      )}

      {loading && users.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-[var(--brand)]" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
          <EmptyState
            icon={<UserCheck className="size-5" />}
            title={tUsers('empty.title')}
            description={tUsers('empty.description')}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
          {users.map((u, idx) => (
            <div
              key={u.id}
              className={`px-4 py-3.5 ${idx > 0 ? 'border-t border-[var(--line)]' : ''}`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[var(--text)]">
                    {u.email}
                  </p>
                  <p className="truncate text-[11px] text-[var(--text-muted)]">
                    {u.client_name} ·{' '}
                    {new Intl.DateTimeFormat('id-ID', {
                      timeZone: APP_TIMEZONE,
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }).format(new Date(u.created_at))}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`role-${u.id}`}>
                    {tUsers('role')}
                  </label>
                  <select
                    id={`role-${u.id}`}
                    name={`role-${u.id}`}
                    value={u.role}
                    onChange={(e) =>
                      onChangeRole(u.id, e.target.value as UserRole)
                    }
                    className="h-8 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2 text-[12px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                  >
                    {roleOptions.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onToggleEdit(u)}
                  >
                    {tCommon('edit')}
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<KeyRound className="size-3.5" />}
                    onClick={() => onResetPassword(u.email)}
                  >
                    {tUsers('resetPassword')}
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<UserCheck className="size-3.5" />}
                    onClick={() => onImpersonate(u)}
                  >
                    {tUsers('impersonate')}
                  </Button>

                  <IconButton
                    label={tUsers('deleteUser')}
                    size="sm"
                    onClick={() => onDelete(u.id)}
                    className="text-[var(--text-faint)] hover:text-[var(--out)]"
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </div>

              {editingUserId === u.id && undefined}
            </div>
          ))}
        </div>
      )}

      {/* Edit user: modal pop-up supaya fokus, dan tetap tersimpan ke DB. */}
      <Modal
        open={editingUserId !== null}
        onClose={onCancelEdit}
        title={tUsers('editTitle', { name: editUserEmail })}
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={onCancelEdit}>
              {tCommon('cancel')}
            </Button>
            <Button
              size="sm"
              onClick={() => editingUserId && onSaveEdit(editingUserId)}
            >
              {tCommon('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label
              htmlFor="edit-user-email"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
            >
              {tUsers('editTitle', { name: editUserEmail })}
            </label>
            <input
              id="edit-user-email"
              name="editUserEmail"
              type="email"
              value={editUserEmail}
              onChange={(e) => onEditFieldChange('email', e.target.value)}
              placeholder="Email tertaut"
              aria-label="Email tertaut"
              className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="edit-user-client"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
            >
              {tUsers('edit')}
            </label>
            <input
              id="edit-user-client"
              name="editUserClient"
              type="text"
              value={editUserClient}
              onChange={(e) => onEditFieldChange('client_name', e.target.value)}
              placeholder="Nama workspace"
              aria-label="Nama workspace"
              className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
