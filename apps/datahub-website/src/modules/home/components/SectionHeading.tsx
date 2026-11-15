import Box, { type BoxProps } from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ElementType } from 'react';
import type { RichText } from '@/shared/types/content';
import { Reveal } from '@/shared/components/ui/Reveal';
import { Rich } from '@/shared/components/ui/Rich';

interface SectionHeadingProps extends Omit<BoxProps, 'title'> {
  /** Small uppercase label above the heading ("OUR SOLUTIONS & SERVICES"). */
  label?: string;
  labelComponent?: ElementType;
  title?: RichText;
  titleComponent?: ElementType;
  /** Title font size (px) at desktop; scaled down on small screens like the original. */
  titleSize?: number;
  /** Line height of the title (the original varies it per heading). */
  titleLineHeight?: number;
  /** Space between label and title in px. */
  titleGap?: number;
  align?: 'left' | 'center';
}

/**
 * The original's "tm-heading" pair: an 18px uppercase grey label followed by a large
 * heading whose highlighted words are wrapped in `<mark>`.
 */
export function SectionHeading({
  label,
  labelComponent = 'h3',
  title,
  titleComponent = 'h3',
  titleSize = 40,
  titleLineHeight = 1.4,
  titleGap = 0,
  align = 'left',
  sx,
  ...rest
}: SectionHeadingProps) {
  return (
    <Box sx={[{ textAlign: align }, ...(Array.isArray(sx) ? sx : [sx])]} {...rest}>
      {label && (
        <Reveal>
          <Typography
            component={labelComponent}
            sx={{ color: 'brand.subtitle', fontSize: 18, lineHeight: 1.43, textTransform: 'uppercase' }}
          >
            {label}
          </Typography>
        </Reveal>
      )}
      {title && (
        <Reveal>
          <Typography
            component={titleComponent}
            sx={{
              mt: label ? `${titleGap}px` : 0,
              color: 'brand.heading',
              fontSize: { xs: Math.round(titleSize * 0.7), md: Math.round(titleSize * 0.85), xl: titleSize },
              lineHeight: titleLineHeight,
            }}
          >
            <Rich text={title} />
          </Typography>
        </Reveal>
      )}
    </Box>
  );
}
