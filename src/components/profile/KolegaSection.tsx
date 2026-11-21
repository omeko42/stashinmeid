'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Check,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  Users,
  UserX,
  Wallet,
  X,
} from 'lucide-react';
import { Amount } from '@/components/ui/Surface';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatRp } from '@/lib/format';
import { type KolegaApi } from '@/hooks/useKolega';
import { type ConnectionsApi } from '@/hooks/useConnections';
import { cn } from '@/lib/cn';

interface KolegaSectionProps {
  kolega: KolegaApi;
  connections: ConnectionsApi;
}

/**
 * Kolega & grup keuangan.
 *
 * Dua hal yang berbeda, jadi dipisah jelas supaya tidak disalahpahami:
 *
 *   KOLEGA       - pertemanan 2-arah, murni sosial. Tidak ada akses ke
 *                  data keuangan satu sama lain.
 *   GRUP KEUANGAN- pooling transaksi. Anggota grup melihat transaksi
 *                  yang ditandai untuk grup itu.
 *
 * Jadi orang bisa jadi kolegamu tanpa jadi anggota grup keuangannya.
 */
export function KolegaSection({ kolega, connections }: KolegaSectionProps) {
  const t = useTranslations('settings.kolega');
  const tConn = useTranslations('sosial.connections');

  const { groups, loading: groupsLoading, error: groupsError, createGroup, invite, remove } =
    kolega;
  const {
    accepted,
    incoming,
    outgoing,
    loading: connLoading,
    error: connError,
    respond,
  } = connections;

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createGroup(newName.trim());
      setNewName('');
      toast.success(t('created'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('failed'));
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (groupId: string, email: string) => {
    try {
      await invite(groupId, email);
      setInviteEmail('');
      toast.success(t('invited'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('failed'));
    }
  };

  const handleRespond = async (
    connectionId: string,
    action: 'accept' | 'reject' | 'remove'
  ) => {
    setBusyId(connectionId);
    try {
      await respond(connectionId, action);
      if (action === 'accept') toast.success(tConn('accepted'));
      else if (action === 'reject') toast.success(tConn('rejected'));
      else toast.success(tConn('removed'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('failed'));
    } finally {
      setBusyId(null);
    }
  };

  const loading = connLoading || groupsLoading;
  const error = connError || groupsError;

  return (
    <div className="space-y-5">
      {/* ----------------------------------------------------------------
          KOLEGA - pertemanan sosial, 2-arah
      ---------------------------------------------------------------- */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-[var(--info)]" aria-hidden />
          <h3 className="text-[14px] font-semibold text-[var(--text)]">
            {tConn('title')}
          </h3>
          {accepted.length > 0 && (
            <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
              {accepted.length}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
          {tConn('subtitle')}
        </p>

        {error && <p className="mt-3 text-[12px] text-[var(--out)]">{error}</p>}

        {/* Permintaan masuk - paling penting, jadi di atas */}
        {incoming.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {tConn('incomingTitle')} ({incoming.length})
            </p>
            <div className="space-y-2">
              {incoming.map((c) => (
                <ConnectionRow
                  key={c.id}
                  name={c.profile?.client_name || c.profile?.email || '?'}
                  avatarUrl={c.profile?.avatar_url ?? null}
                  busy={busyId === c.id}
                  actions={
                    <>
                      <Button
                        size="sm"
                        icon={<Check className="size-3.5" />}
                        onClick={() => handleRespond(c.id, 'accept')}
                        disabled={busyId === c.id}
                      >
                        {tConn('accept')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<X className="size-3.5" />}
                        onClick={() => handleRespond(c.id, 'reject')}
                        disabled={busyId === c.id}
                      >
                        {tConn('reject')}
                      </Button>
                    </>
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Permintaan terkirim */}
        {outgoing.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {tConn('outgoingTitle')}
            </p>
            <div className="space-y-2">
              {outgoing.map((c) => (
                <ConnectionRow
                  key={c.id}
                  name={c.profile?.client_name || c.profile?.email || '?'}
                  avatarUrl={c.profile?.avatar_url ?? null}
                  busy={busyId === c.id}
                  trailing={tConn('pending')}
                  actions={
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<X className="size-3.5" />}
                      onClick={() => handleRespond(c.id, 'remove')}
                      disabled={busyId === c.id}
                    >
                      {tConn('cancel')}
                    </Button>
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Daftar kolega aktif */}
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {tConn('listTitle')}
          </p>

          {loading && accepted.length === 0 ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-[var(--brand)]" />
            </div>
          ) : accepted.length === 0 ? (
            <EmptyState
              icon={<UserPlus className="size-5" />}
              title={tConn('emptyTitle')}
              description={tConn('emptyHint')}
            />
          ) : (
            <div className="space-y-2">
              {accepted.map((c) => (
                <ConnectionRow
                  key={c.id}
                  name={c.profile?.client_name || c.profile?.email || '?'}
                  avatarUrl={c.profile?.avatar_url ?? null}
                  busy={busyId === c.id}
                  actions={
                    <IconButton
                      label={tConn('remove')}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRespond(c.id, 'remove')}
                      disabled={busyId === c.id}
                    >
                      <UserX className="size-3.5" />
                    </IconButton>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------------
          GRUP KEUANGAN - pooling transaksi
      ---------------------------------------------------------------- */}
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-[var(--brand)]" aria-hidden />
          <h3 className="text-[14px] font-semibold text-[var(--text)]">
            {t('title')}
          </h3>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
          {t('subtitle')}
        </p>

        <div className="mt-4 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('groupName')}
            aria-label={t('groupName')}
            maxLength={80}
            className="h-9 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
          />
          <Button
            size="sm"
            onClick={handleCreate}
            loading={creating}
            icon={<Plus className="size-3.5" />}
          >
            {t('create')}
          </Button>
        </div>

        {groupsLoading && groups.length === 0 && (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-[var(--brand)]" />
          </div>
        )}

        <div className="mt-4 space-y-3">
          {groups.map((g) => (
            <div key={g.id} className="rounded-lg border border-[var(--line)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[13px] font-semibold text-[var(--text)]">
                  {g.name}
                </p>
                {g.isOwner && (
                  <span className="shrink-0 rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--brand)]">
                    {t('owner')}
                  </span>
                )}
              </div>

              <div className="tnum mt-2 flex gap-4 text-[12px]">
                <span>
                  <span className="text-[var(--text-muted)]">{t('inflow')} </span>
                  <Amount value={formatRp(g.totals.inflow)} tone="brand" size="sm" />
                </span>
                <span>
                  <span className="text-[var(--text-muted)]">{t('outflow')} </span>
                  <Amount value={formatRp(g.totals.outflow)} tone="out" size="sm" />
                </span>
              </div>

              {/* Anggota */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {g.members.map((m) => (
                  <span
                    key={m.user_id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] py-1 pl-1 pr-2 text-[11px] text-[var(--text)]"
                  >
                    <span className="flex size-5 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[9px] font-bold text-[var(--brand)]">
                      {(m.profile?.client_name || m.profile?.email || '?')
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                    <span className="max-w-[140px] truncate">
                      {m.profile?.client_name || m.profile?.email}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await remove(g.id, m.user_id);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : t('failed'));
                        }
                      }}
                      aria-label={t('remove')}
                      disabled={!g.isOwner}
                      className={cn(
                        'ml-0.5 rounded-full p-0.5 text-[var(--text-faint)] transition hover:text-[var(--out)]',
                        !g.isOwner && 'pointer-events-none opacity-40'
                      )}
                    >
                      <Trash2 className="size-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>

              {/* Undang ke grup keuangan */}
              {g.isOwner && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={t('inviteEmail')}
                    aria-label={t('invite')}
                    className="h-8 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<UserPlus className="size-3.5" />}
                    onClick={() => g.id && inviteEmail && handleInvite(g.id, inviteEmail)}
                    disabled={!inviteEmail.includes('@')}
                  >
                    {t('invite')}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Baris satu koneksi (nama + avatar + aksi). */
function ConnectionRow({
  name,
  avatarUrl,
  busy,
  trailing,
  actions,
}: {
  name: string;
  avatarUrl: string | null;
  busy?: boolean;
  trailing?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="size-7 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[11px] font-bold text-[var(--brand)]">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}

      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text)]">
        {name}
      </span>

      {trailing && (
        <span className="shrink-0 text-[11px] text-[var(--text-faint)]">{trailing}</span>
      )}

      {busy ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-[var(--brand)]" />
      ) : (
        actions && <span className="flex shrink-0 items-center gap-1.5">{actions}</span>
      )}
    </div>
  );
}
