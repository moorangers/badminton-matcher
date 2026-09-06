'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import { ArrowLeft, ImagePlus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  createPost,
  deletePost,
  listPosts,
  uploadPostPhoto,
  type ApiPost,
} from '@/lib/api/postsApi';

const MAX_POST_PHOTOS = 6;

const formatDateTime = (iso: string | null) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง';
};

export default function BoardPage() {
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [postText, setPostText] = useState('');
  const [postPhotoFiles, setPostPhotoFiles] = useState<File[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const postFileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDeletePostId, setPendingDeletePostId] = useState<string | null>(
    null,
  );

  const refreshPosts = async () => {
    try {
      const result = await listPosts();
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
    } catch {
      setError('โหลดกระดานข่าวไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPosts();
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

  const addPostPhotoFiles = (files: FileList | null) => {
    if (!files) return;
    setPostPhotoFiles((prev) =>
      [...prev, ...Array.from(files)].slice(0, MAX_POST_PHOTOS),
    );
    if (postFileInputRef.current) postFileInputRef.current.value = '';
  };

  const removePostPhotoFile = (index: number) => {
    setPostPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submitPost = async () => {
    const trimmed = postText.trim();
    if (!trimmed && postPhotoFiles.length === 0) return;

    setIsPosting(true);
    try {
      const photoUrls = await Promise.all(
        postPhotoFiles.map((file) => uploadPostPhoto(file)),
      );
      await createPost({ text: trimmed, photoUrls });
      setPostText('');
      setPostPhotoFiles([]);
      await refreshPosts();
      toast.success('โพสต์แล้ว');
    } catch (postError) {
      toast.error('โพสต์ไม่สำเร็จ', {
        description: getErrorMessage(postError),
      });
    } finally {
      setIsPosting(false);
    }
  };

  const requestDeletePost = (postId: string) => setPendingDeletePostId(postId);

  const confirmDeletePost = async () => {
    const postId = pendingDeletePostId;
    if (!postId) return;
    setPendingDeletePostId(null);

    try {
      await deletePost(postId);
      await refreshPosts();
      toast.success('ลบโพสต์แล้ว');
    } catch (deleteError) {
      toast.error('ลบโพสต์ไม่สำเร็จ', {
        description: getErrorMessage(deleteError),
      });
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-surface pb-16">
      {pendingDeletePostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-dark">
            <h3 className="font-display text-lg font-extrabold text-foreground">
              ยืนยันลบโพสต์
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              ลบแล้วกู้คืนไม่ได้ รูปที่แนบไว้จะถูกลบออกจากที่เก็บด้วย
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPendingDeletePostId(null)}
                className="rounded-xl"
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                onClick={confirmDeletePost}
                className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                ลบโพสต์
              </Button>
            </div>
          </div>
        </div>
      )}

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
        <section className="rounded-3xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <div className="space-y-2">
            <textarea
              value={postText}
              onChange={(event) => setPostText(event.target.value)}
              placeholder="วันนี้มากี่คน มีอะไรอัปเดตบ้าง..."
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />

            {postPhotoFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {postPhotoFiles.map((file, index) => (
                  <span
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {file.name}
                    <button
                      type="button"
                      onClick={() => removePostPhotoFile(index)}
                      aria-label={`ลบรูป ${file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <input
                ref={postFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => addPostPhotoFiles(event.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => postFileInputRef.current?.click()}
                disabled={postPhotoFiles.length >= MAX_POST_PHOTOS}
                className="h-9 rounded-xl text-xs font-bold"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                แนบรูป
              </Button>
              <Button
                type="button"
                onClick={submitPost}
                disabled={
                  isPosting || (!postText.trim() && postPhotoFiles.length === 0)
                }
                className="h-9 rounded-xl bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                {isPosting ? 'กำลังโพสต์...' : 'โพสต์'}
              </Button>
            </div>
          </div>
        </section>

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
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {post.text}
              </p>
              <button
                type="button"
                onClick={() => requestDeletePost(post.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="ลบโพสต์"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
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
