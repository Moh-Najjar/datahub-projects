import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { ROUTES } from '@/core/routes/paths';
import { UI } from '@/i18n';
import { useLocalized } from '@/i18n/LocaleContext';
import { ProductGrid } from '@/modules/products/components/ProductGrid';
import { useProducts } from '@/modules/products/hooks/useProducts';
import { PageSeo } from '@/modules/shared/PageSeo';
import { PageTitleBar } from '@/modules/shared/PageTitleBar';

/** Product catalogue: everything DataHub builds, read through the products API (never the mock data directly). */
export default function ProductsPage() {
  const ui = useLocalized(UI).products;
  const { products, isLoading, error } = useProducts();

  return (
    <>
      <PageSeo routeKey="products" />
      <PageTitleBar data={{ title: ui.title, crumbs: [{ label: ui.breadcrumbHome, href: ROUTES.home }, { label: ui.title }] }} />

      <Box component="section" sx={{ py: { xs: '80px', lg: '120px' } }}>
        <Container>
          <Box sx={{ maxWidth: 770, mx: 'auto', mb: { xs: '50px', lg: '70px' }, textAlign: 'center' }}>
            <Typography variant="h2" sx={{ color: 'brand.heading', mb: '20px' }}>
              {ui.introHeading}
            </Typography>
            <Typography>{ui.introText}</Typography>
          </Box>

          {isLoading ? (
            <Box role="status" aria-label={ui.loading} sx={{ display: 'flex', justifyContent: 'center', py: '40px' }}>
              <CircularProgress size={28} thickness={3} />
            </Box>
          ) : error ? (
            <Typography role="alert" sx={{ textAlign: 'center', color: 'brand.heading' }}>
              {ui.error}
            </Typography>
          ) : (
            <ProductGrid products={products} />
          )}
        </Container>
      </Box>
    </>
  );
}
