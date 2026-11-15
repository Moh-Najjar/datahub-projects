import type { Product } from '@/modules/products/types/product';

/*
 * Mock product catalogue — read ONLY by `api/productsApi.ts`, never by components.
 *
 * PLACEHOLDER COPY: short, neutral descriptions pending approved product copy (the Arabic is a
 * draft translation to be reviewed). None of these products is released yet, so no text may claim
 * availability or features; no logos, images or links exist yet, so none are set.
 *
 * To add a product: append an entry with a unique id/slug and the next displayOrder.
 */
export const MOCK_PRODUCTS: readonly Product[] = [
  {
    id: 'datahub-hr',
    slug: 'datahub-hr',
    name: { en: 'DataHub HR', ar: 'DataHub HR' },
    category: { en: 'Human Resources · Mobile app', ar: 'الموارد البشرية · تطبيق جوال' },
    shortDescription: {
      en: 'A mobile app for human resources management, currently in development.',
      ar: 'تطبيق جوال لإدارة الموارد البشرية، قيد التطوير حالياً.',
    },
    description: {
      en: 'DataHub HR is a mobile application for human resources management, built by DataHub. It is currently in development; details will be shared closer to release.',
      ar: 'DataHub HR تطبيق جوال لإدارة الموارد البشرية من تطوير داتا هب. التطبيق قيد التطوير حالياً، وسيتم الإعلان عن التفاصيل قرب موعد إطلاقه.',
    },
    status: 'in-development',
    displayOrder: 1,
  },
  {
    id: 'bi-custom-visuals',
    slug: 'bi-custom-visuals',
    name: { en: 'BI Custom Visuals', ar: 'BI Custom Visuals' },
    category: { en: 'Business Intelligence', ar: 'ذكاء الأعمال' },
    shortDescription: {
      en: 'Custom visuals for business intelligence reports. Coming soon.',
      ar: 'عناصر مرئية مخصصة لتقارير ذكاء الأعمال. قريباً.',
    },
    description: {
      en: 'BI Custom Visuals is a planned DataHub product of custom visuals for business intelligence reports. More information will be available soon.',
      ar: 'BI Custom Visuals منتج مخطط من داتا هب يقدم عناصر مرئية مخصصة لتقارير ذكاء الأعمال. ستتوفر المزيد من المعلومات قريباً.',
    },
    status: 'coming-soon',
    displayOrder: 2,
  },
  {
    id: 'datahub-trainee',
    slug: 'datahub-trainee',
    name: { en: 'DataHub Trainee', ar: 'DataHub Trainee' },
    category: { en: 'Training', ar: 'التدريب' },
    shortDescription: {
      en: 'A platform for trainee programmes. Coming soon.',
      ar: 'منصة لبرامج المتدربين. قريباً.',
    },
    description: {
      en: 'DataHub Trainee is a planned DataHub platform for trainee programmes. More information will be available soon.',
      ar: 'DataHub Trainee منصة مخططة من داتا هب لبرامج المتدربين. ستتوفر المزيد من المعلومات قريباً.',
    },
    status: 'coming-soon',
    displayOrder: 3,
  },
];
