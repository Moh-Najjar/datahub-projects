import type { Localized } from '@/i18n/languages';

export interface Office {
  /** Bold label before the address ("Jordan Office:"); the Arabic footer has none. */
  label?: string;
  address: string;
  phone: string;
  phoneHref: string;
}

export const CONTACT_EMAIL = 'info@datahubanalytics.com';

export const PRIMARY_PHONE = {
  display: '(+962) 78 1005100',
  // Verbatim from the original markup.
  href: 'tel:+9627%2081005100',
} as const;

const jordanPhone = { phone: '(+962) 78 1005100', phoneHref: PRIMARY_PHONE.href };
const ksaPhone = { phone: '(+966) 11 4868433', phoneHref: 'tel:+966114868433' };

export const OFFICES: Localized<Office[]> = {
  en: [
    { label: 'Jordan Office:', address: 'Khlada- Um Al Summaq, Shatna St. Complex No. 7, Second Floor', ...jordanPhone },
    { label: 'KSA Office:', address: 'Level 6, Akaria Plaza, North Wing, Gate D Olaya Street, Riyadh, Saudi Arabia', ...ksaPhone },
  ],
  ar: [
    { address: 'عمان خلدا شارع شطنا مبنى رقم 7 الطابق الثاني الاردن', ...jordanPhone },
    { address: 'الطابق 6, العقارية بلازا, الجناح الشمالي, البوابة(د), شارع العليا الرياض, المملكة العربية السعودية', ...ksaPhone },
  ],
};
