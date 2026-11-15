import Box from '@mui/material/Box';
import { useTheme, type SxProps, type Theme } from '@mui/material/styles';
import EastIcon from '@mui/icons-material/East';
import type { ReactNode } from 'react';
import { Reveal } from '@/modules/shared/Reveal';
import { Rich } from '@/modules/shared/Rich';
import { SmartLink } from '@/modules/shared/SmartLink';
import type { Block } from '@/modules/page-blocks/types/blocks';
import { mergeSx, rsx } from '@/modules/page-blocks/utils/responsive';

type BoxBlockData = Extract<Block, { kind: 'box' }>;

/** Theme line icon (SVG) tinted with the current colour via a CSS mask. */
function MaskIcon({ src, size = 48 }: { src: string; size?: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        bgcolor: 'currentColor',
        mask: `url("${src}") center / contain no-repeat`,
        WebkitMask: `url("${src}") center / contain no-repeat`,
      }}
    />
  );
}

function Img({ block, sx }: { block: BoxBlockData; sx?: SxProps<Theme> }) {
  if (!block.image) return null;
  return (
    <Box
      component="img"
      src={block.image.src}
      alt={block.image.alt}
      width={block.image.width || undefined}
      height={block.image.height || undefined}
      loading="lazy"
      decoding="async"
      sx={mergeSx({ display: 'block', maxWidth: '100%', height: 'auto' }, sx)}
    />
  );
}

/** Box body text: sanitized HTML from the original (keeps paragraphs and bold). */
function BoxText({ block, className }: { block: BoxBlockData; className?: string }) {
  if (!block.textHtml) return null;
  return (
    <Box
      className={className}
      sx={mergeSx(
        {
          transition: 'color .3s',
          // WordPress output mixes bare text and <p>; paragraphs are separated by a top margin.
          '& p': { m: 0, mt: '1.5em' },
          // :first-of-type (not :first-child) — Emotion flags :first-child as SSR-unsafe.
          '& p:first-of-type': block.textHtml.trimStart().startsWith('<p') ? { mt: 0 } : {},
        },
        rsx(block.parts.text),
      )}
      dangerouslySetInnerHTML={{ __html: block.textHtml }}
    />
  );
}

/** Whole box as a link (`link-secret`) when it has a target and no separate button. */
function MaybeLink({ href, children, sx }: { href?: string; children: ReactNode; sx?: SxProps<Theme> }) {
  if (!href) return <Box sx={sx}>{children}</Box>;
  return (
    <Box component={SmartLink} href={href} sx={mergeSx({ display: 'block', color: 'inherit', '&:hover': { color: 'inherit' } }, sx)}>
      {children}
    </Box>
  );
}

/** "Discover now →" label. Rendered as text when the whole box is already a link (no nested <a>). */
function ArrowButton({ block, sx, asText = false }: { block: BoxBlockData; sx?: SxProps<Theme>; asText?: boolean }) {
  const { direction } = useTheme();
  if (!block.button?.label) return null;
  const content = (
    <>
      {block.button.label}
      <EastIcon aria-hidden sx={{ fontSize: 16, transform: direction === 'rtl' ? 'scaleX(-1)' : undefined }} />
    </>
  );
  const base = mergeSx({ display: 'inline-flex', alignItems: 'center', gap: '4px' }, rsx(block.parts.btnText), sx);
  return block.button.href && !asText ? (
    <Box component={SmartLink} href={block.button.href} sx={base}>
      {content}
    </Box>
  ) : (
    <Box component="span" sx={base}>
      {content}
    </Box>
  );
}

/** "tm-box-icon style-05": tinted card with a large faded icon behind the heading. */
function BoxIcon05({ block }: { block: BoxBlockData }) {
  return (
    <MaybeLink href={block.href} sx={mergeSx({ position: 'relative', isolation: 'isolate', height: '100%' }, rsx(block.style))}>
      <Box sx={mergeSx({ position: 'relative' }, rsx(block.parts.wrap))}>
        {(block.svg || block.image) && (
          <Box sx={mergeSx({ position: 'absolute', top: 4, right: -10, zIndex: -1, lineHeight: 1 }, rsx(block.parts.icon))}>
            {block.svg ? <MaskIcon src={block.svg} /> : <Img block={block} sx={{ width: 48 }} />}
          </Box>
        )}
        <Box sx={mergeSx({ display: 'flex', flexDirection: 'column' }, rsx(block.parts.content))}>
          {block.subHeading && <Box sx={rsx(block.parts.subHeading)}>{block.subHeading}</Box>}
          {block.heading && (
            <Box component="h4" sx={mergeSx({ m: 0 }, rsx(block.parts.heading))}>
              <Rich text={block.heading} />
            </Box>
          )}
          <BoxText block={block} />
        </Box>
        <ArrowButton block={block} sx={{ mt: '20px' }} asText={Boolean(block.href)} />
      </Box>
    </MaybeLink>
  );
}

