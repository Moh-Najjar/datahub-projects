import { ROUTES } from '@/app/routes';
import type { IndustryId } from '@/data/navigation';
import type { Localized } from '@/i18n/types';
import type { LinkAction, RichText } from '@/types/content';

export interface ServiceCard {
  title: string;
  text: string;
  href: string;
}

export interface XaasCard {
  abbr: string;
  title: string;
  text: string;
  href: string;
  cta: string;
}

export interface SolutionTab {
  title: string;
  text: string;
  items: LinkAction[];
  viewAll: LinkAction;
}

export interface Counter {
  value: number;
  suffix: string;
  label: string;
}

export interface HomeContent {
  hero: { title: string; subtitle: string; cards: ServiceCard[]; cta: string };
  xaas: XaasCard[];
  about: {
    label: string;
    heading: RichText;
    tagline: string;
    paragraphs: string[];
    brochure: LinkAction;
    videoAlt: string;
  };
  stats: { heading: RichText; highlight: string; highlightLabel: string; counters: Counter[] };
  solutions: { label: string; heading: RichText; tabs: SolutionTab[] };
  technologies: { label: string; heading: RichText; viewAll: LinkAction };
  industries: { heading: RichText; subheading: string; labels: Record<IndustryId, string> };
  blog: { label: string; heading: RichText; readMore: string };
}

