'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Download,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Field';

/** Frasa yang harus diketik user untuk mengonfirmasi. */
const CONFIRM_PHRASE = 'HAPUS AKUN';

/**
 * Zona Berbahaya.
 *
 * Dua hal: unduh data, dan hapus akun.
 *
 * Unduh data dipakai lebih dulu - kalau user memang mau hapus, dia tetap
 * bisa menyimpan salinan sebelum kehujuran. Jadi tombolnya di atas, dan
 * hapus akun di bawah dengan konfirmasi berlapis.
 *
 * Penghapusan butuh tiga hal: mengetik frasa konfirmasi, password akun
 * (kalau punya), dan alasan opsional. Semua alasan dicatat di audit log.
 */
export function DangerZone() {
  const t = useTranslations('settings.danger');
  const router = useRouter();

  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const phraseValid = phrase.trim() === CONFIRM_PHRASE;

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Gagal mengekspor data');
      }

      // Trigger download dari response blob.
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? 'stashinmeid-export.json';

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success(t('exported'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengekspor data');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: phrase.trim(),
          password: password || undefined,
          reason: reason.trim() || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Server minta password - tampilkan field-nya.
        if (json.needsPassword) {
          setNeedsPassword(true);
          toast.error(t('needPassword'));
        } else {
          toast.error(json.error || 'Gagal menghapus akun');
        }
        return;
      }

      toast.success(t('deleted'));
      setConfirmOpen(false);

      // Akun sudah tidak ada. Arahkan ke login.
      setTimeout(() => {
        router.push('/login');
        router.refresh();
      }, 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus akun');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="rounded-xl border border-[var(--out)]/40 bg-[var(--surface-1)]">
      <div className="flex items-start gap-3 border-b border-[var(--line)] px-4 py-4">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--out)]/10 text-[var(--out)]">
          <TriangleAlert className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-[var(--text)]">
            {t('title')}
          </h3>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
            {t('hint')}
          </p>
        </div>
      </div>

      {/* Unduh data - lettingakkan yang lebih aman dulu */}
      <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--text)]">
            {t('exportTitle')}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
            {t('exportHint')}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExport}
          loading={exporting}
          icon={<Download className="size-3.5" />}
          className="shrink-0"
        >
          {t('exportButton')}
        </Button>
      </div>

      {/* Hapus akun */}
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--text)]">
            {t('deleteTitle')}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
            {t('deleteHint')}
          </p>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          icon={<Trash2 className="size-3.5" />}
          className="shrink-0"
        >
          {t('deleteButton')}
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setPhrase('');
          setPassword('');
          setReason('');
          setNeedsPassword(false);
        }}
        title={t('confirmTitle')}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--out)]/30 bg-[var(--out)]/10 px-3 py-2.5">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-[var(--out)]"
              aria-hidden
            />
            <p className="text-[12px] leading-relaxed text-[var(--text)]">
              {t('confirmWarning')}
            </p>
          </div>

          <Input
            label={t('phraseLabel', { phrase: CONFIRM_PHRASE })}
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
            spellCheck={false}
            className={
              phrase && !phraseValid ? 'border-[var(--out)]' : undefined
            }
          />

          {needsPassword && (
            <PasswordInput
              label={t('passwordLabel')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          )}

          <Input
            label={t('reasonLabel')}
            hint={t('reasonHint')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reasonPlaceholder')}
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
              disabled={!phraseValid || (needsPassword && !password)}
              icon={deleting ? undefined : <Trash2 className="size-3.5" />}
            >
              {t('confirmDelete')}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
