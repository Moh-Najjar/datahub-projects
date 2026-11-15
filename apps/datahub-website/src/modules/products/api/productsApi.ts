import { MOCK_PRODUCTS } from '@/modules/products/data/mockProducts';
import type { Product } from '@/modules/products/types/product';

/*
 * Products API. This is the only file that knows where product data comes from — today the mock
 * catalogue, later a backend. To switch, replace the bodies below with HTTP calls that return the
 * same `Product` shapes; hooks and components stay unchanged.
 */

/** All products, ordered for display. */
export async function getProducts(): Promise<Product[]> {
  return [...MOCK_PRODUCTS].sort((a, b) => a.displayOrder - b.displayOrder);
}

/** One product by its slug, or `undefined` if there is none. */
export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  return MOCK_PRODUCTS.find((p) => p.slug === slug);
}
