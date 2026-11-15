import { EXTERNAL_LINKS, industryAnchor, ROUTES } from '@/core/routes/paths';
import type { Localized } from '@/i18n/languages';
import type { NavColumn, NavItem, NavLink } from '@/core/types/navigation';

/* -------------------------------------------------------------------------- */
/* Service columns (shared by the mega menu and the footer)                   */
/* Labels are verbatim from the original, including its "Analyics" typo.      */
/* -------------------------------------------------------------------------- */

const analyticsEn: NavColumn = {
  title: 'Datahub Analytics',
  links: [
    { label: 'Big Data Analyics', href: ROUTES.bigData },
    { label: 'Modern Data Warehouse', href: ROUTES.modernDataWarehouse },
    { label: 'Business Intelligence', href: ROUTES.businessIntelligence },
    { label: 'Data Visualization', href: ROUTES.dataVisualization },
    { label: 'Data Science', href: ROUTES.dataScience },
    { label: 'Robotic Process Automation (RPA)', href: ROUTES.rpa },
  ],
  more: { label: 'Learn More >', href: ROUTES.analytics },
};

const infrastructureEn: NavColumn = {
  title: 'Datahub Infrastructure',
  links: [
    { label: 'Big Data Infrastructure', href: ROUTES.bigDataInfrastructure },
    { label: 'Containerized Infrastructure', href: ROUTES.containerizedInfrastructure },
    { label: 'DevOps Infrastructure Solutions', href: ROUTES.devopsInfrastructure },
    { label: 'Hybrid Cloud Infrastructure Solutions', href: ROUTES.hybridCloudInfrastructure },
    { label: 'DevSecOps', href: ROUTES.devSecOps },
    { label: 'Infrastructure Automation', href: ROUTES.infrastructureAutomation },
    { label: 'Managed Infrastructure', href: ROUTES.managedInfrastructure },
  ],
  more: { label: 'Learn More >', href: ROUTES.infrastructure },
};

const securityEn: NavColumn = {
  title: 'Datahub Security',
  links: [
    { label: 'Cybersecurity Advisory Services', href: ROUTES.cybersecurityAdvisory },
    { label: 'Cybersecurity Assessments Services', href: ROUTES.cybersecurityAssessments },
    { label: 'Governance, Risk, and Compliance Services', href: ROUTES.governanceRiskCompliance },
    { label: 'Data Management Framework (DAMA) Services', href: ROUTES.dataManagementFramework },
    { label: 'Data Governance', href: ROUTES.dataGovernance },
  ],
  more: { label: 'Learn More >', href: ROUTES.security },
};

const outsourcingEn: NavColumn = {
  title: 'Datahub Outsourcing',
  links: [
    { label: 'Staff Augmentation', href: ROUTES.staffAugmentation },
    { label: 'AI/ML Engineers', href: ROUTES.aiMlEngineers },
    { label: 'Managed Data Analytics', href: ROUTES.managedDataAnalytics },
    { label: 'Data Management', href: ROUTES.dataManagement },
    { label: 'PMO Services', href: ROUTES.pmoServices },
    { label: 'Data & Analytics Centre of Excellence', href: ROUTES.analyticsCoe },
  ],
  more: { label: 'Learn More >', href: ROUTES.outsourcing },
};

const learnMoreAr = 'لمعرفة المزيد >';

const securityLinksAr: NavLink[] = [
  { label: 'استشارات الأمن السيبراني', href: ROUTES.cybersecurityAdvisory },
  { label: 'تقييمات الأمن السيبراني', href: ROUTES.cybersecurityAssessments },
  { label: 'الحوكمة، والمخاطر والامتثال', href: ROUTES.governanceRiskCompliance },
  { label: 'إطار إدارة البيانات (داما)', href: ROUTES.dataManagementFramework },
  { label: 'حوكمة البيانات', href: ROUTES.dataGovernance },
];

const infrastructureLinksAr: NavLink[] = [
  { label: 'البنية التحتية للبيانات الضخمة', href: ROUTES.bigDataInfrastructure },
  { label: 'البنية التحتية للحاويات', href: ROUTES.containerizedInfrastructure },
  { label: 'البنية التحتية لـ DevOps', href: ROUTES.devopsInfrastructure },
  { label: 'البنية التحتية السحابية الهجينة', href: ROUTES.hybridCloudInfrastructure },
  { label: 'البنية التحتية المدارة', href: ROUTES.managedInfrastructure },
];

const analyticsLinksAr: NavLink[] = [
  { label: 'حلول البيانات الضخمة', href: ROUTES.bigData },
  { label: 'مستودع البيانات الحديث', href: ROUTES.modernDataWarehouse },
  { label: 'ذكاء الأعمال', href: ROUTES.businessIntelligence },
  { label: 'تصوير المعلومات', href: ROUTES.dataVisualization },
  { label: 'علم البيانات', href: ROUTES.dataScience },
  { label: 'أتمتة العمليات الروبوتية RPA', href: ROUTES.rpa },
];

