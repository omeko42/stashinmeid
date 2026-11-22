'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import {
  Activity,
  Globe,
  RefreshCw,
  Shield,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PanelSkeleton } from '@/components/ui/BrandLoader';
import { APP_TIMEZONE } from '@/lib/format';
import type { AuditEntry } from '@/app/api/audit/route';

export function AuditLogPanel({
  defaultView = 'my',
}: {
  defaultView?: 'my' | 'global';
}) {
  const locale = useLocale();
  const isEn = locale === 'en';

  const [loading, setLoading] = useState(true);
  const [myLogs, setMyLogs] = useState<AuditEntry[]>([]);
  const [globalLogs, setGlobalLogs] = useState<AuditEntry[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<'my' | 'global'>(defaultView);

  useEffect(() => {
    setView(defaultView);
  }, [defaultView]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMyLogs(Array.isArray(json.myLogs) ? json.myLogs : []);
        setGlobalLogs(Array.isArray(json.globalLogs) ? json.globalLogs : []);
        setIsAdmin(Boolean(json.isAdmin));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeLogs = view === 'global' && isAdmin ? globalLogs : myLogs;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
              <Activity className="size-4" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--text)]">
                {isEn ? 'Activity & Audit Log' : 'Audit Log & Aktivitas'}
              </h3>
              <p className="text-[12px] text-[var(--text-muted)]">
                {isEn
                  ? 'Every confirmed action is recorded for transparency.'
                  : 'Setiap tindakan yang dikonfirmasi tercatat untuk transparansi 2 arah.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="flex rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setView('my')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
                    view === 'my'
                      ? 'bg-[var(--brand)] text-[var(--brand-contrast)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <User className="size-3" />
                  {isEn ? 'My Log' : 'Log Saya'}
                </button>
                <button
                  type="button"
                  onClick={() => setView('global')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
                    view === 'global'
                      ? 'bg-[var(--brand)] text-[var(--brand-contrast)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Globe className="size-3" />
                  {isEn ? 'Global (Admin)' : 'Global (Admin)'}
                </button>
              </div>
            )}

            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw className="size-3.5" />}
              loading={loading}
              onClick={load}
            >
              {isEn ? 'Refresh' : 'Segarkan'}
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <PanelSkeleton
          label={isEn ? 'Loading activity logs...' : 'Memuat riwayat audit log...'}
          rows={4}
        />
      ) : activeLogs.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] px-4 py-10 text-center text-[12px] text-[var(--text-muted)]">
          {isEn
            ? 'No confirmed activities recorded yet.'
            : 'Belum ada riwayat aktivitas yang tercatat.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)] divide-y divide-[var(--line)]">
          {activeLogs.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--brand)]">
                    <Shield className="size-2.5" />
                    {log.category}
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--text)]">
                    {log.action}
                  </span>
                  {log.targetName && (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      → {log.targetName}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                  {log.detail}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">
                  {log.actorName}
                  {log.actorEmail ? ` (${log.actorEmail})` : ''}
                </p>
              </div>
              <span className="tnum shrink-0 text-[11px] text-[var(--text-faint)]">
                {new Intl.DateTimeFormat(isEn ? 'en-GB' : 'id-ID', {
                  timeZone: APP_TIMEZONE,
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(log.createdAt))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
