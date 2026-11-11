/**
 * Canonical, locale-neutral URLs — identical to the original site's English URLs
 * (including the trailing slash). Arabic URLs are the same paths under `/ar`.
 */
export const ROUTES = {
  home: '/',
  about: '/about-us/',
  contact: '/contact-us/',
  blog: '/blog/',
  industries: '/industries-we-serve/',
  tools: '/tools-and-technologies/',
  careers: '/careers/',
  workCulture: '/careers/our-work-culture/',
  internship: '/careers/internship-opportunities/',
  solutions: '/solutions/',
  services: '/services/',

  // Category hubs
  analytics: '/solutions/datahub-analytics/',
  infrastructure: '/solutions/datahub-infrastructure/',
  security: '/services/datahub-security/',
  outsourcing: '/services/datahub-outsourcing-services/',

  // XaaS
  dwaas: '/solutions/data-warehouse-as-a-service/',
  daaas: '/solutions/data-analytics-as-a-service-daaas/',

  // Datahub Analytics
  bigData: '/solutions/leading-big-data-solutions-consulting-company/',
  modernDataWarehouse: '/solutions/modern-data-warehouse/',
  businessIntelligence: '/solutions/business-intelligence-solutions-consulting-company/',
  dataVisualization: '/solutions/data-visualization/',
  dataScience: '/solutions/data-science-ai-consulting-solutions-company/',
  rpa: '/solutions/robotic-process-automation-rpa/',

  // Datahub Infrastructure
  bigDataInfrastructure: '/solutions/big-data-infrastructure-analytics-solutions-company/',
  containerizedInfrastructure: '/solutions/containerized-infrastructure/',
  devopsInfrastructure: '/solutions/devops-infrastructure/',
  hybridCloudInfrastructure: '/solutions/hybrid-cloud-infrastructure/',
  devSecOps: '/solutions/dev-sec-ops/',
  infrastructureAutomation: '/solutions/infrastructure-automation-using-ansible/',
  managedInfrastructure: '/solutions/managed-infrastructure/',

  // Datahub Security
  cybersecurityAdvisory: '/services/cybersecurity-advisory/',
  cybersecurityAssessments: '/services/cybersecurity-assessments/',
  governanceRiskCompliance: '/services/governance-risk-and-compliance/',
  dataManagementFramework: '/services/data-management-framework-dama/',
  dataGovernance: '/services/data-governance/',

  // Datahub Outsourcing
  staffAugmentation: '/services/staff-augmentation-services/',
  aiMlEngineers: '/services/ai-ml-engineers-staffing/',
  managedDataAnalytics: '/services/managed-data-analytics-services/',
  dataManagement: '/services/data-management-outsourcing-services/',
  pmoServices: '/services/pmo-services/',
  analyticsCoe: '/services/data-analytics-centre-of-excellence-coe/',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type AppPath = (typeof ROUTES)[RouteKey];

/** Industry anchors on the Industries page. */
export const industryAnchor = (id: string) => `${ROUTES.industries}#industry-section-${id}`;

export const EXTERNAL_LINKS = {
  jobs: 'https://datahubanalytics.odoo.com/jobs',
  internship: 'https://datahubanalytics.odoo.com/internship',
  linkedin: 'https://www.linkedin.com/company/datahubanalytics/',
  introVideo: 'https://www.youtube.com/watch?v=K0jkCpkjfC0',
} as const;

/**
 * The original homepage links to short slugs that do not exist (they bounce to `/`).
 * Approved fix: redirect each one to its real page.
 */
export const LEGACY_REDIRECTS: Readonly<Record<string, AppPath>> = {
  '/solutions/big-data/': ROUTES.bigData,
  '/solutions/data-science/': ROUTES.dataScience,
  '/solutions/business-intelligence/': ROUTES.businessIntelligence,
  '/solutions/big-data-infrastructure/': ROUTES.bigDataInfrastructure,
  '/solutions/datahub-security/': ROUTES.security,
  '/services/datahub-outsourcing/': ROUTES.outsourcing,
  '/services/staff-augmentation/': ROUTES.staffAugmentation,
  '/services/managed-data-analytics/': ROUTES.managedDataAnalytics,
  '/services/data-management/': ROUTES.dataManagement,
  '/services/data-analytics-centre-of-excellence/': ROUTES.analyticsCoe,
};
