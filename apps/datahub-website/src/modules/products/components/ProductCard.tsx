import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import { UI } from '@/i18n';
import { useLocale, useLocalized } from '@/i18n/LocaleContext';
import type { Product, ProductStatus } from '@/modules/products/types/product';
import { ButtonLink } from '@/modules/shared/ButtonLink';

const STATUS_KEY = {
  available: 'available',
  'in-development': 'inDevelopment',
  'coming-soon': 'comingSoon',
} as const satisfies Record<ProductStatus, string>;

/** Status colours from the theme: green = usable now, blue = being built, grey = planned. */
const STATUS_COLOR: Record<ProductStatus, string> = {
  available: 'brand.green',
  'in-development': 'primary.main',
  'coming-soon': 'brand.muted',
};

/**
 * Placeholder mark until real product artwork exists: acronyms are kept whole, other words give their
 * initial, and the shared "DataHub" prefix is skipped ("DataHub HR" → HR, "BI Custom Visuals" → BI).
 */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w && w !== 'DataHub')
    .map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w[0]!.toUpperCase()))
    .join('')
    .slice(0, 2);
}

export function ProductCard({ product }: { product: Product }) {
  const { locale } = useLocale();
  const ui = useLocalized(UI).products;
  const name = product.name[locale];

  return (
    <Card
      component="article"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: { xs: '30px 25px', md: '40px 35px' },
        borderRadius: '5px',
        boxShadow: (t) => t.customShadows.card,
        transition: 'transform .3s',
        '&:hover': { transform: 'translateY(-5px)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px', mb: '25px' }}>
        {product.logo ? (
          <Box component="img" src={product.logo.src} alt={product.logo.alt} width={product.logo.width} height={product.logo.height} sx={{ display: 'block', height: 64, width: 'auto' }} />
        ) : (
          <Box
            aria-hidden="true"
            dir="ltr"
            sx={{
              width: 64,
              height: 64,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '5px',
              background: (t) => t.palette.brand.gradient,
              color: 'common.white',
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            {initials(product.name.en)}
          </Box>
        )}
        <Box
          component="span"
          sx={{
            px: '12px',
            py: '4px',
            border: '1px solid',
            borderColor: STATUS_COLOR[product.status],
            borderRadius: '15px',
            color: STATUS_COLOR[product.status],
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.5,
            whiteSpace: 'nowrap',
          }}
        >
          {ui.status[STATUS_KEY[product.status]]}
        </Box>
      </Box>

      <Typography sx={{ color: 'brand.subtitle', fontSize: 14, fontWeight: 500, mb: '6px' }}>{product.category[locale]}</Typography>
      <Typography component="h3" sx={{ color: 'brand.heading', fontSize: 24, fontWeight: 500, lineHeight: 1.46, mb: '12px' }}>
        {name}
      </Typography>
      <Typography>{product.shortDescription[locale]}</Typography>

      {product.links && product.links.length > 0 && (
        <Box sx={{ mt: 'auto', pt: '25px', display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          {product.links.map((link) => (
            <ButtonLink key={link.href} variant="textArrow" href={link.href}>
              {link.label[locale]}
            </ButtonLink>
          ))}
        </Box>
      )}
    </Card>
  );
}
