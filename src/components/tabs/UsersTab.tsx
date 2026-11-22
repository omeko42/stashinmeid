'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type { UserRole } from '@/types/finance';
import { Modal } from '@/components/ui/Modal';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { APP_TIMEZONE } from '@/lib/format';

export interface ManagedUser {
  id: string;
  email: string;
  client_name: string;
  bio?: string | null;
  role: UserRole;
  created_at: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  client_name: string;
  bio: string;
  role: UserRole;
}

interface UsersTabProps {
  users: ManagedUser[];
  loading: boolean;
  error: string | null;
  editingUserId: string | null;
  editUserEmail: string;
  editUserClient: string;
  editUserBio?: string;
  editUserPassword?: string;
  onRefresh: () => void;
  onChangeRole: (userId: string, role: UserRole) => void;
  onResetPassword: (email: string) => void;
  onImpersonate: (user: ManagedUser) => void;
  onDelete: (userId: string) => void;
  onToggleEdit: (user: ManagedUser) => void;
  onEditFieldChange: (
    field: 'email' | 'client_name' | 'bio' | 'password',
    value: string
  ) => void;
  onSaveEdit: (userId: string) => void;
  onCancelEdit: () => void;
  onCreateUser?: (payload: CreateUserPayload) => Promise<boolean>;
}

/**
 * Manajemen user (khusus admin & superadmin).
 *
 * Mendukung pembuatan pengguna baru secara manual, pencarian, ubah data profil
 * & kredensial login, reset password, impersonate, dan hapus akun.
 */
