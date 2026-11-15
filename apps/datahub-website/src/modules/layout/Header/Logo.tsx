import { SmartLink } from '@/shared/components/ui/SmartLink';
import { useLocalized } from '@/i18n/LocaleContext';
import { UI } from '@/i18n/ui';
import { ROUTES } from '@/shared/config/routes';

interface LogoProps {
  variant?: 'dark' | 'white';
  className?: string;
  /** Render without a link (e.g. inside the footer). */
  linked?: boolean;
}

const SOURCES = {
  dark: { src: '/assets/logos/datahub-logo.png', retina: '/assets/logos/datahub-logo@2x.png', width: 250, height: 46 },
  white: { src: '/assets/logos/datahub-logo-white.png', retina: '/assets/logos/datahub-logo-white@2x.png', width: 160, height: 24 },
} as const;

export function Logo({ variant = 'dark', className, linked = true }: LogoProps) {
  const ui = useLocalized(UI);
  const s = SOURCES[variant];
  const img = (
    <img
      className={className}
      src={s.src}
      srcSet={`${s.src} 1x, ${s.retina} 2x`}
      width={s.width}
      height={s.height}
      alt={ui.siteName}
      decoding="async"
    />
  );
  if (!linked) return img;
  return (
    <SmartLink href={ROUTES.home} rel="home" aria-label={ui.siteName}>
      {img}
    </SmartLink>
  );
}
