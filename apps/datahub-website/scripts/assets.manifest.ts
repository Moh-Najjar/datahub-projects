/**
 * Manifest of original public assets from datahubanalytics.com.
 *
 * Every entry maps an original URL to a descriptive local path under `public/`.
 * Run `npm run assets` to (re)download anything that is missing.
 * Blog images are served by the backend (blog posts come from its API).
 */
export interface AssetEntry {
  /** Original URL (absolute, or a path relative to the origin). */
  readonly src: string;
  /** Destination path relative to `public/`. */
  readonly dest: string;
}

export const ORIGIN = 'https://datahubanalytics.com';
const U = '/wp-content/uploads';

const brand: AssetEntry[] = [
  { src: `${U}/2023/07/databubanalytics_logo_2-250x46.png`, dest: 'assets/logos/datahub-logo.png' },
  { src: `${U}/2023/07/databubanalytics_logo_2-250x46@2x.png`, dest: 'assets/logos/datahub-logo@2x.png' },
  { src: `${U}/2023/07/DataHub-White-Logo-160x24.png`, dest: 'assets/logos/datahub-logo-white.png' },
  { src: `${U}/2023/07/DataHub-White-Logo-160x24@2x.png`, dest: 'assets/logos/datahub-logo-white@2x.png' },
  { src: `${U}/2023/09/cropped-fevicon-dh-32x32.png`, dest: 'favicon-32x32.png' },
  { src: `${U}/2023/09/cropped-fevicon-dh-192x192.png`, dest: 'favicon-192x192.png' },
  { src: `${U}/2023/09/cropped-fevicon-dh-180x180.png`, dest: 'apple-touch-icon.png' },
  { src: '/wp-content/plugins/sitepress-multilingual-cms/res/flags/ar.svg', dest: 'assets/icons/flag-ar.svg' },
  { src: '/wp-content/plugins/sitepress-multilingual-cms/res/flags/en.svg', dest: 'assets/icons/flag-en.svg' },
];

const backgrounds: AssetEntry[] = [
  { src: `${U}/2023/09/Home-scaled-e1694343500742.jpeg`, dest: 'assets/backgrounds/home-hero.jpeg' },
  { src: `${U}/2020/11/n-1-bg.png`, dest: 'assets/backgrounds/about-lines.png' },
  { src: `${U}/2023/08/3d-elegant-geometrical-texture-background-scaled.jpg`, dest: 'assets/backgrounds/geometric-texture.jpg' },
  { src: `${U}/2019/03/mitech-home-services-contact-bg.png`, dest: 'assets/backgrounds/consultation-map.png' },
  // Page title bar (Careers). The original hotlinks the theme vendor's demo copy; the same file ships with the theme.
  { src: '/wp-content/themes/mitech/assets/images/title-bar-01-bg.jpg', dest: 'assets/backgrounds/title-bar.jpg' },
];

const media: AssetEntry[] = [
  { src: `${U}/2023/08/Screenshot-from-2023-08-28-10-22-17.png`, dest: 'assets/images/intro-video-thumb.png' },
  { src: `${U}/2023/09/DataHub-Anlaytics-company-profile-Full-v3.pdf`, dest: 'assets/docs/datahub-analytics-company-profile.pdf' },
];

/** Client logos, in the order shown in the homepage carousel. */
export const CLIENT_LOGOS = [
  ['arab-bank.jpg', 'arab-bank.jpg'],
  ['network.png', 'network.png'],
  ['petra.png', 'petra.png'],
  ['mhot.jpg', 'mhot.jpg'],
  ['bromine.png', 'bromine.png'],
  ['usaid.jpg', 'usaid.jpg'],
  ['royal-court.jpeg', 'royal-court.jpeg'],
  ['pcbs.jpg', 'pcbs.jpg'],
  ['unwto.png', 'unwto.png'],
  ['amman-aca.png', 'amman-academy.png'],
  ['local-ent.jpg', 'local-enterprise.jpg'],
  ['jordanoly.png', 'jordan-olympic.png'],
  ['investworld.png', 'investworld.png'],
  ['greenlogo.jpg', 'greenlogo.jpg'],
  ['jopacc.png', 'jopacc.png'],
  ['jordanloan.png', 'jordan-loan.png'],
  ['tradecenter.png', 'trade-center.png'],
  ['sadaqa.png', 'sadaqa.png'],
  ['kimclark.png', 'kimberly-clark.png'],
] as const;

const clients: AssetEntry[] = CLIENT_LOGOS.map(([file, local]) => ({
  src: `${U}/2023/08/${file}`,
  dest: `assets/clients/${local}`,
}));

/** Technology logos (the 200px renditions the original displays). */
const technologies: AssetEntry[] = [
  ['2023/08/Red_Hat_Enterprise_Linux-200x48.png', 'red-hat-enterprise-linux.png'],
  ['2025/09/stackable-logo-v2-icon-colored-with-name-dark-1-smaller-200x47.png', 'stackable.png'],
  ['2024/07/minio-200x41.png', 'minio.png'],
  ['2025/09/18633690-200x200.png', 'tigera.png'],
  ['2025/09/Linux-Logo-PNG-Images-HD-200x200.png', 'linux.png'],
  ['2023/08/aws-200x100.png', 'aws.png'],
  ['2025/09/red-hat-ansible-200x78.png', 'red-hat-ansible.png'],
  ['2025/09/Ansible_Logo.png', 'ansible.png'],
  ['2025/09/kubernetes-logo-200x102.jpg', 'kubernetes.jpg'],
  ['2025/09/Zabbix-200x52.png', 'zabbix.png'],
  ['2023/08/OpenMetal-Logo-Horizontal-200x33.png', 'openmetal.png'],
  ['2023/08/Microsoft_Azure-200x58.png', 'microsoft-azure.png'],
  ['2023/08/AzureSynapseAnalytics-200x58.webp', 'azure-synapse-analytics.webp'],
  ['2023/08/Tableau-200x56.png', 'tableau.png'],
  ['2023/08/Databricks-200x32.png', 'databricks.png'],
  ['2024/07/talend-200x78.png', 'talend.png'],
].map(([path, local]) => ({ src: `${U}/${path}`, dest: `assets/technologies/${local}` }));

export const ASSETS: readonly AssetEntry[] = [...brand, ...backgrounds, ...media, ...clients, ...technologies];

/** Satoshi (Indian Type Foundry, ITF Free Font License) — self-hosted woff2. */
export const SATOSHI_CSS_URL = 'https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap';