export function UsersTab({
  users,
  loading,
  error,
  editingUserId,
  editUserEmail,
  editUserClient,
  editUserBio = '',
  editUserPassword = '',
  onRefresh,
  onChangeRole,
  onResetPassword,
  onImpersonate,
  onDelete,
  onToggleEdit,
  onEditFieldChange,
  onSaveEdit,
  onCancelEdit,
  onCreateUser,
}: UsersTabProps) {
  const tUsers = useTranslations('users');
  const tCommon = useTranslations('common');

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newBio, setNewBio] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');

  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'admin', label: tUsers('roles.admin') },
    { value: 'user', label: tUsers('roles.user') },
  ];

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      (u.client_name || '').toLowerCase().includes(q) ||
      (u.bio || '').toLowerCase().includes(q)
    );
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateUser) return;
    setCreating(true);
    try {
      const ok = await onCreateUser({
        email: newEmail.trim(),
        password: newPassword,
        client_name: newName.trim(),
        bio: newBio.trim(),
        role: newRole,
      });
      if (ok) {
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        setNewBio('');
        setNewRole('user');
        setCreateOpen(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const adminCount = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text)]">
            {tUsers('title')}
          </h2>
          <p className="text-[12px] text-[var(--text-muted)]">
            {tUsers('subtitle')} · Total {users.length} akun ({adminCount} Admin)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<RefreshCw className="size-3.5" />}
            onClick={onRefresh}
            loading={loading}
          >
            {tUsers('refresh')}
          </Button>
          {onCreateUser && (
            <Button
              size="sm"
              icon={<Plus className="size-3.5" />}
              onClick={() => setCreateOpen(true)}
            >
              Tambah Pengguna
            </Button>
          )}
        </div>
      </div>

      {/* Bar pencarian */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          id="admin-users-search"
          name="adminUsersSearch"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari pengguna berdasarkan nama, username, email, atau bio..."
          aria-label="Cari pengguna"
          className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-1)] pl-9 pr-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
        />
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
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
          <EmptyState
            icon={<UserCheck className="size-5" />}
            title={tUsers('empty.title')}
            description={tUsers('empty.description')}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)]">
          {filteredUsers.map((u, idx) => (
            <div
              key={u.id}
              className={`px-4 py-3.5 transition-colors hover:bg-[var(--surface-2)]/40 ${
                idx > 0 ? 'border-t border-[var(--line)]' : ''
              }`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[12px] font-bold text-[var(--brand)]">
                    {(u.client_name || u.email || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13px] font-semibold text-[var(--text)]">
                        {u.client_name || u.email.split('@')[0]}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          u.role === 'admin'
                            ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                            : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                        }`}
                      >
                        {u.role === 'admin' && <ShieldCheck className="size-3" />}
                        {u.role === 'admin' ? 'Admin' : 'Pengguna'}
                      </span>
                    </div>
                    <p className="truncate text-[12px] text-[var(--text-muted)]">
                      {u.email} · Terdaftar{' '}
                      {new Intl.DateTimeFormat('id-ID', {
                        timeZone: APP_TIMEZONE,
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      }).format(new Date(u.created_at))}
                    </p>
                    {u.bio && (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-faint)]">
                        {u.bio}
                      </p>
                    )}
                  </div>
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
            </div>
          ))}
        </div>
      )}

      {/* Modal Tambah Pengguna Baru */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tambah Pengguna Baru"
        description="Daftarkan akun pengguna atau rekan tim secara manual. Akun langsung aktif tanpa perlu verifikasi email."
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCreateOpen(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              size="sm"
              icon={<UserPlus className="size-3.5" />}
              loading={creating}
              disabled={!newEmail.includes('@') || newPassword.length < 6}
              onClick={handleCreateSubmit}
            >
              Buat Akun Pengguna
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-3.5">
          <div>
            <label
              htmlFor="new-user-client"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
            >
              Nama Lengkap / Workspace
            </label>
            <input
              id="new-user-client"
              name="newUserClient"
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Mis. Antigravity AI atau Budi Santoso"
              className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="new-user-email"
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
              >
                Alamat Email Login
              </label>
              <input
                id="new-user-email"
                name="newUserEmail"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nama@stashinmeid.app"
                className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="new-user-role"
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
              >
                Peran Akses
              </label>
              <select
                id="new-user-role"
                name="newUserRole"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
              >
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <PasswordInput
            id="new-user-password"
            name="newUserPassword"
            label="Password Awal (Min. 6 Karakter)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Masukkan password awal..."
            autoComplete="new-password"
          />

          <div>
            <label
              htmlFor="new-user-bio"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
            >
              Bio / Jabatan Singkat (Opsional)
            </label>
            <input
              id="new-user-bio"
              name="newUserBio"
              type="text"
              value={newBio}
              onChange={(e) => setNewBio(e.target.value)}
              placeholder="Mis. Partner Keuangan & Analis Cashflow"
              className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>
        </form>
      </Modal>

      {/* Edit user: modal pop-up dengan label field yang jelas */}
      <Modal
        open={editingUserId !== null}
        onClose={onCancelEdit}
        title={`Ubah Data Pengguna: ${editUserClient || editUserEmail}`}
        description="Perbarui identitas workspace, alamat email login, bio, atau atur ulang password secara langsung."
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
        <div className="space-y-3.5">
          <div>
            <label
              htmlFor="edit-user-client"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
            >
              Nama Lengkap / Workspace
            </label>
            <input
              id="edit-user-client"
              name="editUserClient"
              type="text"
              value={editUserClient}
              onChange={(e) => onEditFieldChange('client_name', e.target.value)}
              placeholder="Nama lengkap atau workspace"
              aria-label="Nama lengkap atau workspace"
              className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="edit-user-email"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
            >
              Alamat Email Login
            </label>
            <input
              id="edit-user-email"
              name="editUserEmail"
              type="email"
              value={editUserEmail}
              onChange={(e) => onEditFieldChange('email', e.target.value)}
              placeholder="Email tertaut"
              aria-label="Alamat email login"
              className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="edit-user-bio"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
            >
              Bio / Keterangan Profil
            </label>
            <input
              id="edit-user-bio"
              name="editUserBio"
              type="text"
              value={editUserBio}
              onChange={(e) => onEditFieldChange('bio', e.target.value)}
              placeholder="Bio singkat pengguna"
              aria-label="Bio singkat pengguna"
              className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
            />
          </div>

          <PasswordInput
            id="edit-user-password"
            name="editUserPassword"
            label="Setel Password Baru (Opsional)"
            hint="Kosongkan jika tidak ingin mengubah password pengguna ini."
            value={editUserPassword}
            onChange={(e) => onEditFieldChange('password', e.target.value)}
            placeholder="Minimal 6 karakter..."
            autoComplete="new-password"
          />
        </div>
      </Modal>
    </div>
  );
}
