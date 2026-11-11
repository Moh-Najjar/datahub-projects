/**
 * Rich text used for headings that contain highlighted words.
 * The original wraps them in `<mark>` (e.g. "<mark>Crafting Success</mark> through Expertise").
 */
export type RichText = string | ReadonlyArray<string | { mark: string }>;

export interface ImageAsset {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface LinkAction {
  label: string;
  href: string;
}
