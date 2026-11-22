'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  MessageCircle,
  Send,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/Button';

export interface QuickChatContact {
  id: string;
  client_name: string;
  email: string;
  avatar_url?: string | null;
}

interface FloatingQuickChatProps {
  contacts: QuickChatContact[];
  onOpenFullChat: (peer?: QuickChatContact) => void;
  onFindColleague: () => void;
}

/**
 * Widget Obrolan Cepat mengambang (floating chat bubble) di kanan bawah.
 * Tampil di semua halaman kecuali saat pengguna sudah berada di menu Obrolan penuh.
 */
export function FloatingQuickChat({
  contacts,
  onOpenFullChat,
  onFindColleague,
}: FloatingQuickChatProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const activePeerId =
    selectedId && contacts.some((c) => c.id === selectedId)
      ? selectedId
      : contacts[0]?.id ?? '';

  const activePeer = contacts.find((c) => c.id === activePeerId);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePeerId || !message.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/social/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peer: activePeerId,
          body: message.trim(),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || (isEn ? 'Failed to send message' : 'Gagal mengirim pesan'));
      }
      toast.success(
        isEn
          ? `Sent to @${activePeer?.client_name || 'Colleague'}`
          : `Pesan terkirim ke @${activePeer?.client_name || 'Kolega'}`
      );
      setMessage('');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Failed to send message'
            : 'Gagal mengirim pesan'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative flex flex-col items-end">
      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              role="dialog"
              aria-label={isEn ? 'Quick Chat' : 'Obrolan Cepat'}
              className="relative z-40 mb-2.5 w-[310px] overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-1)] shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                    <MessageCircle className="size-3.5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--text)]">
                      {isEn ? 'Quick Chat' : 'Obrolan Cepat'}
                    </p>
                    <p className="text-[10.5px] text-[var(--text-muted)]">
                      {isEn
                        ? `${contacts.length} connected colleagues`
                        : `${contacts.length} kolega terhubung`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={isEn ? 'Close quick chat' : 'Tutup obrolan cepat'}
                  className="rounded-lg p-1 text-[var(--text-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              {/* Body */}
              <div className="p-3.5">
                {contacts.length === 0 ? (
                  <div className="space-y-3 py-2 text-center">
                    <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]">
                      <Users className="size-5" aria-hidden />
                    </span>
                    <p className="text-[12px] text-[var(--text-muted)]">
                      {isEn
                        ? 'Connect with a colleague first to start quick chatting.'
                        : 'Hubungkan diri dengan kolega dulu untuk mulai obrolan cepat.'}
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setOpen(false);
                        onFindColleague();
                      }}
                    >
                      {isEn ? 'Find Colleague' : 'Cari Kolega'}
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSend} className="space-y-2.5">
                    <div>
                      <label
                        htmlFor="floating-quick-chat-peer"
                        className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]"
                      >
                        {isEn ? 'Send to' : 'Kirim ke'}
                      </label>
                      <select
                        id="floating-quick-chat-peer"
                        name="quickChatPeer"
                        value={activePeerId}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 text-[12px] font-medium text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                      >
                        {contacts.map((c) => (
                          <option key={c.id} value={c.id}>
                            @{c.client_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="floating-quick-chat-input"
                        className="sr-only"
                      >
                        {isEn ? 'Message' : 'Pesan'}
                      </label>
                      <textarea
                        id="floating-quick-chat-input"
                        name="quickChatMessage"
                        rows={2}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (message.trim() && !sending) {
                              void handleSend(e);
                            }
                          }
                        }}
                        placeholder={
                          isEn
                            ? 'Write a quick message... (Enter to send)'
                            : 'Tulis pesan cepat... (Enter untuk kirim)'
                        }
                        className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-[12.5px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--brand)] focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          onOpenFullChat(activePeer);
                        }}
                        className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--text-muted)] transition hover:text-[var(--brand)]"
                      >
                        <span>{isEn ? 'Open Full Chat' : 'Buka Obrolan Penuh'}</span>
                        <ArrowUpRight className="size-3.5" aria-hidden />
                      </button>

                      <Button
                        type="submit"
                        size="sm"
                        loading={sending}
                        disabled={!message.trim()}
                        icon={<Send className="size-3.5" />}
                      >
                        {isEn ? 'Send' : 'Kirim'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={isEn ? 'Quick Chat' : 'Obrolan Cepat'}
        aria-expanded={open}
        title={isEn ? 'Quick Chat' : 'Obrolan Cepat'}
        className="relative z-40 flex size-11 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--surface-1)] text-[var(--text)] shadow-lg transition-transform hover:scale-105 hover:border-[var(--brand)] hover:text-[var(--brand)] active:scale-95"
      >
        {open ? (
          <X className="size-5" aria-hidden />
        ) : (
          <MessageCircle className="size-5" aria-hidden />
        )}
      </button>
    </div>
  );
}
