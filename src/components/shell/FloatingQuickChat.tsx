'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  Loader2,
  MessageCircle,
  MessageSquare,
  Pin,
  Reply,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from 'next-intl';
import { cn } from '@/lib/cn';

export interface QuickChatContact {
  id: string;
  client_name: string;
  email: string;
  avatar_url?: string | null;
}

interface ThreadSummary {
  peerId: string;
  lastMessage: string;
  lastUserId: string;
  lastAt: string;
  unread: number;
  peer: {
    client_name: string;
    avatar_url: string | null;
  };
}

interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

interface FloatingQuickChatProps {
  currentUserId?: string | null;
  contacts: QuickChatContact[];
  onOpenFullChat: (peer?: QuickChatContact) => void;
  onFindColleague: () => void;
}

function formatClock(iso: string) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function AvatarBadge({
  name,
  url,
  size = 'md',
}: {
  name: string;
  url?: string | null;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'size-8 text-[11px]' : 'size-9 text-[12px]';
  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt={name}
        className={cn(dim, 'shrink-0 rounded-full object-cover ring-1 ring-black/10')}
      />
    );
  }
  const initial = (name || 'K').trim().charAt(0).toUpperCase();
  return (
    <span
      className={cn(
        dim,
        'flex shrink-0 items-center justify-center rounded-full bg-[#2563eb]/15 font-bold text-[#2563eb]'
      )}
    >
      {initial}
    </span>
  );
}

/**
 * Widget Obrolan Cepat mengambang (3 tampilan: Daftar Obrolan Aktif, Daftar Kontak,
 * dan Ruang Obrolan interaktif) dengan tombol mengambang kontras tinggi.
 */
