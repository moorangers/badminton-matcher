'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { listPosts, type ApiPost } from '@/lib/api/postsApi';

const formatDateTime = (iso: string | null) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export default function BoardPage() {
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await listPosts();
        setPosts(result.posts);
        setNextCursor(result.nextCursor);
      } catch {
        setError('โหลดกระดานข่าวไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const result = await listPosts(nextCursor);
      setPosts((prev) => [...prev, ...result.posts]);
      setNextCursor(result.nextCursor);
    } catch {
      setError('โหลดเพิ่มไม่สำเร็จ');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-surface pb-16">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
            aria-label="กลับหน้าหลัก"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-dark">
              <Icon
                icon="mdi:badminton"
                width="20"
                height="20"
                className="text-primary"
              />
            </div>
            <div>
              <h1 className="font-display text-base font-extrabold leading-tight text-foreground">
                กระดานข่าว
              </h1>
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Badminton Matcher
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-4 px-3 py-4 sm:px-6 sm:py-8">
        {loading && (
          <div className="flex justify-center py-10">
            <Icon
              icon="mdi:badminton"
              width="28"
              height="28"
              className="animate-shuttle text-primary"
            />
          </div>
        )}

        {!loading && error && (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && posts.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border bg-muted/40 py-10 text-center text-sm text-muted-foreground">
            ยังไม่มีโพสต์
          </p>
        )}

        {posts.map((post) => (
          <article
            key={post.id}
            className="rounded-3xl border border-border bg-card p-5 shadow-soft"
          >
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {post.text}
            </p>
            {post.photoUrls.length > 0 && (
              <div
                className={`mt-3 grid gap-2 ${post.photoUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}
              >
                {post.photoUrls.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="w-full rounded-xl border border-border object-cover"
                  />
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {formatDateTime(post.createdAt)}
            </p>
          </article>
        ))}

        {nextCursor && (
          <Button
            type="button"
            variant="outline"
            disabled={loadingMore}
            onClick={loadMore}
            className="w-full rounded-2xl"
          >
            {loadingMore ? 'กำลังโหลด...' : 'โหลดเพิ่ม'}
          </Button>
        )}
      </main>
    </div>
  );
}
