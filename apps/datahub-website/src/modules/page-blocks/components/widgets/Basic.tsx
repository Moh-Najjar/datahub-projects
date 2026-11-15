import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { useTheme, type SxProps, type Theme } from '@mui/material/styles';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import EastIcon from '@mui/icons-material/East';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { Reveal } from '@/shared/components/ui/Reveal';
import { Rich } from '@/shared/components/ui/Rich';
import { SmartLink } from '@/shared/components/ui/SmartLink';
import type { Block, ButtonData } from '@/features/page-blocks/types/blocks';
import { mergeSx, rsx } from '@/features/page-blocks/utils/responsive';

type BlockOf<K extends Block['kind']> = Extract<Block, { kind: K }>;

export function SpacerBlock({ block }: { block: BlockOf<'spacer'> }) {
  return <Box aria-hidden sx={rsx(block.height)} />;
}

export function HeadingBlock({ block }: { block: BlockOf<'heading'> }) {
  const style = rsx(block.style);
  const centred = block.style.xl.textAlign === 'center';
  const content = <Rich text={block.text} />;
  return (
    <Reveal>
      {/* Wrapper alignment positions inline-block headings (e.g. underlined headings). */}
      <Box sx={{ textAlign: block.style.xl.textAlign === 'right' ? 'right' : centred ? 'center' : undefined }}>
      <Box
        component={block.tag as 'h2'}
        className="heading"
        sx={mergeSx(
          { m: 0, fontFamily: 'inherit', overflowWrap: 'break-word' },
          style,
          centred && { mx: 'auto' },
          block.markStyle && { '& mark': rsx(block.markStyle) },
        )}
      >
        {block.link ? (
          <Box component={SmartLink} href={block.link} sx={{ color: 'inherit' }}>
            {content}
          </Box>
        ) : (
          content
        )}
      </Box>
      </Box>
    </Reveal>
  );
}

/** Rich text column (`wpb_text_column`) — sanitized HTML from the original. */
export function TextBlock({ block }: { block: BlockOf<'text'> }) {
  return (
    <Reveal>
      <Box
        className="text-block"
        sx={{
          '& p, & li': rsx(block.style),
          '& ul': { listStyle: 'disc', pl: '20px', mb: '1em' },
          '& ol': { listStyle: 'decimal', pl: '20px', mb: '1em' },
          '& p:last-child': { mb: 0 },
          '& a': { color: 'info.main' },
          '& strong': { color: 'brand.heading' },
          '& img': { maxWidth: '100%', height: 'auto' },
        }}
        dangerouslySetInnerHTML={{ __html: block.html }}
      />
    </Reveal>
  );
}

const ICONS = {
  arrow: EastIcon,
  phone: PhoneOutlinedIcon,
  map: PlaceOutlinedIcon,
  download: DownloadOutlinedIcon,
} as const;

/** Theme button (flat / text / gradient) with the original's measured look. */
export function ThemeButton({ button, sx }: { button: ButtonData; sx?: SxProps<Theme> }) {
  const { direction } = useTheme();
  const Icon = button.icon ? ICONS[button.icon] : null;
  const icon: ReactNode = Icon ? (
    <Icon sx={{ fontSize: '1.15em', transform: button.icon === 'arrow' && direction === 'rtl' ? 'scaleX(-1)' : undefined }} />
  ) : null;
  const hover =
    button.variant === 'text'
      ? { color: 'info.main' }
      : button.variant === 'gradient'
        ? { backgroundPosition: '100% 0', color: 'common.white' }
        : { color: 'common.white', bgcolor: 'brand.dark', borderColor: 'brand.dark' };

  return (
    <Box
      component={button.href ? SmartLink : 'span'}
      href={button.href ?? ''}
      target={button.newTab ? '_blank' : undefined}
      rel={button.newTab ? 'noopener noreferrer' : undefined}
      sx={mergeSx(
        {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          whiteSpace: 'nowrap',
          transition: 'all .3s cubic-bezier(.645,.045,.355,1)',
          backgroundSize: button.variant === 'gradient' ? '200% 100%' : undefined,
        },
        rsx(button.style),
        sx,
        { '&:hover, &:focus-visible': hover },
      )}
    >
      {button.iconPosition === 'left' && icon}
      <span>{button.label}</span>
      {button.iconPosition !== 'left' && icon}
    </Box>
  );
}

export function ButtonsBlock({ block }: { block: BlockOf<'buttons'> }) {
  const justify = block.align === 'center' ? 'center' : block.align === 'right' || block.align === 'end' ? 'flex-end' : 'flex-start';
  return (
    <Reveal>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: justify }}>
        {block.buttons.map((b, i) => (
          <ThemeButton key={`${b.label}-${i}`} button={b} />
        ))}
      </Box>
    </Reveal>
  );
}

export function ImageBlock({ block }: { block: BlockOf<'image'> }) {
  const img = (
    <Box
      component="img"
      src={block.image.src}
      alt={block.image.alt}
      width={block.image.width || undefined}
      height={block.image.height || undefined}
      loading="lazy"
      decoding="async"
      sx={mergeSx({ display: 'inline-block', maxWidth: '100%', height: 'auto', verticalAlign: 'middle' }, rsx(block.imageStyle))}
    />
  );
  return (
    <Reveal>
      <Box sx={mergeSx(rsx(block.style), { lineHeight: 0 })}>{block.href ? <SmartLink href={block.href}>{img}</SmartLink> : img}</Box>
    </Reveal>
  );
}

export function SeparatorBlock({ block }: { block: BlockOf<'separator'> }) {
  return <Box component="hr" sx={mergeSx({ m: 0, border: 0 }, rsx(block.style))} />;
}

export function HtmlBlock({ block }: { block: BlockOf<'html'> }) {
  return <Box sx={rsx(block.style)} dangerouslySetInnerHTML={{ __html: block.html }} />;
}
