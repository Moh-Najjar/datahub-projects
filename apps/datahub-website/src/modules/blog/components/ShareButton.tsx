import { useEffect, useId, useState } from 'react';
import Box from '@mui/material/Box';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Typography from '@mui/material/Typography';
import FacebookIcon from '@mui/icons-material/Facebook';
import ShareIcon from '@mui/icons-material/Share';
import TwitterIcon from '@mui/icons-material/Twitter';
import { LinkedInIcon } from '@/modules/shared/LinkedInIcon';

/**
 * "Share this post" as on the original: a round blue button; clicking it opens a small white bubble above it (with an
 * arrow) holding Twitter, Facebook and LinkedIn share links. Escape or a click elsewhere closes it.
 */
export function ShareButton({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    {
      label: 'Twitter',
      href: `https://twitter.com/share?text=${t}&url=${u}`,
      Icon: TwitterIcon,
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer.php?u=${u}`,
      Icon: FacebookIcon,
    },
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/shareArticle?mini=true&url=${u}&title=${t}`,
      Icon: LinkedInIcon,
    },
  ];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', ml: 'auto' }}>
      <Typography sx={{ fontSize: 15, fontWeight: 500 }}>Share this post</Typography>
      <ClickAwayListener onClickAway={() => setOpen(false)}>
        <Box sx={{ position: 'relative', width: 56, height: 56 }}>
          <Box
            component="button"
            type="button"
            aria-label="Share this post"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((v) => !v)}
            sx={{
              width: 56,
              height: 56,
              display: 'grid',
              placeItems: 'center',
              p: 0,
              border: 0,
              borderRadius: '50%',
              bgcolor: 'brand.dark',
              color: 'common.white',
              cursor: 'pointer',
            }}
          >
            <ShareIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box
            id={listId}
            role="list"
            aria-label="Share on"
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: '100%',
              zIndex: 999,
              display: 'flex',
              // Absolutely positioned at 50%: without this the bubble shrinks to the space on its right.
              width: 'max-content',
              px: '4px',
              bgcolor: 'common.white',
              borderRadius: '5px',
              boxShadow: '0 2px 20px rgba(0, 0, 0, 0.06)',
              opacity: open ? 1 : 0,
              visibility: open ? 'visible' : 'hidden',
              transform: `translate(-50%, ${open ? -22 : -12}px)`,
              transition: 'all .3s cubic-bezier(0.645, 0.045, 0.355, 1)',
              // The arrow under the bubble.
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                borderStyle: 'solid',
                borderWidth: '8px 9px 0',
                borderColor: 'white transparent transparent',
              },
            }}
          >
            {links.map(({ label, href, Icon }) => (
              <Box key={label} role="listitem">
                <Box
                  component="a"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Share on ${label}`}
                  title={label}
                  tabIndex={open ? 0 : -1}
                  sx={{
                    display: 'grid',
                    placeItems: 'center',
                    p: '12px',
                    color: '#ababab',
                    '&:hover, &:focus-visible': { color: 'brand.dark' },
                  }}
                >
                  <Icon sx={{ fontSize: 15 }} />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </ClickAwayListener>
    </Box>
  );
}
