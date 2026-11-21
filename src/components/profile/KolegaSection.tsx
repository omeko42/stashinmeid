'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, Plus, UserPlus, Users, X } from 'lucide-react';
import { Amount } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { formatRp } from '@/lib/format';
import { type KolegaApi } from '@/hooks/useKolega';
import { cn } from '@/lib/cn';

/**
 * Kolega - ruang keuangan bersama semacam dompet sama.
 *
 * Setiap grup punya anggota; flow transaksi bersama pilih grup ini saat
 * mencatat. Kelola di sini: buat grup, undang kolega via email, tendang.
 */
export function KolegaSection({ kolega }: { kolega: KolegaApi }) {
  const t = useTranslations('settings.kolega');
  const { groups, loading, error, createGroup, invite, remove } = kolega;
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

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
      toast.success(t('invited'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('failed'));
    }
  };

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-[var(--info)]" aria-hidden />
        <h3 className="text-[14px] font-semibold text-[var(--text)]">{t('title')}</h3>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
        {t('subtitle')}
      </p>

      {/* Buat grup baru */}
      <div className="mt-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t('groupName')}
          aria-label={t('groupName')}
          maxLength={80}
          className="h-9 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
        />
        <Button size="sm" onClick={handleCreate} loading={creating} icon={<Plus className="size-3.5" />}>
          {t('create')}
        </Button>
      </div>

      {loading && groups.length === 0 && (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-[var(--brand)]" />
        </div>
      )}

      {error && (
        <p className="mt-3 text-[12px] text-[var(--out)]">{error}</p>
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
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ))}
            </div>

            {/* Undang kolega */}
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
  );
}
