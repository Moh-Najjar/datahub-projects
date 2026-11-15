import Box from '@mui/material/Box';
import type { Product } from '@/modules/products/types/product';
import { Reveal } from '@/modules/shared/Reveal';
import { ProductCard } from './ProductCard';

/** Responsive catalogue grid (1 / 2 / 3 columns, same rhythm as the blog grid). */
export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <Box
      component="ul"
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
        columnGap: { xs: '30px', lg: '50px' },
        rowGap: { xs: '30px', lg: '50px' },
      }}
    >
      {products.map((product, i) => (
        <Reveal key={product.id} as="li" delay={(i % 3) * 0.08}>
          <ProductCard product={product} />
        </Reveal>
      ))}
    </Box>
  );
}
