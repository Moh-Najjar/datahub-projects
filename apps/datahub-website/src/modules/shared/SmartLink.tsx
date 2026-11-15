import type { AnchorHTMLAttributes, ReactNode, Ref } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '@/i18n/LocaleContext';
import { localizePath } from '@/i18n/paths';
import type { Locale } from '@/i18n/types';

export interface SmartLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Locale-neutral internal path (`/about-us/`), external URL, `mailto:`/`tel:` or a file path. */
  href: string;
  /** Force a specific locale for internal links. */
  locale?: Locale;
  children?: ReactNode;
  ref?: Ref<HTMLAnchorElement>;
}

const isExternal = (href: string) => /^(https?:)?\/\//.test(href);
const isSpecial = (href: string) => /^(mailto:|tel:|#)/.test(href);
const isFile = (href: string) => /\.(pdf|png|jpe?g|webp|svg|zip)$/i.test(href);

/**
 * Renders a React Router `<Link>` for internal routes (with the locale prefix applied)
 * and a plain `<a>` for external URLs, files and `mailto:`/`tel:` links.
 */
export function SmartLink({ href, locale, children, ref, ...rest }: SmartLinkProps) {
  const { locale: current } = useLocale();

  if (isExternal(href) || isSpecial(href) || isFile(href)) {
    return (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <Link ref={ref} to={localizePath(href, locale ?? current)} {...rest}>
      {children}
    </Link>
  );
}
