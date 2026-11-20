'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';

export type CommandAction = {
  id: string;
  label: string;
  group: 'navigate' | 'action';
  keywords?: string;
  onSelect: () => void;
};

/**
 * Palet perintah ringan (Ctrl/Cmd+K) tanpa dependensi tambahan.
 */
export function CommandPalette({
  open,
  onClose,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: CommandAction[];
}) {
  const t = useTranslations('command');
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => {
      const hay = `${a.label} ${a.keywords ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [actions, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIdx(0);
      return;
    }
    const t0 = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t0);
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const pick = (action: CommandAction) => {
    onClose();
    window.setTimeout(() => action.onSelect(), 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[activeIdx]) {
      e.preventDefault();
      pick(filtered[activeIdx]);
    }
  };

  const navigateItems = filtered.filter((a) => a.group === 'navigate');
  const actionItems = filtered.filter((a) => a.group === 'action');

  return (
    <Modal open={open} onClose={onClose} title={t('open')} size="lg" description={undefined}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-faint)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('placeholder')}
            className={cn(
              'w-full h-11 pl-10 pr-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]',
              'text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none',
              'focus-visible:ring-2 focus-visible:ring-[var(--brand)]/40'
            )}
            autoComplete="off"
          />
        </div>

        <div className="max-h-[min(50vh,20rem)] overflow-y-auto space-y-3">
          {filtered.length === 0 && <p className="text-sm text-[var(--text-muted)] px-1">{t('empty')}</p>}
          {navigateItems.length > 0 && (
            <Group title={t('group.navigate')}>
              {navigateItems.map((item) => (
                <Row key={item.id} item={item} active={filtered[activeIdx]?.id === item.id} onPick={pick} />
              ))}
            </Group>
          )}
          {actionItems.length > 0 && (
            <Group title={t('group.action')}>
              {actionItems.map((item) => (
                <Row key={item.id} item={item} active={filtered[activeIdx]?.id === item.id} onPick={pick} />
              ))}
            </Group>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)] px-1 mb-1">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({
  item,
  active,
  onPick,
}: {
  item: CommandAction;
  active: boolean;
  onPick: (a: CommandAction) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(item)}
      className={cn(
        'w-full text-left px-3 py-2 rounded-lg text-sm transition',
        active ? 'bg-[var(--brand-soft)] text-[var(--brand)]' : 'text-[var(--text)] hover:bg-[var(--surface-2)]'
      )}
    >
      {item.label}
    </button>
  );
}
