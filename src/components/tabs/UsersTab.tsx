'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CalendarClock,
  Crown,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type { UserRole } from '@/types/finance';
import {
  MEMBERSHIP_PLANS,
  MEMBERSHIP_TIER_ORDER,
  addMonthsIso,
  type MembershipTier,
} from '@/lib/membership';
import { Modal } from '@/components/ui/Modal';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PanelSkeleton } from '@/components/ui/BrandLoader';
import { APP_TIMEZONE } from '@/lib/format';

export interface ManagedUser {
  id: string;
  email: string;
  client_name: string;
  bio?: string | null;
  role: UserRole;
  membership_tier?: MembershipTier;
  membership_stored_tier?: MembershipTier;
  membership_expires_at?: string | null;
  membership_duration_months?: number | null;
  membership_note?: string | null;
  membership_is_expired?: boolean;
  membership_days_left?: number | null;
  is_demo?: boolean;
  created_at: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  client_name: string;
  bio: string;
  role: UserRole;
}

export interface SaveUserPayload {
  userId: string;
  email: string;
  client_name: string;
  bio: string;
  role: UserRole;
  password?: string;
  membership_tier: MembershipTier;
  membership_duration_months: number;
  membership_expires_at?: string | null;
  membership_note: string;
}

interface UsersTabProps {
  users: ManagedUser[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSaveUser: (payload: SaveUserPayload) => Promise<boolean>;
  onResetPassword: (email: string) => void;
  onImpersonate: (user: ManagedUser) => void;
  onDelete: (userId: string) => void;
  onCreateUser?: (payload: CreateUserPayload) => Promise<boolean>;
}

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Manajemen user (khusus admin & superadmin).
 *
 * Seluruh pengaturan tiap akun (profil, role, reset password, paket membership,
 * durasi bulan / tanggal berakhir, dan catatan harga teman) disatukan dalam satu
 * tombol "Ubah" supaya daftar pengguna tetap bersih dan tidak berantakan.
 */
export function UsersTab({
  users,
  loading,
  error,
  onRefresh,
  onSaveUser,
  onResetPassword,
  onImpersonate,
  onDelete,
  onCreateUser,
}: UsersTabProps) {
  const tUsers = useTranslations('users');
  const tCommon = useTranslations('common');

  const [search, setSearch] = useState('');

  // Modal Tambah Pengguna Baru
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newBio, setNewBio] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');

