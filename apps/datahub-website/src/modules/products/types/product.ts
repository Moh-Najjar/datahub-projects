import type { ImageAsset } from '@/core/types/content';
import type { Localized } from '@/i18n/languages';

/**
 * Lifecycle stage shown on the product card. Only `available` products may be presented as usable;
 * the others must not claim features that do not exist yet.
 */
export type ProductStatus = 'available' | 'in-development' | 'coming-soon';

/** A real destination (store page, product site, documentation). Never add a placeholder URL. */
export interface ProductLink {
  label: Localized<string>;
  href: string;
}

/**
 * A DataHub product in the catalogue. Shaped like the future API response, so the mock data
 * can be replaced by a backend without touching the UI.
 *
 * Administrative portals (e.g. the DataHub HR Admin Portal) are not products and are not modelled here.
 */
export interface Product {
  id: string;
  /** URL-safe identifier, reserved for a future product detail page. */
  slug: string;
  name: Localized<string>;
  category: Localized<string>;
  /** One or two sentences, shown on the card. */
  shortDescription: Localized<string>;
  /** Longer text, reserved for a future product detail page. */
  description: Localized<string>;
  /** Real product artwork, when it exists. Cards show an initials badge until then. */
  logo?: ImageAsset;
  image?: ImageAsset;
  status: ProductStatus;
  /** Ascending sort order in the catalogue. */
  displayOrder: number;
  links?: ProductLink[];
}
