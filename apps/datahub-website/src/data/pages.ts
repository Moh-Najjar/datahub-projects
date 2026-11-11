/**
 * Page registry — which locales each page exists in on the original site, plus its
 * original <title> / meta description / og:image (taken verbatim from datahubanalytics.com).
 * Generated from the live site on 2026-11-10; edit by hand from here on.
 */
import type { RouteKey } from '@/app/routes';
import type { Locale } from '@/i18n/types';

export interface PageMeta {
  title: string;
  description?: string;
  image?: string;
}

export interface PageEntry {
  locales: readonly Locale[];
  seo: Partial<Record<Locale, PageMeta>> & { en: PageMeta };
}

export const PAGES: Record<RouteKey, PageEntry> = {
  home: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Leading Data Analytics Solutions Company Jordan', description: 'DataHub Analytics is a leading data analytics company in Jordan offering BI, big data, cloud, and security solutions to help businesses grow with data-driven results.' },
      ar: { title: 'الشركة الرائدة في مجال حلول تحليل البيانات في الأردن', description: undefined },
    },
  },
  modernDataWarehouse: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Modern Data Warehouse Development Consulting & Solutions', description: 'Looking for expert data warehouse development consulting and solutions? Our modern approach ensures efficient and effective data management.' },
      ar: { title: 'استشارات وحلول تطوير مستودعات البيانات الحديثة', description: 'هل تبحث عن استشارات وحلول متخصصة في تطوير مستودعات البيانات؟ يضمن نهجنا الحديث إدارة البيانات بكفاءة وفعالية.' },
    },
  },
  dwaas: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Leading DWaaS Solutions & Consulting Company', description: 'Centralize data storage, streamline analytics, and eliminate the need for resource-intensive infrastructure management wit DWaaS' },
      ar: { title: 'حلول مستودع البيانات كخدمة الرائدة', description: 'مركزية تخزين البيانات، وتبسيط التحليلات، والتخلص من الحاجة إلى إدارة البنية التحتية كثيفة الاستخدام للموارد باستخدام حل مستود البيانات كخدمة' },
    },
  },
  daaas: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Leading DAaaS Solutions & Consulting Company', description: 'Datahub Analytics empowers organizations to effortlessly analyze and derive actionable insights from their data with DAaaS' },
      ar: { title: 'حلول تحليل البيانات كخدمة الرائدة', description: 'تعمل داتا هب انالتكس على تمكين المؤسسات من التحليل بسهولة واستخلاص رؤى قابلة للتنفيذ من بياناتها باستخدام تحليل البيانات كخدمة' },
    },
  },
  bigData: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Leading Big Data Solutions & Consulting Company', description: 'Access the power of big data with expert solutions & consulting services. Boost your business with leading-edge technology. Contact us today!' },
      ar: { title: 'شركة رائدة في استشارات وحلول البيانات الضخمة', description: 'يمكنك الوصول إلى قوة البيانات الضخمة من خلال حلول الخبراء والخدمات الاستشارية. عزز أعمالك باستخدام التكنولوجيا الرائدة. اتصل بنا اليوم!' },
    },
  },
  rpa: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'RPA Consulting & Solutions Company | DataHub Analytics', description: 'Looking for RPA consulting and solutions? DataHub Analytics is your trusted partner. Get expert advice for your business.' },
      ar: { title: 'استشارات حلول وتقنيات أتمتة العمليات الروبوتية | داتا هب انالتكس', description: 'هل تبحث عن استشارات وحلول أتمتة العمليات الروبوتية ؟ داتا هب انالتكس هي شريكك الموثوق به. احصل على مشورة الخبراء لعملك.' },
    },
  },
  dataScience: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Data Science & AI Consulting Solutions Company | DHA Analytics', description: 'Looking for expert data science & AI consulting solutions? DHA is a trusted partner in utilizing new technology to drive corporate success.' },
      ar: { title: 'شركة الحلول الاستشارية لعلوم البيانات والذكاء الاصطناعي | داتا هب انالتكس', description: 'هل تبحث عن حلول استشارية متخصصة في علوم البيانات والذكاء الاصطناعي؟ تعد داتا هب انالتكس شريكًا موثوقًا به في استخدام التكنولوجيا الجديدة لتحقيق نجاح الشركة.' },
    },
  },
  bigDataInfrastructure: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Big Data Infrastructure & Analytics Solutions Company', description: 'We offer cutting-edge big data infrastructure and analytics solutions to help businesses harness data. Boost your performance today!' },
      ar: { title: 'شركة لتحليل البيانات والبنية التحتية للبيانات الضخمة', description: 'نحن نقدم البنية التحتية المتطورة للبيانات الضخمة وحلول التحليلات لمساعدة الشركات على تسخير البيانات. عزز أدائك اليوم!' },
    },
  },
  dataVisualization: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Data visualization consulting services company | DataHub Analytics', description: 'Unlock the power of data with our expert data visualization consulting services. Transform your business with DataHub Analytics today.' },
      ar: { title: 'شركة الخدمات الاستشارية لتصور البيانات | داتا هاب انالتكس', description: 'أطلق العنان لقوة البيانات من خلال خدماتنا الاستشارية المتخصصة في تصور البيانات. قم بتحويل أعمالك باستخدام داتا هب انالتكس اليوم.' },
    },
  },
  businessIntelligence: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Business Intelligence Solutions Consulting Company', description: 'Looking for expert business intelligence solutions? Our company offers top-notch services to help your business thrive. Contact us today!' },
      ar: { title: 'شركة استشارات حلول ذكاء الأعمال', description: 'هل تبحث عن حلول متخصصة في ذكاء الأعمال؟ تقدم شركتنا خدمات من الدرجة الأولى لمساعدة عملك على الازدهار. اتصل بنا اليوم!' },
    },
  },
  devopsInfrastructure: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Transform Your Workflow with DevOps Infrastructure Solutions | Datahub Analytics', description: 'Explore comprehensive DevOps Infrastructure Solutions designed to enhance productivity and efficiency. Optimize your operations for success. Connect our technology experts.' },
      ar: { title: 'البنية التحتية للتشغيل والتطوير - Datahub Analytics', description: undefined },
    },
  },
  hybridCloudInfrastructure: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Enhanced Hybrid Cloud Infrastructure Solutions for Businesses | Datahub Analytics', description: 'Looking for Hybrid Cloud Infrastructure Solutions? Explore DATAHUB\'s Cloud design solutions, migration, and architecture Services to accelerate innovation.' },
      ar: { title: 'حلول السحابة الهجينة | البنية التحتية والحوسبة', description: 'هل تبحث عن حلول سحابية هجينة؟ استكشف البنية التحتية والحوسبة وخدمات الأمان لدينا للحصول على تجربة سلسة وآمنة.' },
    },
  },
  cybersecurityAdvisory: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Cybersecurity Advisory Services & Consulting | Datahub Analytics |', description: 'Explore expert Cybersecurity advisory services & solutions, to fortify your digital defenses. Mitigate risks and safeguard your valuable assets effectively.' },
      ar: { title: 'الاستشارات في أمن المعلومات - Datahub Analytics', description: undefined },
    },
  },
  cybersecurityAssessments: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Ensure Digital Safety with Cybersecurity Assessment Services | Datahub Analytics', description: 'Enhance your company\'s security with our professional cybersecurity assessment services. Safeguard your data and prevent cyber attacks effectively.' },
      ar: { title: 'تقييم أمن المعلومات - Datahub Analytics', description: undefined },
    },
  },
  governanceRiskCompliance: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'GRC Services - Governance, Risk, and Compliance Services | Datahub Analytics', description: 'Streamline your governance, risk, and compliance processes with our professional GRC services. Minimize risks, ensure compliance, and optimize your business operations.' },
      ar: { title: 'الحوكمة والمخاطر والامتثال - Datahub Analytics', description: undefined },
    },
  },
  dataManagementFramework: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Data Management Framework Services | Datahub Analytics', description: 'Discover efficiency through our comprehensive Data Management Framework Services. Optimize operations, strategy, and unlock your data full potential' },
      ar: { title: 'إطار إدارة البيانات - Datahub Analytics', description: undefined },
    },
  },
  dataGovernance: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Comprehensive Data Governance Services & Solutions | Datahub Analytics', description: 'Unlock the potential of your data with our comprehensive Data Governance Services & Solutions. Ensure compliance, fortify security, and preserve integrity.' },
      ar: { title: 'إدارة البيانات - Datahub Analytics', description: undefined },
    },
  },
  industries: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Industries We Serve - Datahub Analytics', description: 'Gain transformative insights with Datahub Analytics. There are a lot of Industries We Serve. From banking to retail, take your industry to new heights.' },
      ar: { title: 'القطاعات التي نخدمها - Datahub Analytics', description: 'الشريك الموثوق لتحليلات البيانات والبنية التحتية التكنولوجية والأمن السيبراني.' },
    },
  },
  containerizedInfrastructure: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Containerized Infrastructure Solution | Datahub Analytics |', description: 'Increase efficiency with our flawless Containerized Infrastructure Solution. Optimize infrastructure, and easily achieve unmatched performance.' },
      ar: { title: 'البنية التحتية للحاويات - Datahub Analytics', description: undefined },
    },
  },
  staffAugmentation: {
    locales: ['en'],
    seo: {
      en: { title: 'Flexible Staff Augmentation for Data Analytics - Datahub Analytics', description: 'Scale your data team with Datahub\'s staff augmentation. Access skilled data scientists, AI/ML experts, & engineers to meet project demands.', image: '/wp-content/uploads/2024/11/staff-augmentation.jpg' },
    },
  },
  aiMlEngineers: {
    locales: ['en'],
    seo: {
      en: { title: 'AI/ML Engineer Staffing for Scalable Data Solutions', description: 'Access top AI/ML engineers. Scale efficiently with Datahub Analytics\' flexible staffing solutions tailored to AI and ML projects', image: '/wp-content/uploads/2024/11/AI-ML-Engineers-Staffing.jpg' },
    },
  },
  managedDataAnalytics: {
    locales: ['en'],
    seo: {
      en: { title: 'Managed Data Analytics Services | Scalable, Insightful Solutions', description: 'Data insights with Datahub’s managed analytics services in data integration, predictive analytics & BI support.' },
    },
  },
  dataManagement: {
    locales: ['en'],
    seo: {
      en: { title: 'Data Management Outsourcing Services | Datahub Analytics', description: 'Optimize data handling with Datahub\'s data management outsourcing, streamline integration, improve quality, and secure your data' },
    },
  },
  pmoServices: {
    locales: ['en'],
    seo: {
      en: { title: 'PMO Services for Data Analytics Success - Datahub Analytics', description: 'Streamline your data projects with Datahub\'s PMO services. Enhance project efficiency, ensure data compliance, & achieve strategic alignment.', image: '/wp-content/uploads/2024/11/PMO-Services.jpg' },
    },
  },
  analyticsCoe: {
    locales: ['en'],
    seo: {
      en: { title: 'Centre of Excellence (CoE) | Datahub Analytics', description: 'Leverage Datahub Analytics\' Centre of Excellence to enhance data governance, analytics strategy & innovation for better business decisions.', image: '/wp-content/uploads/2024/10/dha-coe-scaled.jpg' },
    },
  },
  managedInfrastructure: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Managed Infrastructure - Datahub Analytics', description: 'Get reliable managed infrastructure services with Datahub Analytics. We help you boost security, reduce costs, and keep your systems running smoothly.' },
      ar: { title: 'البنية التحتية المدارة - Datahub Analytics', description: undefined },
    },
  },
  contact: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Contact Us - Datahub Analytics', description: 'Get in touch with Datahub Analytics today. Contact our team for data, analytics, security, and IT solutions. We are here to help your business grow.' },
      ar: { title: 'تواصل معنا - Datahub Analytics', description: undefined },
    },
  },
  services: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Datahub Services - Datahub Analytics', description: 'Explore Datahub Analytics services in data, security, cloud, and outsourcing. We help businesses grow with trusted, smart, and cost-effective solutions.' },
      ar: { title: 'خدمات داتا هب - Datahub Analytics', description: undefined },
    },
  },
  solutions: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Datahub Solutions - Datahub Analytics', description: 'We at Datahub Analytics provides solutions for analytics, cloud, security, and outsourcing. We help businesses grow with smart data, modern tools, and trusted support.' },
      ar: { title: 'خدمات داتا هب - Datahub Analytics', description: undefined },
    },
  },
  careers: {
    locales: ['en'],
    seo: {
      en: { title: 'Careers - Datahub Analytics', description: 'Join Datahub Analytics and grow your career in data, analytics, and technology. Explore open roles and be part of our innovative team today.' },
    },
  },
  blog: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Blog - Datahub Analytics', description: 'Stay updated with the latest insights, tips, and trends in data analytics, business intelligence, and technology on the Datahub Analytics blog.' },
      ar: { title: 'مدونة - Datahub Analytics', description: undefined },
    },
  },
  about: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Our Story - Datahub Analytics', description: 'Know the journey of Datahub Analytics, delivering innovative data solutions and insights to help businesses grow and succeed.' },
      ar: { title: 'قصتنا - Datahub Analytics', description: undefined },
    },
  },
  devSecOps: {
    locales: ['en'],
    seo: {
      en: { title: 'DevSecOps - Datahub Analytics', description: 'Secure your software with DevSecOps from Datahub Analytics. Automate security, improve quality, and deliver reliable apps faster.' },
    },
  },
  infrastructureAutomation: {
    locales: ['en'],
    seo: {
      en: { title: 'Infrastructure Automation using Ansible - Datahub Analytics', description: 'Automate your IT infrastructure efficiently with Ansible. Reduce manual tasks, improve reliability, and speed up deployment with Datahub Analytics.' },
    },
  },
  tools: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Tools and Technologies - Datahub Analytics', description: 'Explore the top tools and technologies used by Datahub Analytics to deliver data solutions, analytics, and insights that help businesses grow.' },
      ar: { title: 'الأدوات والتقنيات - Datahub Analytics', description: 'Explore the top tools and technologies used by Datahub Analytics to deliver data solutions, analytics, and insights that help businesses grow.' },
    },
  },
  analytics: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Datahub Analytics Solutions: Transforming Data into Success', description: 'Empower your decisions with Datahub Analytics Solutions. Our expert team transforms data into actionable insights, driving your success.' },
      ar: { title: 'Datahub Analytics Solutions: Transforming Data into Success', description: 'Empower your decisions with Datahub Analytics Solutions. Our expert team transforms data into actionable insights, driving your success.' },
    },
  },
  infrastructure: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Comprehensive Datahub Infrastructure Solutions & Management', description: 'Scale confidently with Datahub Infrastructure Solutions. Our comprehensive solutions include advanced infrastructure management and technology to ensure efficiency.' },
      ar: { title: 'Comprehensive Datahub Infrastructure Solutions & Management', description: 'Scale confidently with Datahub Infrastructure Solutions. Our comprehensive solutions include advanced infrastructure management and technology to ensure efficiency.' },
    },
  },
  outsourcing: {
    locales: ['en'],
    seo: {
      en: { title: 'Datahub Outsourcing Services - Analytics, AI/ML & Project Support', description: 'Optimize data solutions with Datahub Analytics\' outsourcing services expertise in AI/ML, & PMO support to scale teams & accelerate insights', image: '/wp-content/uploads/2024/11/outsourcing-services.jpg' },
    },
  },
  security: {
    locales: ['en', 'ar'],
    seo: {
      en: { title: 'Datahub Security - Datahub Analytics', description: 'Protect your business with Datahub Security by Datahub Analytics. We offer trusted solutions for cyber security, compliance, and data protection.' },
      ar: { title: 'أمن داتاهب - Datahub Analytics', description: 'Protect your business with Datahub Security by Datahub Analytics. We offer trusted solutions for cyber security, compliance, and data protection.' },
    },
  },
  workCulture: {
    locales: ['en'],
    seo: {
      en: { title: 'Our Work Culture - Datahub Analytics', description: 'Know about Datahub Analytics’ work culture where teamwork, innovation, and growth come together to create a supportive and inspiring environment.' },
    },
  },
  internship: {
    locales: ['en'],
    seo: {
      en: { title: 'Internship Opportunities - Datahub Analytics', description: 'Explore internship opportunities at Datahub Analytics. Gain real-world experience, learn from experts, and grow your career in data and analytics.' },
    },
  },
};
