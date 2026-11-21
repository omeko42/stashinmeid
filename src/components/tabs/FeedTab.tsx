'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Newspaper, SendHorizonal } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

interface Post {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: { id: string; client_name: string; avatar_url: string | null };
}

/**
 * Feed postingan - semacam status sosial, v1 terbuka antar pengguna.
 * Composer di atas, daftar postingan terbaru di bawah (polling ringan).
 */
export function FeedTab() {
  const t = useTranslations('sosial');

  const [posts, setPosts] = useState<Post[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/social/posts', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) {
        setPosts(json.posts ?? []);
        setMeId(json.meId ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  const post = async () => {
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const res = await fetch('/api/social/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json();
      if (res.ok) {
        setPosts((prev) => [json.post, ...prev]);
        setBody('');
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Composer */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              post();
            }
          }}
          rows={3}
          maxLength={2000}
          placeholder={t('feedComposerPlaceholder')}
          className="w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[13px] outline-none placeholder:text-[var(--text-faint)]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="tnum text-[11px] text-[var(--text-faint)]">
            {body.length}/2000
          </span>
          <Button size="sm" onClick={post} loading={posting} disabled={!body.trim()}>
            <SendHorizonal className="size-4" />
            {t('postSend')}
          </Button>
        </div>
      </div>

      {/* Daftar postingan */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-[var(--text-faint)]" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="size-8 text-[var(--text-faint)]" />}
          title={t('feedEmptyTitle')}
          description={t('feedEmptyDesc')}
        />
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <article
              key={p.id}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-2)] text-[13px] font-semibold text-[var(--text-muted)]">
                  {p.author.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.author.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    p.author.client_name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold">
                      {p.author.client_name}
                    </span>
                    {p.authorId === meId && (
                      <span className="rounded-full border border-[var(--line)] px-1.5 py-px text-[10px] text-[var(--text-muted)]">
                        {t('you')}
                      </span>
                    )}
                  </span>
                  <span className="block text-[11px] text-[var(--text-faint)]">
                    {new Date(p.createdAt).toLocaleString([], {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
              </div>
              <p className={cn('mt-2.5 whitespace-pre-wrap break-words text-[13px]')}>
                {p.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
