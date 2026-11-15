import { useEffect, useState } from 'react';
import { getProducts } from '@/modules/products/api/productsApi';
import type { Product } from '@/modules/products/types/product';

interface ProductsState {
  products: Product[];
  isLoading: boolean;
  error: Error | null;
}

/** One request shared by every caller (remounts, StrictMode); cleared on failure so a later mount retries. */
let request: Promise<Product[]> | undefined;
/** Last successful result, so remounts render immediately without a loading flash. */
let cached: Product[] | undefined;

function loadProducts(): Promise<Product[]> {
  request ??= getProducts().then(
    (products) => {
      cached = products;
      return products;
    },
    (error: unknown) => {
      request = undefined;
      throw error instanceof Error ? error : new Error(String(error));
    },
  );
  return request;
}

/** The product catalogue with its loading and error state. */
export function useProducts(): ProductsState {
  const [state, setState] = useState<ProductsState>(() =>
    cached ? { products: cached, isLoading: false, error: null } : { products: [], isLoading: true, error: null },
  );

  useEffect(() => {
    if (cached) return;
    let active = true;
    loadProducts().then(
      (products) => active && setState({ products, isLoading: false, error: null }),
      (error: Error) => active && setState({ products: [], isLoading: false, error }),
    );
    return () => {
      active = false;
    };
  }, []);

  return state;
}