export function FloatingQuickChat({
  currentUserId,
  contacts,
  onOpenFullChat,
  onFindColleague,
}: FloatingQuickChatProps) {
  const locale = useLocale();
  const isEn = locale === 'en';
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'threads' | 'contacts' | 'room'>('threads');
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const [activePeer, setActivePeer] = useState<QuickChatContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pinnedMsg, setPinnedMsg] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const listEndRef = useRef<HTMLDivElement>(null);

  const totalUnread = useMemo(
    () => threads.reduce((acc, t) => acc + (t.unread || 0), 0),
    [threads]
  );

  const loadThreads = useCallback(async () => {
    setThreadsLoading(true);
    try {
      const res = await fetch('/api/social/messages?threads=1', {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = (await res.json()) as { threads?: ThreadSummary[] };
      setThreads(json.threads ?? []);
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (peerId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(
        `/api/social/messages?peer=${encodeURIComponent(peerId)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) return;
      const json = (await res.json()) as { messages?: ChatMessage[] };
      setMessages(json.messages ?? []);
      // Tandai unread thread jadi 0 secara lokal setelah dibuka & sinkronkan lonceng notifikasi
      setThreads((prev) =>
        prev.map((t) => (t.peerId === peerId ? { ...t, unread: 0 } : t))
      );
      window.dispatchEvent(new Event('stashinmeid:messages-updated'));
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Muat daftar thread & badge unread langsung saat halaman terbuka + polling ringan 30 detik
  useEffect(() => {
    void loadThreads();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadThreads();
      }
    }, 30_000);
    const onSync = () => {
      void loadThreads();
    };
    window.addEventListener('stashinmeid:chat-sync', onSync);
    return () => {
      clearInterval(timer);
      window.removeEventListener('stashinmeid:chat-sync', onSync);
    };
  }, [loadThreads]);

  useEffect(() => {
    if (!open) return;
    void loadThreads();
  }, [open, loadThreads]);

  useEffect(() => {
    if (view === 'room' && messages.length > 0) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [view, messages.length]);

  const openRoomWith = (peer: QuickChatContact) => {
    setActivePeer(peer);
    setPinnedMsg(null);
    setReplyingTo(null);
    setView('room');
    void loadMessages(peer.id);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePeer || !draft.trim() || sending) return;
    const raw = draft.trim();
    const payloadBody = replyingTo ? `> ${replyingTo}\n${raw}` : raw;
    setSending(true);
    try {
      const res = await fetch('/api/social/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peer: activePeer.id, body: payloadBody }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(
          json.error || (isEn ? 'Failed to send message' : 'Gagal mengirim pesan')
        );
      }
      setDraft('');
      setReplyingTo(null);
      await loadMessages(activePeer.id);
      void loadThreads();
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

  const filteredContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.client_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [contacts, contactSearch]);

  const threadPeerIds = useMemo(
    () => new Set(threads.map((t) => t.peerId)),
    [threads]
  );

  return (
    <div className="relative flex flex-col items-end">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            role="dialog"
            aria-label={isEn ? 'Quick Chat' : 'Obrolan Cepat'}
            className="relative z-40 mb-3 flex h-[470px] max-h-[72vh] w-[340px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-1)] shadow-[0_18px_48px_rgba(0,0,0,0.38)] sm:w-[368px]"
          >
            {/* Header Bar Biru Kontras (gaya Obrolan Cepat profesional) */}
            <div className="flex shrink-0 items-center justify-between gap-2 bg-[#2563eb] px-3.5 py-2.5 text-white">
              <div className="flex min-w-0 items-center gap-2">
                <MessageSquare className="size-4 shrink-0" aria-hidden />
                <span className="truncate text-[13px] font-bold tracking-tight">
                  {isEn ? 'Quick Chat' : 'Obrolan Cepat'}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <div className="flex items-center rounded-lg bg-white/15 p-0.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setView('threads')}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-1 whitespace-nowrap transition',
                      view === 'threads' || view === 'room'
                        ? 'bg-white text-[#1d4ed8] shadow-xs'
                        : 'text-white/90 hover:text-white'
                    )}
                  >
                    <MessageCircle className="size-3" aria-hidden />
                    <span>{isEn ? 'Chats' : 'Obrolan'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('contacts')}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-1 whitespace-nowrap transition',
                      view === 'contacts'
                        ? 'bg-white text-[#1d4ed8] shadow-xs'
                        : 'text-white/90 hover:text-white'
                    )}
                  >
                    <Users className="size-3" aria-hidden />
                    <span>{isEn ? 'Contacts' : 'Kontak'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenFullChat(activePeer ?? undefined);
                  }}
                  title={isEn ? 'Open full chat' : 'Buka obrolan penuh'}
                  aria-label={isEn ? 'Open full chat' : 'Buka obrolan penuh'}
                  className="rounded-lg p-1.5 text-white/90 transition hover:bg-white/15 hover:text-white"
                >
                  <ArrowUpRight className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  title={isEn ? 'Close' : 'Tutup'}
                  aria-label={isEn ? 'Close quick chat' : 'Tutup obrolan cepat'}
                  className="rounded-lg p-1.5 text-white/90 transition hover:bg-white/15 hover:text-white"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            {/* VIEW 1: DAFTAR OBROLAN AKTIF */}
            {view === 'threads' && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-3.5 py-2.5">
                  <span className="text-[12px] font-semibold text-[var(--text)]">
                    {isEn ? 'Active Conversations' : 'Daftar Obrolan Aktif'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setView('contacts')}
                    className="rounded-lg border border-[#2563eb]/30 bg-[#2563eb]/10 px-2.5 py-1 text-[11px] font-semibold text-[#2563eb] whitespace-nowrap transition hover:bg-[#2563eb]/15"
                  >
                    + {isEn ? 'New Chat' : 'Mulai Obrolan Baru'}
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  {threadsLoading && threads.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-[var(--text-muted)]">
                      <Loader2 className="size-5 animate-spin" />
                    </div>
                  ) : threads.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2.5 px-6 text-center">
                      <span className="flex size-11 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]">
                        <MessageCircle className="size-5" aria-hidden />
                      </span>
                      <p className="text-[12.5px] font-medium text-[var(--text)]">
                        {isEn ? 'No active chats yet' : 'Belum ada obrolan aktif'}
                      </p>
                      <p className="text-[11.5px] text-[var(--text-muted)]">
                        {isEn
                          ? 'Pick a colleague from Contacts to start chatting.'
                          : 'Pilih kolega di tab Kontak untuk mulai mengirim pesan.'}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          contacts.length > 0
                            ? setView('contacts')
                            : (setOpen(false), onFindColleague())
                        }
                        className="mt-1 rounded-lg bg-[#2563eb] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#1d4ed8]"
                      >
                        {contacts.length > 0
                          ? isEn
                            ? 'Open Contacts'
                            : 'Buka Kontak'
                          : isEn
                            ? 'Find Colleague'
                            : 'Cari Kolega'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {threads.map((t) => {
                        const matched = contacts.find((c) => c.id === t.peerId);
                        const name =
                          matched?.client_name || t.peer.client_name || 'Kolega';
                        return (
                          <button
                            key={t.peerId}
                            type="button"
                            onClick={() =>
                              openRoomWith({
                                id: t.peerId,
                                client_name: name,
                                email: matched?.email || '',
                                avatar_url: matched?.avatar_url ?? t.peer.avatar_url,
                              })
                            }
                            className="flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-left transition hover:border-[var(--line)] hover:bg-[var(--surface-2)]"
                          >
                            <AvatarBadge
                              name={name}
                              url={matched?.avatar_url ?? t.peer.avatar_url}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-[12.5px] font-semibold text-[var(--text)]">
                                  @{name}
                                </span>
                                <span className="shrink-0 text-[10px] text-[var(--text-faint)]">
                                  {formatClock(t.lastAt)}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center justify-between gap-2">
                                <p className="truncate text-[11.5px] text-[var(--text-muted)]">
                                  {t.lastMessage}
                                </p>
                                {t.unread > 0 && (
                                  <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#2563eb] px-1 text-[10px] font-bold text-white">
                                    {t.unread}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VIEW 2: DAFTAR KONTAK KOLEGA */}
            {view === 'contacts' && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-[var(--line)] p-2.5">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-faint)]"
                      aria-hidden
                    />
                    <input
                      id="quick-chat-contact-search"
                      name="quickChatContactSearch"
                      type="text"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      placeholder={
                        isEn
                          ? 'Search colleague name or email...'
                          : 'Cari nama kolega atau email...'
                      }
                      aria-label={
                        isEn ? 'Search colleague' : 'Cari nama kolega'
                      }
                      className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] pl-8 pr-3 text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[#2563eb] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  {filteredContacts.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                      <p className="text-[12px] text-[var(--text-muted)]">
                        {contacts.length === 0
                          ? isEn
                            ? 'No connected colleagues yet.'
                            : 'Belum ada kolega yang terhubung.'
                          : isEn
                            ? 'No matching colleague found.'
                            : 'Kolega tidak ditemukan.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          onFindColleague();
                        }}
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--text)] transition hover:border-[var(--brand)]"
                      >
                        {isEn ? 'Find Colleague' : 'Cari Kolega'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredContacts.map((c) => {
                        const hasThread = threadPeerIds.has(c.id);
                        return (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 transition hover:bg-[var(--surface-2)]"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <AvatarBadge name={c.client_name} url={c.avatar_url} />
                              <div className="min-w-0">
                                <p className="truncate text-[12.5px] font-semibold text-[var(--text)]">
                                  @{c.client_name}
                                </p>
                                {c.email && (
                                  <p className="truncate text-[11px] text-[var(--text-muted)]">
                                    {c.email}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openRoomWith(c)}
                              className={cn(
                                'shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition',
                                hasThread
                                  ? 'bg-[#2563eb]/15 text-[#2563eb] hover:bg-[#2563eb]/25'
                                  : 'bg-[var(--brand-soft)] text-[var(--brand)] hover:opacity-85'
                              )}
                            >
                              {hasThread
                                ? isEn
                                  ? 'Chat'
                                  : 'Obrolan'
                                : isEn
                                  ? '+ Chat'
                                  : '+ Mulai Chat'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VIEW 3: RUANG OBROLAN LANGSUNG */}
            {view === 'room' && activePeer && (
              <div className="flex min-h-0 flex-1 flex-col">
                {/* Sub-header Peer */}
                <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-1)] px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setView('threads')}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 text-[11px] font-semibold text-[var(--text)] whitespace-nowrap transition hover:border-[#2563eb]"
                  >
                    <ArrowLeft className="size-3" aria-hidden />
                    <span>{isEn ? 'List' : 'Daftar'}</span>
                  </button>
                  <AvatarBadge
                    name={activePeer.client_name}
                    url={activePeer.avatar_url}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-[var(--text)]">
                      @{activePeer.client_name}
                    </p>
                    <p className="flex items-center gap-1 text-[10.5px] text-[var(--brand)]">
                      <span className="size-1.5 rounded-full bg-[var(--brand)]" />
                      <span>{isEn ? 'Connected' : 'Terhubung'}</span>
                    </p>
                  </div>
                </div>

                {/* Pinned message bar */}
                {pinnedMsg && (
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#2563eb]/20 bg-[#2563eb]/10 px-3 py-1.5 text-[11px]">
                    <div className="flex min-w-0 items-center gap-1.5 text-[#2563eb]">
                      <Pin className="size-3 shrink-0" aria-hidden />
                      <span className="truncate font-medium">
                        {isEn ? 'Pinned:' : 'Disematkan:'} {pinnedMsg}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPinnedMsg(null)}
                      className="shrink-0 font-semibold text-[#2563eb] hover:underline"
                    >
                      {isEn ? 'Unpin' : 'Lepas'}
                    </button>
                  </div>
                )}

                {/* Messages stream */}
                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-[var(--bg)]/60 p-3">
                  {messagesLoading && messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-[var(--text-muted)]">
                      <Loader2 className="size-5 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-[12px] text-[var(--text-muted)]">
                      {isEn
                        ? `Start a conversation with @${activePeer.client_name}`
                        : `Mulai percakapan dengan @${activePeer.client_name}`}
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMine = currentUserId
                        ? m.sender_id === currentUserId
                        : m.recipient_id === activePeer.id;
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            'group flex flex-col',
                            isMine ? 'items-end' : 'items-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[82%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed shadow-xs',
                              isMine
                                ? 'rounded-br-sm bg-[#2563eb] text-white'
                                : 'rounded-bl-sm border border-[var(--line)] bg-[var(--surface-1)] text-[var(--text)]'
                            )}
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {m.body}
                            </p>
                            <span
                              className={cn(
                                'mt-1 block text-right text-[9.5px]',
                                isMine ? 'text-white/75' : 'text-[var(--text-faint)]'
                              )}
                            >
                              {formatClock(m.created_at)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => setReplyingTo(m.body.slice(0, 60))}
                              title={isEn ? 'Reply' : 'Balas'}
                              className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                            >
                              <Reply className="size-3" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await navigator.clipboard.writeText(m.body);
                                toast.success(isEn ? 'Copied' : 'Pesan disalin');
                              }}
                              title={isEn ? 'Copy' : 'Salin'}
                              className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                            >
                              <Copy className="size-3" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPinnedMsg(m.body)}
                              title={isEn ? 'Pin' : 'Sematkan'}
                              className="rounded p-1 text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                            >
                              <Pin className="size-3" aria-hidden />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={listEndRef} />
                </div>

                {/* Reply bar */}
                {replyingTo && (
                  <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-[11px] text-[var(--text-muted)]">
                    <span className="truncate">
                      {isEn ? 'Replying:' : 'Membalas:'} &ldquo;{replyingTo}&rdquo;
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      aria-label={isEn ? 'Cancel reply' : 'Batal balas'}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}

                {/* Bottom Input Composer */}
                <form
                  onSubmit={handleSend}
                  className="flex shrink-0 items-center gap-2 border-t border-[var(--line)] bg-[var(--surface-1)] p-2.5"
                >
                  <input
                    id="floating-quick-chat-input"
                    name="quickChatMessage"
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={isEn ? 'Write a message...' : 'Tulis pesan...'}
                    aria-label={isEn ? 'Write a message' : 'Tulis pesan'}
                    className="h-9 min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-3.5 text-[12.5px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[#2563eb] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || sending}
                    aria-label={isEn ? 'Send message' : 'Kirim pesan'}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-4" aria-hidden />
                    )}
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* High-Contrast Floating Chat Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={isEn ? 'Quick Chat' : 'Obrolan Cepat'}
        aria-expanded={open}
        title={isEn ? 'Quick Chat' : 'Obrolan Cepat'}
        className="relative z-40 flex size-12 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-[0_8px_24px_rgba(37,99,235,0.48)] ring-2 ring-white/25 transition-transform hover:scale-105 hover:bg-[#1d4ed8] active:scale-95"
      >
        {open ? (
          <X className="size-5" aria-hidden />
        ) : (
          <MessageSquare className="size-5" aria-hidden />
        )}
        {!open && totalUnread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-[var(--bg)]">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        ) : !open ? (
          <span
            aria-hidden
            className="absolute bottom-0.5 right-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-[#2563eb]"
          />
        ) : null}
      </button>
    </div>
  );
}
