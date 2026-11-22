'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { useLocale } from 'next-intl';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'brand' | 'danger';
  /** Jika diisi, tindakan yang dikonfirmasi otomatis dicatat ke Audit Log 2-arah. */
  audit?: {
    action: string;
    category:
      | 'settings'
      | 'finance'
      | 'group'
      | 'membership'
      | 'admin'
      | 'auth';
    detail: string;
    targetUserId?: string | null;
  };
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  logAudit: (audit: NonNullable<ConfirmOptions['audit']>) => void;
}

const ConfirmContext = createContext<ConfirmContextValue>({
  confirm: async () => true,
  logAudit: () => {},
});

export function logAuditEvent(
  audit: NonNullable<ConfirmOptions['audit']>
): void {
  if (typeof window === 'undefined') return;
  void fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(audit),
  }).catch(() => {
    // Non-blocking audit logger
  });
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  const handleClose = (accepted: boolean) => {
    const current = options;
    setOptions(null);
    if (accepted && current?.audit) {
      logAuditEvent(current.audit);
    }
    resolverRef.current?.(accepted);
    resolverRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={{ confirm, logAudit: logAuditEvent }}>
      {children}
      <Modal
        open={options !== null}
        onClose={() => handleClose(false)}
        title={options?.title || (isEn ? 'Confirm Action' : 'Konfirmasi Tindakan')}
        size="sm"
        footer={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleClose(false)}
            >
              {options?.cancelLabel || (isEn ? 'Cancel' : 'Batal')}
            </Button>
            <Button
              size="sm"
              variant={options?.tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => handleClose(true)}
            >
              {options?.confirmLabel || (isEn ? 'Yes, Continue' : 'Ya, Lanjutkan')}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${
              options?.tone === 'danger'
                ? 'bg-[var(--out-soft)] text-[var(--out)]'
                : 'bg-[var(--brand-soft)] text-[var(--brand)]'
            }`}
          >
            {options?.tone === 'danger' ? (
              <AlertTriangle className="size-4" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
          </div>
          <div className="space-y-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
            <p className="text-[var(--text)]">
              {options?.description ||
                (isEn
                  ? 'Are you sure you want to perform this action?'
                  : 'Apakah Anda yakin ingin melanjutkan tindakan ini?')}
            </p>
            {options?.audit && (
              <p className="text-[11px] text-[var(--text-faint)]">
                {isEn
                  ? 'This action will be recorded in the audit log.'
                  : 'Tindakan ini akan dicatat otomatis di audit log.'}
              </p>
            )}
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
