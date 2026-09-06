import { upload } from '@vercel/blob/client';

export interface ApiPost {
  id: string;
  text: string;
  photoUrls: string[];
  createdAt: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data.error === 'string'
        ? data.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

export const listPosts = (cursor?: string | null) =>
  request<{ posts: ApiPost[]; nextCursor: string | null }>(
    `/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
  );

export const createPost = (input: {
  text: string;
  photoUrls: string[];
  sessionId?: string;
}) =>
  request<ApiPost>('/posts', { method: 'POST', body: JSON.stringify(input) });

export const deletePost = (postId: string) =>
  request<{ ok: true }>(`/posts/${postId}`, { method: 'DELETE' });

/** Uploads a photo directly from the browser to Vercel Blob storage
 * (bypasses our server for the file bytes themselves — avoids serverless
 * request body size limits for large phone photos) and returns its
 * public URL to attach to a post. */
export const uploadPostPhoto = async (file: File): Promise<string> => {
  const blob = await upload(file.name, file, {
    access: 'public',
    handleUploadUrl: '/api/posts/upload',
  });
  return blob.url;
};
