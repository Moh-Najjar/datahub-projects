import { useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import { keyframes } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useLocalized } from '@/i18n/LocaleContext';
import { UI } from '@/i18n/ui';
import type { ImageAsset } from '@/shared/types/content';

const pulse = keyframes`
  0% { transform: translate(-50%, -50%) scale(.3); opacity: 0; }
  40% { opacity: .5; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
`;

interface VideoPosterProps {
  poster: ImageAsset;
  /** YouTube video id. */
  videoId: string;
}

/**
 * Poster image with a pulsing play button ("tm-popup-video style-poster-02").
 * Opens the YouTube video in a modal dialog instead of leaving the page.
 */
export function VideoPoster({ poster, videoId }: VideoPosterProps) {
  const ui = useLocalized(UI);
  const [open, setOpen] = useState(false);

  return (
    <>
      <ButtonBase
        onClick={() => setOpen(true)}
        aria-label={ui.playVideo}
        sx={{
          position: 'relative',
          display: 'block',
          width: '100%',
          overflow: 'hidden',
          borderRadius: '5px',
          boxShadow: '0 2px 20px rgba(0,0,0,.15)',
          '&:hover .play': { transform: 'translate(-50%, -50%) scale(1.1)' },
        }}
      >
        <Box
          component="img"
          src={poster.src}
          alt={poster.alt}
          width={poster.width}
          height={poster.height}
          loading="lazy"
          decoding="async"
          sx={{ width: '100%', height: 'auto' }}
        />
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            '&::before, &::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: 200,
              height: 200,
              borderRadius: '50%',
              border: (t) => `3px solid ${t.palette.info.main}`,
              opacity: 0,
              animation: `${pulse} 3s linear infinite`,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            },
            '&::after': { animationDelay: '.75s' },
          }}
        />
        <Box
          className="play"
          aria-hidden
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 78,
            height: 78,
            borderRadius: '50%',
            color: 'common.white',
            bgcolor: 'info.main',
            transform: 'translate(-50%, -50%)',
            transition: 'transform .3s',
          }}
        >
          <PlayArrowIcon sx={{ fontSize: 30 }} />
        </Box>
      </ButtonBase>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="lg"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: 'common.black', overflow: 'visible' } }, backdrop: { sx: { bgcolor: 'rgba(0,0,0,.85)' } } }}
      >
        <IconButton
          onClick={() => setOpen(false)}
          aria-label={ui.closeVideo}
          sx={{ position: 'absolute', top: -48, right: 0, color: 'common.white' }}
        >
          <CloseIcon />
        </IconButton>
        {open && (
          <Box
            component="iframe"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={poster.alt}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            sx={{ display: 'block', width: '100%', aspectRatio: '16 / 9', border: 0 }}
          />
        )}
      </Dialog>
    </>
  );
}
