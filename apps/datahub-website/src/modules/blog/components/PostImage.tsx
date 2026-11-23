import { useState } from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';

interface PostImageProps {
  src: string | null;
  alt: string;
  width: number;
  height: number;
  /** Rounded corners, e.g. `5px` or `5px 5px 0 0`. */
  radius: string;
  loading?: 'lazy' | 'eager';
  sx?: SxProps<Theme>;
}

/**
 * A post's image at a fixed ratio. When the post has no image (or it fails to load), a neutral brand-coloured panel
 * keeps the card layout intact — decorative only, so it is hidden from assistive technology and shows no invented
 * content.
 */
export function PostImage({ src, alt, width, height, radius, loading = 'lazy', sx }: PostImageProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const ratio = `${width} / ${height}`;
  if (!src || failed === src) {
    return (
      <Box
        aria-hidden="true"
        data-testid="post-image-placeholder"
        sx={[
          { display: 'block', width: '100%', aspectRatio: ratio, borderRadius: radius, background: 'linear-gradient(135deg, #eef3fb 0%, #e3eef0 100%)', position: 'relative', overflow: 'hidden' },
          { '&::after': { content: '""', position: 'absolute', insetInlineStart: 0, bottom: 0, width: '100%', height: 4, background: 'linear-gradient(90deg, #36a829, #00469b)', opacity: 0.6 } },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      />
    );
  }
  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      onError={() => setFailed(src)}
      sx={[{ display: 'block', width: '100%', height: 'auto', aspectRatio: ratio, objectFit: 'cover', borderRadius: radius }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    />
  );
}