/* Copy is verbatim from datahubanalytics.com (EN) and datahubanalytics.com/?lang=ar (AR). */
export const HOME_CONTENT: Localized<HomeContent> = {
  en: {
    hero: {
      title: 'Building Strong Foundations for Data-driven Success',
      subtitle: 'Empowering businesses with data-driven insights, robust infrastructure, and resilient security',
      cta: 'Discover now',
      cards: [
        { title: 'Datahub Analytics', text: 'Unlock valuable growth opportunities and make data-driven decisions with our comprehensive analytics capabilities.', href: ROUTES.analytics },
        { title: 'Datahub Infrastructure', text: "Ensure seamless digital transformation and enhance your business's performance with Datahub Infrastructure solutions.", href: ROUTES.infrastructure },
        { title: 'Datahub Security', text: 'Safeguard your business from cyber threats and enhance your digital defenses with Datahub Security services.', href: ROUTES.security },
        {
          title: 'Datahub Outsourcing',
          text: 'Whether you need temporary support to handle increased workload or specialized expertise for specific projects, we can scale resources to match your needs without the long-term commitment of hiring full-time staff.',
          href: ROUTES.outsourcing,
        },
      ],
    },
    xaas: [
      {
        abbr: 'DWaaS',
        title: 'Data Warehouse as a Service',
        text: 'By seamlessly centralizing data storage, streamlining analytics, and eliminating the need for resource-intensive infrastructure management, DWaaS empowers organizations to focus on innovation and core business operations.',
        href: ROUTES.dwaas,
        cta: 'Read More',
      },
      {
        abbr: 'DAaaS',
        title: 'Data Analytics as a Service',
        text: 'Through a combination of state-of-the-art technology, advanced algorithms, and a user-friendly interface, Datahub Analytics empowers organizations to effortlessly analyze and derive actionable insights from their data without worrying about infrastructure.',
        href: ROUTES.daaas,
        cta: 'Read More',
      },
    ],
    about: {
      label: 'WHERE INNOVATION THRIVES',
      heading: [{ mark: 'Redefining Possibilities' }, ' with Datahub Analytics'],
      tagline:
        'Together, we envision a future where data-driven insights and robust cybersecurity pave the way for organizations to thrive in the ever-evolving digital landscape.',
      paragraphs: [
        'At Datahub Analytics, we are dedicated to empowering businesses with innovative data analytics, infrastructure, and cybersecurity solutions. Our team of experts brings a wealth of knowledge and experience to help organizations harness the power of data, drive informed decision-making, and optimize their digital landscape. With a customer-centric approach, we collaborate closely with our clients to understand their unique challenges and deliver tailored solutions that unlock growth and success.',
        'Through an unwavering commitment to quality, confidentiality, and integrity, we prioritize the security of our clients’ data and intellectual property. Our streamlined processes and focus on simplicity ensure seamless project execution, providing real business value at every stage. At Datahub Analytics, we thrive on innovation, continuously striving to stay at the forefront of technology and deliver exceptional results.',
      ],
      brochure: { label: 'Download Brochure', href: '/assets/docs/datahub-analytics-company-profile.pdf' },
      videoAlt: 'intro-video-thumb',
    },
    stats: {
      heading: ['Highlights from our ', { mark: 'Success Stories' }],
      highlight: '110+',
      highlightLabel: 'Years of Combined Experience',
      counters: [
        { value: 60, suffix: '+', label: 'Successful Projects' },
        { value: 15, suffix: 'K+', label: 'Analytical Dashboards' },
        { value: 22, suffix: '', label: 'Tools & Technologies' },
      ],
    },
    solutions: {
      label: 'Our Solutions & Services',
      heading: [{ mark: 'Crafting Success' }, ' through Expertise and Experience'],
      tabs: [
        {
          title: 'Datahub Analytics',
          text: 'We specialize in delivering advanced Data Analytics solutions tailored to your business’s unique needs. Our team of highly skilled professionals excels in predictive modeling, machine learning, data visualization, and data mining. Leveraging their expertise and industry experience, they transform raw data into actionable insights that drive tangible business outcomes.',
          items: [
            { label: 'Big Data Solutions', href: ROUTES.bigData },
            { label: 'Modern Data Warehouse', href: ROUTES.modernDataWarehouse },
            { label: 'Data Visualization', href: ROUTES.dataVisualization },
            { label: 'Data Science', href: ROUTES.dataScience },
            { label: 'Business Intelligence', href: ROUTES.businessIntelligence },
            { label: 'RPA', href: ROUTES.rpa },
          ],
          viewAll: { label: 'View All', href: ROUTES.analytics },
        },
        {
          title: 'Datahub Infrastructure',
          text: 'Our team of highly skilled experts specializes in designing and optimizing data infrastructures, ensuring data accessibility, security, and scalability. With a focus on innovation and industry best practices, we provide advanced infrastructure solutions that empower businesses to achieve their goals efficiently and effectively.',
          items: [
            { label: 'Big Data Infrastructure', href: ROUTES.bigDataInfrastructure },
            { label: 'Containerized Infrastructure', href: ROUTES.containerizedInfrastructure },
            { label: 'DevOps Infrastructure', href: ROUTES.devopsInfrastructure },
            { label: 'Hybrid Cloud Infrastructure', href: ROUTES.hybridCloudInfrastructure },
            { label: 'Managed Infrastructure', href: ROUTES.managedInfrastructure },
          ],
          viewAll: { label: 'View All', href: ROUTES.infrastructure },
        },
        {
          title: 'Datahub Security',
          text: 'We specialize in providing comprehensive cybersecurity services to safeguard your organization against evolving threats. Our team of cybersecurity experts excels in threat detection, incident response, vulnerability assessments, and security architecture design. Leveraging our in-depth knowledge and industry experience, we fortify your defenses and ensure your assets remains safe and confidential.',
          items: [
            { label: 'Cybersecurity Advisory', href: ROUTES.cybersecurityAdvisory },
            { label: 'Cybersecurity Assessments', href: ROUTES.cybersecurityAssessments },
            { label: 'Governance, Risk, and Compliance', href: ROUTES.governanceRiskCompliance },
            { label: 'Data Management Framework (DAMA)', href: ROUTES.dataManagementFramework },
            { label: 'Data Governance', href: ROUTES.dataGovernance },
          ],
          viewAll: { label: 'View All', href: ROUTES.security },
        },
        {
          title: 'Datahub Outsourcing',
          text: 'We offer access to a dedicated pool of highly skilled data analytics professionals, from data scientists to AI/ML engineers, who are ready to seamlessly integrate into your existing teams. Whether you need temporary support to handle increased workload or specialized expertise for specific projects, we can scale resources to match your needs without the long-term commitment of hiring full-time staff.',
          items: [
            { label: 'Staff Augmentation', href: ROUTES.staffAugmentation },
            { label: 'AI/ML Engineers', href: ROUTES.aiMlEngineers },
            { label: 'Managed Data Analytics', href: ROUTES.managedDataAnalytics },
            { label: 'Data Management', href: ROUTES.dataManagement },
            { label: 'PMO Services', href: ROUTES.pmoServices },
            { label: 'Data & Analytics Centre of Excellence', href: ROUTES.analyticsCoe },
          ],
          viewAll: { label: 'View All', href: ROUTES.outsourcing },
        },
      ],
    },
    technologies: {
      label: 'Tools & Technologies We Use',
      heading: [{ mark: 'Get an edge' }, ' over your competitors'],
      viewAll: { label: 'View All', href: ROUTES.tools },
    },
    industries: {
      heading: [{ mark: 'Industries' }, ' We Impact'],
      subheading: 'with domain expertise and experience',
      labels: {
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
    },
    blog: { label: 'Blog', heading: [{ mark: 'Curated' }, ' pieces of information from our experts'], readMore: 'Read more' },
  },

  ar: {
    hero: {
      title: 'بناء أسس قوية للنجاح المستند إلى البيانات',
      subtitle: 'تمكين الشركات بتحليلات مبنية على البيانات، وبنية تحتية قوية، وأمن معلومات متين',
      cta: 'اكتشف الان',
      cards: [
        { title: 'داتا هب انالتكس', text: 'أطلق العنان لفرص نمو قيمة واتخذ قرارات مبنية على البيانات بفضل قدراتنا التحليلية الشاملة.', href: ROUTES.analytics },
        { title: 'خدمات داتا هب للبنية التحتية', text: 'تأكد من التحول الرقمي السلس وعزز أداء أعمالك باستخدام حلول داتا هب للبنية التحتية.', href: ROUTES.infrastructure },
        {
          title: 'خدمات داتا هب لأمن المعلومات',
          text: 'قم بحماية أعمالك من التهديدات السيبرانية تحصين دفاعاتك الرقمية من خلال حلول وخدمات داتا هب لأمن المعلومات.',
          href: ROUTES.security,
        },
      ],
    },
    xaas: [
      {
        abbr: 'DWaaS',
        title: 'مستودع البيانات كخدمة',
        // Verbatim, including the stray "D" at the end on the original.
        text: 'من خلال مركزية تخزين البيانات بسلاسة، وتبسيط التحليلات، والقضاء على الحاجة إلى إدارة البنية التحتية كثيفة الاستخدام للموارد، تعمل مستودع البيانات كخدمة على تمكين المؤسسات من التركيز على الابتكار والعمليات التجارية الأساسية.D',
        href: ROUTES.dwaas,
        cta: 'اقرأ المزيد',
      },
      {
        abbr: 'DAaaS',
        title: 'تحليل البيانات كخدمة',
        text: 'من خلال مزيج من أحدث التقنيات والخوارزميات المتقدمة والواجهة سهلة الاستخدام، تعمل داتا هب انالتكس على تمكين المؤسسات من التحليل بسهولة واستخلاص رؤى قابلة للتنفيذ من بياناتها دون القلق بشأن البنية التحتية.',
        href: ROUTES.daaas,
        cta: 'اقرأ المزيد',
      },
    ],
    about: {
      label: 'حيث يزدهر الابتكار',
      heading: 'إعادة تعريف الإمكانيات مع داتا هب أناليتكس',
      tagline: 'معًا، نتصور مستقبلًا حيث تمهّد التحليلات المبنية على البيانات وأمن المعلومات القوي الطريق للمؤسسات للنجاح في المناظر الرقمية المتطورة باستمرار.',
      paragraphs: [
        'في داتا هب أناليتكس، نكرس جهودنا لتمكين الشركات من خلال حلول تحليلات البيانات، والبنية التحتية، وأمن المعلومات المبتكرة. يجلب فريقنا من الخبراء ثروة من المعرفة والخبرة لمساعدة المؤسسات في استغلال قوة البيانات، واتخاذ القرارات المستنيرة، وتحسين الإمكانيات الرقمية لديهم. بتوجهنا المتمحور حول العميل، نتعاون عن كثب مع عملائنا لفهم تحدياتهم الفريدة وتقديم حلول مصممة خصيصًا تمنحهم النمو والنجاح.',
        'من خلال التزامنا الثابت بالجودة والسرية والنزاهة، نولي أمن بيانات عملائنا والملكية الفكرية أولوية قصوى. عملياتنا المبسطة والتركيز على البساطة تضمن تنفيذ المشاريع بسلاسة، مما يوفر قيمة عملية حقيقية في كل مرحلة. في داتا هب أناليتكس، نزدهر في الابتكار، ونسعى باستمرار للبقاء في صدارة التكنولوجيا وتقديم نتائج استثنائية.',
      ],
      brochure: { label: 'تحميل الكتيب', href: '/assets/docs/datahub-analytics-company-profile.pdf' },
      videoAlt: 'intro-video-thumb',
    },
    stats: {
      heading: [{ mark: 'قصص النجاح' }],
      highlight: '110+',
      highlightLabel: 'سنة من الخبرات المجتمعة',
      counters: [
        { value: 60, suffix: '+', label: 'مشروعًا ناجحًا' },
        { value: 15, suffix: 'K+', label: 'لوحة تحليلية' },
        { value: 22, suffix: '', label: 'أداة وتقنية' },
      ],
    },
    solutions: {
      label: 'خدمات داتا هب أناليتكس',
      heading: 'صياغة النجاح من خلال الخبرة والتجربة',
      tabs: [
        {
          title: 'خدمات داتا هب لتحليل البيانات',
          text: 'نحن متخصصون في تقديم حلول تحليلات البيانات المتقدمة المصممة خصيصًا لتلبية الاحتياجات الفريدة لشركتك. يتفوق فريقنا من المحترفين ذوي المهارات العالية في النمذجة التنبؤية والتعلم الآلي وتصور البيانات واستخراج البيانات. ومن خلال الاستفادة من خبراتهم وتجاربهم الصناعية، يقومون بتحويل البيانات الأولية إلى رؤى قابلة للتنفيذ تؤدي إلى نتائج أعمال ملموسة.',
          items: [
            { label: 'حلول البيانات الضخمة', href: ROUTES.bigData },
            { label: 'مستودع البيانات الحديث', href: ROUTES.modernDataWarehouse },
            { label: 'تصوير المعلومات', href: ROUTES.dataVisualization },
            { label: 'علم البيانات', href: ROUTES.dataScience },
            { label: 'ذكاء الأعمال', href: ROUTES.businessIntelligence },
            { label: 'أتمتة العمليات الروبوتية RPA', href: ROUTES.rpa },
          ],
          viewAll: { label: 'عرض الكل', href: ROUTES.analytics },
        },
        {
          title: 'خدمات داتاهب للبنية التحتية',
          text: 'يتخصص فريقنا من الخبراء ذوي المهارات العالية في تصميم وتحسين البنى التحتية للبيانات، وضمان إمكانية الوصول إلى البيانات والأمن وقابلية التوسع. وبالتركيز على الابتكار وأفضل الممارسات في القطاع، نقدم حلول البنية التحتية المتقدمة التي تمكن الشركات من تحقيق أهدافها بكفاءة وفعالية.',
          items: [
            { label: 'البنية التحتية للبيانات الضخمة', href: ROUTES.bigDataInfrastructure },
            { label: 'البنية التحتية للحاويات', href: ROUTES.containerizedInfrastructure },
            { label: 'البنية التحتية لـ DevOps', href: ROUTES.devopsInfrastructure },
            { label: 'البنية التحتية السحابية الهجينة', href: ROUTES.hybridCloudInfrastructure },
            { label: 'البنية التحتية المدارة', href: ROUTES.managedInfrastructure },
          ],
          viewAll: { label: 'عرض الكل', href: ROUTES.infrastructure },
        },
        {
          title: 'خدمات داتا هب لأمن المعلومات',
          text: 'نحن متخصصون في تقديم خدمات الأمن السيبراني الشاملة لحماية مؤسستكم من التهديدات المتطورة، حيث يتفوق فريقنا من خبراء الأمن السيبراني في الكشف عن التهديدات والاستجابة للحوادث وتقييم الثغرات وتصميم البنية الأمنية. وبالاستفادة من معرفتنا العميقة وخبرتنا في القطاع، فإننا نحمي دفاعاتكم ونحرص على أن تظل أصولكم آمنة وسرية.',
          items: [
            { label: 'استشارات الأمن السيبراني', href: ROUTES.cybersecurityAdvisory },
            { label: 'تقييمات الأمن السيبراني', href: ROUTES.cybersecurityAssessments },
            { label: 'الحوكمة، والمخاطر والامتثال', href: ROUTES.governanceRiskCompliance },
            { label: 'إطار إدارة البيانات (داما)', href: ROUTES.dataManagementFramework },
            { label: 'حوكمة البيانات', href: ROUTES.dataGovernance },
          ],
          viewAll: { label: 'عرض الكل', href: ROUTES.security },
        },
      ],
    },
    technologies: {
      label: 'التقنيات والأدوات المستخدمة',
      heading: [{ mark: 'تميز عن منافسيك' }],
      viewAll: { label: 'عرض الكل', href: ROUTES.tools },
    },
    industries: {
      heading: [{ mark: 'قطاعات خبرتنا' }],
      subheading: 'مع خبرة المجال والتجربة',
      labels: {
        gov: 'الخدمات الحكومية',
        banking: 'البنوك',
        ports: 'الموانئ',
        supplychain: 'سلسلة التوريد',
        manufacturing: 'التصنيع',
        aviation: 'الطيران',
        retail: 'التجزئة',
        tele: 'الاتصالات',
        edu: 'التعليم',
        sports: 'إدارة الرياضة',
      },
    },
    // The Arabic homepage lists the (English-only) posts with an English "Read more".
    blog: { label: 'مدونة', heading: [{ mark: 'معلومات مختارة من خبرائنا' }], readMore: 'Read more' },
  },
};
