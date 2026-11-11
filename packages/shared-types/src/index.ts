/**
 * @datahub/shared-types — platform-independent TypeScript types shared by DataHub applications.
 * Types only: this package has no runtime code.
 */

/* ---------------------------------------------------------------- locales */

/** Languages supported across DataHub applications. */
export type Locale = 'en' | 'ar';

/** Text direction. Arabic is right-to-left. */
export type Direction = 'ltr' | 'rtl';

/** A value provided for every supported locale. */
export type Localized<T> = Record<Locale, T>;

/* ------------------------------------------------------------- identifiers */

/** Opaque entity identifier as returned by an API. */
export type Id = string;

/** ISO-8601 date or date-time string (e.g. `2026-11-11` or `2026-11-11T10:21:42Z`). */
export type ISODateString = string;

/* ---------------------------------------------------------------- helpers */

/** Value that may be explicitly absent. */
export type Nullable<T> = T | null;

/** Read-only array/record shortcut for immutable data. */
export type ReadonlyRecord<K extends PropertyKey, V> = Readonly<Record<K, V>>;

/** Element type of an array type. */
export type ArrayElement<A> = A extends ReadonlyArray<infer E> ? E : never;
