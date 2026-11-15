import { useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import PlaceIcon from '@mui/icons-material/Place';
import { VideoPoster } from '@/modules/shared/VideoPoster';
import { AppointmentForm } from '@/modules/contact';
import { useLocalized } from '@/i18n/LocaleContext';
import { UI } from '@/i18n';
import type { Block } from '@/modules/page-blocks/types/blocks';
import { youtubeId } from '@/modules/page-blocks/utils/responsive';

type BlockOf<K extends Block['kind']> = Extract<Block, { kind: K }>;

export function VideoBlock({ block }: { block: BlockOf<'video'> }) {
  const id = youtubeId(block.videoUrl);
  if (!id) return null;
  return <VideoPoster poster={block.poster} videoId={id} />;
}

/** Contact page form: same form component as the footer, with the original's own labels and message field. */
export function ContactFormBlock({ block }: { block: BlockOf<'contactForm'> }) {
  return (
    <AppointmentForm
      withMessage
      showHeader={false}
      messagePlaceholder={block.messagePlaceholder}
      submitAlign="start"
      overrides={{
        name: block.namePlaceholder,
        email: block.emailPlaceholder,
        inquiry: block.inquiryPlaceholder,
        inquiryOptions: block.inquiryOptions,
        submit: block.submitLabel,
      }}
    />
  );
}

/** "tm-popup-map style-01": round map-pin button opening the original Google Maps embed in a dialog. */
export function MapBlock({ block }: { block: BlockOf<'map'> }) {
  const ui = useLocalized(UI);
  const [open, setOpen] = useState(false);
  if (!block.embedUrl) return null;
  return (
    <>
      <ButtonBase
        onClick={() => setOpen(true)}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: '18px', color: 'brand.dark', fontSize: 15, '&:hover .pin': { bgcolor: 'brand.dark', color: 'common.white' } }}
      >
        <Box className="pin" sx={{ display: 'grid', placeItems: 'center', width: 56, height: 56, borderRadius: '50%', bgcolor: '#f6f2ed', color: 'brand.dark', transition: 'all .3s' }}>
          <PlaceIcon sx={{ fontSize: 22 }} />
        </Box>
        {block.label}
      </ButtonBase>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth aria-label={block.label}>
        <IconButton onClick={() => setOpen(false)} aria-label={ui.closeVideo} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: 'common.white', '&:hover': { bgcolor: 'common.white' } }}>
          <CloseIcon />
        </IconButton>
        {open && (
          <Box
            component="iframe"
            title={block.label}
            src={block.embedUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            sx={{ display: 'block', width: '100%', height: { xs: 360, md: 480 }, border: 0 }}
          />
        )}
      </Dialog>
    </>
  );
}
