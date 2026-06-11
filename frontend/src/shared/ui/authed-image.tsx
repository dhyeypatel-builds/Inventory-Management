import { useEffect, useState } from 'react';
import { api } from '@/shared/api/client';
import { API_BASE_URL } from '@/shared/api/env';

/**
 * Renders an image served by an authenticated API route (e.g. tenant logos at
 * /api/v1/uploads/...). A plain <img> can't send the Bearer header, so this
 * fetches the bytes through the axios client and shows them via an object URL.
 */
export function AuthedImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setObjectUrl(null);

    // logo_url is stored with the /api/v1 prefix; the client baseURL adds it back.
    const path = src.startsWith(API_BASE_URL) ? src.slice(API_BASE_URL.length) : src;
    api
      .get<Blob>(path, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        url = URL.createObjectURL(res.data);
        setObjectUrl(url);
      })
      .catch(() => {
        // Missing/forbidden image — render nothing rather than a broken icon.
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [src]);

  if (!objectUrl) return null;
  return <img src={objectUrl} alt={alt} className={className} />;
}