  // Modal Terpadu "Ubah Pengguna" (Profil + Role + Password + Paket & Durasi)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [draftClient, setDraftClient] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [draftRole, setDraftRole] = useState<UserRole>('user');
  const [draftPassword, setDraftPassword] = useState('');
  const [draftTier, setDraftTier] = useState<MembershipTier>('free');
  const [draftMonths, setDraftMonths] = useState<number>(3);
  const [draftCustomDate, setDraftCustomDate] = useState<string>('');
  const [draftNote, setDraftNote] = useState<string>('');
  const [savingUser, setSavingUser] = useState(false);

  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'admin', label: tUsers('roles.admin') },
    { value: 'user', label: tUsers('roles.user') },
  ];

  const openEditModal = (u: ManagedUser) => {
    setEditingUser(u);
    setDraftClient(u.client_name || '');
    setDraftEmail(u.email || '');
    setDraftBio(u.bio || '');
    setDraftRole(u.role);
    setDraftPassword('');
    const currentTier = u.membership_tier || 'free';
    setDraftTier(currentTier);
    setDraftMonths(
      typeof u.membership_duration_months === 'number'
        ? u.membership_duration_months
        : currentTier === 'free'
          ? 3
          : u.membership_expires_at
            ? 3
            : 0
    );
    setDraftCustomDate(isoToDateInput(u.membership_expires_at));
    setDraftNote(u.membership_note || '');
  };

  const handleSaveUnified = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingUser(true);
    try {
      const ok = await onSaveUser({
        userId: editingUser.id,
        email: draftEmail.trim(),
        client_name: draftClient.trim(),
        bio: draftBio.trim(),
        role: draftRole,
        password: draftPassword.trim().length >= 6 ? draftPassword.trim() : undefined,
        membership_tier: draftTier,
        membership_duration_months: draftTier === 'free' ? 0 : draftMonths,
        membership_expires_at:
          draftTier === 'free'
            ? null
            : draftCustomDate.trim() || null,
        membership_note: draftTier === 'free' ? '' : draftNote.trim(),
      });
      if (ok) {
        setEditingUser(null);
      }
    } finally {
      setSavingUser(false);
    }
  };

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

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      (u.client_name || '').toLowerCase().includes(q) ||
      (u.bio || '').toLowerCase().includes(q)
    );
  });

  const adminCount = users.filter((u) => u.role === 'admin').length;

  const previewExpiryText = (() => {
    if (draftTier === 'free') {
      return 'Akun berada di paket Gratis (maks. 3 grup). Pilih Standard / Pro / Business di atas untuk mengaktifkan durasi langganan.';
    }
    const planLabel = MEMBERSHIP_PLANS[draftTier].labelId;
    if (draftCustomDate) {
      const formatted = new Intl.DateTimeFormat('id-ID', {
        timeZone: APP_TIMEZONE,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(`${draftCustomDate}T12:00:00+07:00`));
      return `Paket ${planLabel} aktif hingga ${formatted}, setelah itu otomatis kembali ke Gratis.`;
    }
    if (draftMonths === 0) {
      return `Paket ${planLabel} akan aktif permanen tanpa batas waktu.`;
    }
    const formatted = new Intl.DateTimeFormat('id-ID', {
      timeZone: APP_TIMEZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(addMonthsIso(draftMonths)));
    return `Paket ${planLabel} aktif ${draftMonths} bulan hingga ${formatted}, setelah itu otomatis kembali ke Gratis.`;
  })();

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
        <PanelSkeleton label="Memuat daftar pengguna..." rows={5} />
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
          {filteredUsers.map((u, idx) => {
            const effTier = u.membership_tier || 'free';
            const planInfo = MEMBERSHIP_PLANS[effTier];
            return (
              <div
                key={u.id}
                className={`px-4 py-3.5 transition-colors hover:bg-[var(--surface-2)]/40 ${
                  idx > 0 ? 'border-t border-[var(--line)]' : ''
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[12px] font-bold text-[var(--brand)]">
                      {(u.client_name || u.email || 'U').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
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
                        {u.is_demo && (
                          <span className="rounded-full bg-[var(--due-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--due)]">
                            Demo
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            u.membership_is_expired
                              ? 'bg-[var(--out-soft)] text-[var(--out)]'
                              : effTier === 'free'
                                ? 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                                : 'bg-[var(--in-soft)] text-[var(--in)]'
                          }`}
                        >
                          <Crown className="size-3" />
                          {planInfo.labelId}
                          {u.membership_is_expired
                            ? ' (Kedaluwarsa)'
                            : effTier !== 'free' && u.membership_expires_at
                              ? ` · s/d ${new Intl.DateTimeFormat('id-ID', {
                                  timeZone: APP_TIMEZONE,
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                }).format(new Date(u.membership_expires_at))}${
                                  typeof u.membership_days_left === 'number'
                                    ? ` (${u.membership_days_left}h)`
                                    : ''
                                }`
                              : effTier !== 'free'
                                ? ' · Permanen'
                                : ''}
                        </span>
                        {u.membership_note && (
                          <span className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] italic text-[var(--text-muted)]">
                            {u.membership_note}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
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

                  {/* Bar aksi ringkas: 1 tombol "Ubah" untuk semua setting user + Masuk sebagai + Hapus */}
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<SlidersHorizontal className="size-3.5" />}
                      onClick={() => openEditModal(u)}
                    >
                      {tCommon('edit')}
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
            );
          })}
        </div>
      )}

      {/* Modal Terpadu "Ubah Pengguna" — Profil, Peran, Password, Paket & Durasi dalam satu tempat */}
      <Modal
        open={editingUser !== null}
        onClose={() => setEditingUser(null)}
        title={
          editingUser
            ? `Ubah Pengguna: ${editingUser.client_name || editingUser.email}`
            : 'Ubah Pengguna'
        }
        description="Atur profil, peran akses, kata sandi, paket membership, dan durasi langganan dalam satu form."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditingUser(null)}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              size="sm"
              loading={savingUser}
              onClick={handleSaveUnified}
            >
              Simpan Perubahan
            </Button>
          </>
        }
      >
        {editingUser && (
          <form onSubmit={handleSaveUnified} className="space-y-5">
            {/* Bagian 1: Profil, Peran & Keamanan */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--brand)]">
                1. Profil, Peran &amp; Keamanan
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="edit-user-client"
                    className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]"
                  >
                    Nama Lengkap / Workspace
                  </label>
                  <input
                    id="edit-user-client"
                    name="editUserClient"
                    type="text"
                    required
                    value={draftClient}
                    onChange={(e) => setDraftClient(e.target.value)}
                    placeholder="Nama lengkap atau workspace"
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-user-role"
                    className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]"
                  >
                    Peran Akses
                  </label>
                  <select
                    id="edit-user-role"
                    name="editUserRole"
                    value={draftRole}
                    onChange={(e) => setDraftRole(e.target.value as UserRole)}
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="edit-user-email"
                    className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]"
                  >
                    Alamat Email Login
                  </label>
                  <input
                    id="edit-user-email"
                    name="editUserEmail"
                    type="email"
                    required
                    value={draftEmail}
                    onChange={(e) => setDraftEmail(e.target.value)}
                    placeholder="Email tertaut"
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-user-bio"
                    className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]"
                  >
                    Bio / Keterangan Profil
                  </label>
                  <input
                    id="edit-user-bio"
                    name="editUserBio"
                    type="text"
                    value={draftBio}
                    onChange={(e) => setDraftBio(e.target.value)}
                    placeholder="Bio singkat pengguna"
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                <PasswordInput
                  id="edit-user-password"
                  name="editUserPassword"
                  label="Setel Password Baru (Opsional)"
                  value={draftPassword}
                  onChange={(e) => setDraftPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak diubah"
                  autoComplete="new-password"
                />

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  icon={<KeyRound className="size-3.5" />}
                  onClick={() => onResetPassword(editingUser.email)}
                  className="h-9"
                >
                  Kirim Email Reset Password
                </Button>
              </div>
            </div>

            {/* Bagian 2: Paket Membership & Durasi Langganan (Selalu Terlihat Jelas) */}
            <div className="space-y-3 border-t border-[var(--line)] pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--brand)]">
                  <Crown className="size-3.5" />
                  2. Paket Membership &amp; Durasi Langganan
                </p>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Cocok untuk harga teman / gratis X bulan
                </span>
              </div>

              {/* Pilihan 4 Paket */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MEMBERSHIP_TIER_ORDER.map((tid) => {
                  const p = MEMBERSHIP_PLANS[tid];
                  const active = draftTier === tid;
                  return (
                    <button
                      key={tid}
                      type="button"
                      onClick={() => {
                        setDraftTier(tid);
                        if (tid !== 'free' && draftMonths === 0 && !draftCustomDate) {
                          setDraftMonths(3);
                        }
                      }}
                      className={`rounded-xl border p-2.5 text-left transition ${
                        active
                          ? 'border-[var(--brand)] bg-[var(--brand-soft)]/30'
                          : 'border-[var(--line)] bg-[var(--surface-2)]/70 hover:border-[var(--line-strong)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[12px] font-semibold text-[var(--text)]">
                          {p.labelId}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] font-semibold text-[var(--brand)]">
                        {p.badgeId}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                        {p.priceIdrMonthly === 0
                          ? 'Rp 0'
                          : `Rp ${p.priceIdrMonthly.toLocaleString('id-ID')}/bln`}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Pengaturan Durasi — SELALU TAMPIL agar langsung terlihat */}
              <div
                className={`space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/50 p-3.5 transition-opacity ${
                  draftTier === 'free' ? 'opacity-60' : 'opacity-100'
                }`}
              >
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                    Durasi Langganan (Otomatis Mulai Hari Ini)
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {[
                      { m: 1, label: '1 Bulan' },
                      { m: 3, label: '3 Bulan' },
                      { m: 6, label: '6 Bulan' },
                      { m: 12, label: '12 Bulan' },
                      { m: 0, label: 'Permanen' },
                    ].map((opt) => (
                      <button
                        key={opt.m}
                        type="button"
                        onClick={() => {
                          if (draftTier === 'free') setDraftTier('standard');
                          setDraftMonths(opt.m);
                          setDraftCustomDate('');
                        }}
                        className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition ${
                          draftTier !== 'free' &&
                          !draftCustomDate &&
                          draftMonths === opt.m
                            ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-contrast)]'
                            : 'border-[var(--line)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="edit-user-months"
                      className="text-[11px] font-semibold text-[var(--text-muted)]"
                    >
                      Durasi Manual (Bulan · 0 = Permanen)
                    </label>
                    <input
                      id="edit-user-months"
                      name="editUserMonths"
                      type="number"
                      min={0}
                      max={120}
                      value={draftMonths}
                      onChange={(e) => {
                        if (draftTier === 'free') setDraftTier('standard');
                        setDraftMonths(
                          Math.max(0, Math.min(120, Number(e.target.value) || 0))
                        );
                        setDraftCustomDate('');
                      }}
                      className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 text-[13px] font-semibold text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-user-exp-date"
                      className="text-[11px] font-semibold text-[var(--text-muted)]"
                    >
                      Atau Pilih Tanggal Berakhir Persis (Opsional)
                    </label>
                    <input
                      id="edit-user-exp-date"
                      name="editUserExpDate"
                      type="date"
                      value={draftCustomDate}
                      onChange={(e) => {
                        if (draftTier === 'free' && e.target.value) {
                          setDraftTier('standard');
                        }
                        setDraftCustomDate(e.target.value);
                      }}
                      className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="edit-user-plan-note"
                    className="text-[11px] font-semibold text-[var(--text-muted)]"
                  >
                    Catatan Langganan (Opsional)
                  </label>
                  <input
                    id="edit-user-plan-note"
                    name="editUserPlanNote"
                    type="text"
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    placeholder="Mis. Harga teman — gratis 3 bulan / Promo launching"
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Pratinjau status masa aktif */}
              <div className="flex items-center gap-2 rounded-xl border border-[var(--in)]/30 bg-[var(--in-soft)] px-3.5 py-2.5 text-[12px] text-[var(--text)]">
                <CalendarClock className="size-4 shrink-0 text-[var(--in)]" />
                <span>{previewExpiryText}</span>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Tambah Pengguna Baru */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tambah Pengguna"
        description="Akun baru langsung aktif tanpa konfirmasi email."
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
                placeholder="nama@stashinme.biz.id"
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
    </div>
  );
}