/** Mega-menu columns. The Arabic menu has three columns, in this DOM order. */
const megaColumns: Localized<NavColumn[]> = {
  en: [analyticsEn, infrastructureEn, securityEn, outsourcingEn],
  ar: [
    { title: 'خدمات داتا هب لأمن المعلومات', links: securityLinksAr, more: { label: learnMoreAr, href: ROUTES.security } },
    { title: 'خدمات داتا هب للبنية التحتية', links: infrastructureLinksAr, more: { label: learnMoreAr, href: ROUTES.infrastructure } },
    { title: 'داتا هب انالتكس', links: analyticsLinksAr, more: { label: learnMoreAr, href: ROUTES.analytics } },
  ],
};

/** Footer service columns. */
export const FOOTER_COLUMNS: Localized<NavColumn[]> = {
  en: [analyticsEn, infrastructureEn, securityEn, outsourcingEn],
  ar: [
    { title: 'داتا هب انالتكس', links: analyticsLinksAr, more: { label: learnMoreAr, href: ROUTES.analytics } },
    { title: 'داتا هب انالتكس للبنية التحتية', links: infrastructureLinksAr, more: { label: learnMoreAr, href: ROUTES.infrastructure } },
    { title: 'داتا هب انالتكس لأمن المعلومات', links: securityLinksAr, more: { label: learnMoreAr, href: ROUTES.security } },
  ],
};

/* -------------------------------------------------------------------------- */
/* Industries                                                                  */
/* -------------------------------------------------------------------------- */

export const INDUSTRY_IDS = ['gov', 'banking', 'ports', 'supplychain', 'manufacturing', 'aviation', 'retail', 'tele', 'edu', 'sports'] as const;
export type IndustryId = (typeof INDUSTRY_IDS)[number];

export const INDUSTRY_LABELS: Localized<Record<IndustryId, string>> = {
  en: {
    gov: 'Government Services',
    banking: 'Banking',
    ports: 'Ports',
    supplychain: 'Supply Chain',
    manufacturing: 'Manufacturing',
    aviation: 'Aviation',
    retail: 'Retail',
    tele: 'Telecommunication',
    edu: 'Education',
    sports: 'Sports Management',
  },
  ar: {
    gov: 'الخدمات الحكومية',
    banking: 'البنوك',
    ports: 'الموانئ',
    supplychain: 'سلسلة التوريد',
    manufacturing: 'التصنيع',
    aviation: 'الطيران',
    retail: 'التجزئة',
    tele: 'الاتصالات',
    edu: 'تعليم',
    sports: 'إدارة الرياضة',
  },
};

const industryLinks = (locale: 'en' | 'ar'): NavLink[] =>
  INDUSTRY_IDS.map((id) => ({ label: INDUSTRY_LABELS[locale][id], href: industryAnchor(id) }));

/* -------------------------------------------------------------------------- */
/* Primary navigation                                                          */
/* -------------------------------------------------------------------------- */

export const PRIMARY_NAV: Localized<NavItem[]> = {
  en: [
    { kind: 'link', label: 'Home', href: ROUTES.home },
    { kind: 'mega', label: 'Solutions & Services', columns: megaColumns.en },
    { kind: 'link', label: 'Products', href: ROUTES.products },
    {
      kind: 'dropdown',
      label: 'XaaS',
      items: [
        { label: 'Data Warehouse as a Service (DWaaS)', href: ROUTES.dwaas },
        { label: 'Data Analytics as a Service (DAaaS)', href: ROUTES.daaas },
      ],
    },
    { kind: 'dropdown', label: 'Industries', href: ROUTES.industries, items: industryLinks('en') },
    { kind: 'link', label: 'About Us', href: ROUTES.about },
    {
      kind: 'dropdown',
      label: 'Career',
      items: [
        { label: 'Our Work Culture', href: ROUTES.workCulture },
        { label: 'Open Vacancies', href: EXTERNAL_LINKS.jobs },
        { label: 'Internship Opportunities', href: EXTERNAL_LINKS.internship },
      ],
    },
    { kind: 'link', label: 'Blog', href: ROUTES.blog },
    { kind: 'link', label: 'Contact Us', href: ROUTES.contact },
  ],
  ar: [
    { kind: 'link', label: 'الصفحة الرئيسية', href: ROUTES.home },
    { kind: 'mega', label: 'الحلول و الخدمات', columns: megaColumns.ar },
    { kind: 'link', label: 'المنتجات', href: ROUTES.products },
    {
      kind: 'dropdown',
      label: 'الحلول كخدمة',
      items: [
        { label: 'تحليل البيانات كخدمة', href: ROUTES.daaas },
        { label: 'مستودع البيانات كخدمة', href: ROUTES.dwaas },
      ],
    },
    { kind: 'dropdown', label: 'القطاعات', href: ROUTES.industries, items: industryLinks('ar') },
    { kind: 'link', label: 'قصتنا', href: ROUTES.about },
    {
      kind: 'dropdown',
      label: 'مهنة',
      items: [
        { label: 'ثقافة العمل لدينا', href: ROUTES.workCulture, locale: 'en' },
        { label: 'فرص العمل المتاحة', href: EXTERNAL_LINKS.jobs },
        { label: 'فترة تدريب', href: EXTERNAL_LINKS.internship },
      ],
    },
    { kind: 'link', label: 'مدونة', href: ROUTES.blog },
    { kind: 'link', label: 'تواصل معنا', href: ROUTES.contact },
  ],
};
