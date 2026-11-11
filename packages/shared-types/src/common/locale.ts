/** Languages supported by DataHub applications. */
export type Locale = 'en' | 'ar';

/** Text direction. Arabic is right-to-left. */
export type Direction = 'ltr' | 'rtl';

/** A value provided for every supported locale. */
export type Localized<T> = Record<Locale, T>;
