'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, MessageCircle, Search, Send } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { APP_TIMEZONE, appNow } from '@/lib/format';

interface ParsedProfile {
  id: string;
  client_name: string;
  avatar_url: string | null;
}

interface Thread {
  peerId: string;
  lastMessage: string;
  lastUserId: string;
  lastAt: string;
  unread: number;
  peer: ParsedProfile;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
}

interface SearchResult {
  id: string;
  client_name: string;
  avatar_url: string | null;
  emailMasked: string | null;
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-2)] text-[13px] font-semibold text-[var(--text-muted)]">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function timeAgo(iso: string): string {
  // Dipakai saat render, jadi basis waktunya harus sama di server dan browser.
  // `Date.now()` boleh berbeda beberapa detik antara keduanya - itu cukup untuk
  // memicu hydration mismatch. `appNow()` menormalkan ke zona aplikasi.
  const diff = appNow().getTime() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/**
 * Obrolan antar pengguna (1-on-1, polling - tanpa realtime supaya ringan).
 *
 * Satu halaman dua panel: daftar percakapan + pencarian akun di kiri,
 * percakapan aktif di kanan. Di mobile percakapan menimpa daftar.
 */
export function ChatPanel() {
  const t = useTranslations('sosial');

  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [peer, setPeer] = useState<ParsedProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/social/messages?threads=1', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setThreads(json.threads ?? []);
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (peerId: string, quiet = false) => {
    if (!quiet) setMsgLoading(true);
    try {
      const res = await fetch(`/api/social/messages?peer=${peerId}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setMessages(json.messages ?? []);
    } finally {
      if (!quiet) setMsgLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Polling hanya saat ada percakapan aktif; daftar thread menyusul lebih jarang.
  useEffect(() => {
    if (!peer) return;
    const id = setInterval(() => loadMessages(peer.id, true), 5000);
    return () => clearInterval(id);
  }, [peer, loadMessages]);

  useEffect(() => {
    if (!peer) return;
    const id = setInterval(loadThreads, 15000);
    return () => clearInterval(id);
  }, [peer, loadThreads]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, peer]);

  // Pencarian akun: debounced 300ms.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/social/search?q=${encodeURIComponent(q)}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (res.ok) setResults(json.users ?? []);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const openPeer = (p: ParsedProfile) => {
    setPeer(p);
    setResults([]);
    setQuery('');
    loadMessages(p.id);
  };

  const send = async () => {
    const body = input.trim();
    if (!body || !peer || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/social/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peer: peer.id, body }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, json.message]);
        setInput('');
        loadThreads();
      }
    } finally {
      setSending(false);
    }
  };

  const chatEmptyState = (
    <EmptyState
      icon={<MessageCircle className="size-8 text-[var(--text-faint)]" />}
      title={t('chatEmptyTitle')}
      description={t('chatEmptyDesc')}
      className="flex-1"
    />
  );

  return (
    <div className="grid h-[min(70vh,640px)] grid-cols-1 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-1)] md:grid-cols-[16rem_1fr]">
      {/* Daftar percakapan + pencarian */}
      <div
        className={cn(
          'flex min-h-0 flex-col border-[var(--line)] md:border-r',
          peer && 'hidden md:flex'
        )}
      >
        <div className="border-b border-[var(--line)] p-3">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5">
            <Search className="size-3.5 shrink-0 text-[var(--text-faint)]" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('chatSearchPlaceholder')}
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--text-faint)]"
            />
          </div>
          {/* Hasil pencarian akun */}
          {results.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => openPeer({ id: u.id, client_name: u.client_name, avatar_url: u.avatar_url })}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface-2)]"
                >
                  <Avatar name={u.client_name} url={u.avatar_url} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{u.client_name}</span>
                    {u.emailMasked && (
                      <span className="block truncate text-[11px] text-[var(--text-muted)]">
                        {u.emailMasked}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {threadsLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="size-4 animate-spin text-[var(--text-faint)]" />
            </div>
          ) : threads.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-[var(--text-muted)]">
              {t('chatNoThreads')}
            </p>
          ) : (
            threads.map((th) => (
              <button
                key={th.peerId}
                type="button"
                onClick={() =>
                  openPeer({ id: th.peerId, client_name: th.peer.client_name, avatar_url: th.peer.avatar_url })
                }
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--surface-2)]',
                  peer?.id === th.peerId && 'bg-[var(--surface-2)]'
                )}
              >
                <Avatar name={th.peer.client_name} url={th.peer.avatar_url} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium">{th.peer.client_name}</span>
                    <span className="shrink-0 text-[10px] text-[var(--text-faint)]">
                      {timeAgo(th.lastAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'truncate text-[11px]',
                        th.unread > 0
                          ? 'font-semibold text-[var(--text)]'
                          : 'text-[var(--text-muted)]'
                      )}
                    >
                      {th.lastMessage}
                    </span>
                    {th.unread > 0 && (
                      <span className="tnum flex size-4.5 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-[var(--brand-contrast)]">
                        {th.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Percakapan aktif */}
      {peer ? (
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center gap-2.5 border-b border-[var(--line)] p-3">
            <Button
              variant="secondary"
              size="sm"
              className="md:hidden"
              onClick={() => setPeer(null)}
              aria-label={t('chatBack')}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <Avatar name={peer.client_name} url={peer.avatar_url} />
            <span className="truncate text-[14px] font-semibold">{peer.client_name}</span>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            {msgLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-[var(--text-faint)]" />
              </div>
            ) : messages.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-[var(--text-muted)]">
                {t('chatStartHint')}
              </p>
            ) : (
              messages.map((m) => {
                // Karena API hanya mengembalikan pesan dua anggota thread ini,
                // tanpa siapa-siapa lawan bicara pasti pesan saya.
                const isMine = m.sender_id !== peer.id;
                return (
                  <div
                    key={m.id}
                    className={cn('flex', isMine ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px]',
                        isMine
                          ? 'rounded-br-md bg-[var(--brand)] text-[var(--brand-contrast)]'
                          : 'rounded-bl-md bg-[var(--surface-2)]'
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p
                        className={cn(
                          'mt-1 text-[10px]',
                          isMine ? 'text-[var(--brand-contrast)]/70' : 'text-[var(--text-faint)]'
                        )}
                      >
                        {new Intl.DateTimeFormat('id-ID', {
                          timeZone: APP_TIMEZONE,
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(m.created_at))}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex items-end gap-2 border-t border-[var(--line)] p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={t('chatInputPlaceholder')}
              className="max-h-24 min-h-9 flex-1 resize-none rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-[13px] outline-none placeholder:text-[var(--text-faint)]"
            />
            <Button size="sm" onClick={send} loading={sending} disabled={!input.trim()} aria-label={t('chatSend')}>
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        chatEmptyState
      )}
    </div>
  );
}