/** "tm-box-image style-04": white card that lifts and turns into the brand gradient on hover. */
function BoxImage04({ block }: { block: BoxBlockData }) {
  return (
    <MaybeLink href={block.href} sx={mergeSx({ height: '100%' }, rsx(block.style))}>
      <Box
        sx={mergeSx(
          { height: '100%', transition: 'transform .3s, background .3s', borderRadius: '5px' },
          rsx(block.parts.wrap),
          {
            '&:hover': {
              transform: 'translateY(-5px)',
              backgroundImage: (t: Theme) => t.palette.brand.gradient,
              '& .bx-heading, & .bx-text, & .bx-btn': { color: 'common.white' },
            },
          },
        )}
      >
        {block.image && <Box sx={rsx(block.parts.image)}>{<Img block={block} />}</Box>}
        {block.svg && (
          <Box sx={mergeSx({ color: 'info.main' }, rsx(block.parts.icon))}>
            <MaskIcon src={block.svg} size={60} />
          </Box>
        )}
        {block.heading && (
          <Box component="h4" className="bx-heading" sx={mergeSx({ m: 0, transition: 'color .3s' }, rsx(block.parts.heading))}>
            <Rich text={block.heading} />
          </Box>
        )}
        <BoxText block={block} className="bx-text" />
        <Box className="bx-btn" sx={{ transition: 'color .3s' }}>
          <ArrowButton block={block} asText={Boolean(block.href)} />
        </Box>
      </Box>
    </MaybeLink>
  );
}

/** "tm-box-large-image style-01": image with a dark gradient and the heading over it. */
function BoxLargeImage01({ block }: { block: BoxBlockData }) {
  // The whole box is the link on the original (no separate button shown).
  return (
    <MaybeLink href={block.href ?? block.button?.href} sx={rsx(block.style)}>
      <Box
        sx={{
          position: 'relative',
          borderRadius: '5px',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            opacity: 0.5,
            backgroundImage: 'linear-gradient(-180deg, rgba(28,15,105,0), #1c0f69 61%)',
            transition: 'all .3s',
          },
          '&:hover::after': { backgroundImage: 'none', bgcolor: '#002fa6', opacity: 0.8 },
        }}
      >
        <Img block={block} sx={{ width: '100%' }} />
        {block.heading && (
          <Box sx={{ position: 'absolute', bottom: 27, left: 0, right: 0, zIndex: 1, maxWidth: 250, mx: 'auto', textAlign: 'center' }}>
            <Box component="h4" sx={mergeSx({ m: 0, color: 'common.white' }, rsx(block.parts.heading))}>
              <Rich text={block.heading} />
            </Box>
          </Box>
        )}
      </Box>
      <BoxText block={block} />
    </MaybeLink>
  );
}

/** "tm-box-large-image style-03": card with image on top and a "Learn more" bar at the bottom. */
function BoxLargeImage03({ block }: { block: BoxBlockData }) {
  const { direction } = useTheme();
  const target = block.button?.href ?? block.href;
  return (
    <Box sx={mergeSx({ height: '100%' }, rsx(block.style))}>
      <Box sx={mergeSx({ position: 'relative', height: '100%', overflow: 'hidden', borderRadius: '5px', bgcolor: 'common.white' }, rsx(block.parts.wrap))}>
        {block.image && (
          <MaybeLink href={target}>
            <Img block={block} sx={{ width: '100%', borderRadius: '5px 5px 0 0' }} />
          </MaybeLink>
        )}
        <Box sx={mergeSx({ pb: block.button ? '88px' : undefined }, rsx(block.parts.content))}>
          {block.heading && (
            <Box component="h4" sx={mergeSx({ m: 0 }, rsx(block.parts.heading))}>
              <Rich text={block.heading} />
            </Box>
          )}
          <BoxText block={block} />
        </Box>
        {block.button?.label && (
          <Box
            component={target ? SmartLink : 'span'}
            href={target ?? ''}
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              height: 56,
              overflow: 'hidden',
              borderTop: '1px solid #eee',
              color: 'brand.dark',
              fontSize: 14,
              fontWeight: 500,
              '&::before': { content: '""', position: 'absolute', inset: 0, zIndex: -1, bgcolor: 'info.main', transform: 'translateY(100%)', transition: 'transform .3s' },
              '&:hover, &:focus-visible': { color: 'common.white', '&::before': { transform: 'none' } },
            }}
          >
            {block.button.label}
            <EastIcon aria-hidden sx={{ fontSize: 16, transform: direction === 'rtl' ? 'scaleX(-1)' : undefined }} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function BoxBlock({ block }: { block: BoxBlockData }) {
  const Variant =
    block.variant === 'icon-05' ? BoxIcon05 : block.variant === 'large-image-01' ? BoxLargeImage01 : block.variant === 'large-image-03' ? BoxLargeImage03 : BoxImage04;
  return (
    <Reveal style={{ height: '100%' }}>
      <Variant block={block} />
    </Reveal>
  );
}
