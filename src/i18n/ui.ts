import type { Localized } from './types';

/**
 * Interface strings shared across the site (header, footer, form, buttons).
 * Page-specific copy lives in `src/content`.
 */
export interface UiStrings {
  siteName: string;
  skipToContent: string;
  openMenu: string;
  closeMenu: string;
  toggleSubmenu: string;
  languageName: string;
  /** Label used in the footer language bar, e.g. "العربية (Arabic)". */
  languageBarLabel: string;
  consultation: {
    heading: string;
    callLabel: string;
    emailLabel: string;
  };
  appointment: {
    title: string;
    description: string;
    name: string;
    email: string;
    inquiry: string;
    inquiryOptions: string[];
    submit: string;
    sending: string;
  };
  validation: {
    required: string;
    email: string;
    summary: string;
  };
  submission: {
    notConfigured: string;
    success: string;
    failure: string;
  };
  footer: {
    connect: string;
    phone: string;
    copyright: string;
  };
  readMore: string;
  viewAll: string;
  discoverNow: string;
  playVideo: string;
  closeVideo: string;
  notFound: {
    title: string;
    text: string;
    backHome: string;
  };
}

export const UI: Localized<UiStrings> = {
  en: {
    siteName: 'Datahub Analytics',
    skipToContent: 'Skip to content',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    toggleSubmenu: 'Toggle submenu',
    languageName: 'English',
    languageBarLabel: 'English',
    consultation: {
      heading: 'Book a free consultation with our technology experts.',
      callLabel: 'Call for advice now!',
      emailLabel: 'Say hello',
    },
    appointment: {
      title: 'Book appointment',
      description: "Let's collaborate.",
      name: 'Name*',
      email: 'Email*',
      inquiry: 'Your inquiry about*',
      inquiryOptions: ['Datahub Analytics', 'Datahub Infrastructure', 'Datahub Security'],
      submit: 'Submit',
      sending: 'Sending…',
    },
    validation: {
      required: 'Please fill out this field.',
      email: 'Please enter an email address.',
      summary: 'One or more fields have an error. Please check and try again.',
    },
    submission: {
      notConfigured:
        'Your message was not sent: this site has no form backend configured yet. Please email info@datahubanalytics.com or call (+962) 78 1005100.',
      success: 'Thank you for your message. It has been sent.',
      failure: 'There was an error trying to send your message. Please try again later.',
    },
    footer: {
      connect: 'Connect With Us',
      phone: 'Phone',
      copyright: '© 2023 Datahub Analytics. All Rights Reserved',
    },
    readMore: 'Read More',
    viewAll: 'View All',
    discoverNow: 'Discover now',
    playVideo: 'Play video',
    closeVideo: 'Close video',
    notFound: {
      title: 'Page not found',
      text: 'The page you are looking for does not exist or has been moved.',
      backHome: 'Go back to homepage',
    },
  },
  ar: {
    siteName: 'داتا هب أناليتكس',
    skipToContent: 'تخطي إلى المحتوى',
    openMenu: 'فتح القائمة',
    closeMenu: 'إغلاق القائمة',
    toggleSubmenu: 'عرض القائمة الفرعية',
    languageName: 'العربية',
    languageBarLabel: 'العربية (Arabic)',
    consultation: {
      heading: 'احجز استشارة مجانية مع خبير الحلول.',
      callLabel: 'إتصل للحصول على الاستشارة الآن!',
      emailLabel: 'تواصل معنا',
    },
    appointment: {
      title: 'احجز موعد معنا',
      description: 'لنتعاون معا',
      name: 'الاسم*',
      email: 'البريد الالكتروني*',
      inquiry: 'استفسارك عن*',
      inquiryOptions: ['داتا هب انالتكس', 'داتا هب انالتكس للبنية التحتية', 'داتا هب انالتكس لأمن المعلومات'],
      submit: 'احصل على استشارة مجانية',
      sending: 'جارٍ الإرسال…',
    },
    validation: {
      required: 'يرجى ملء هذا الحقل.',
      email: 'يرجى إدخال عنوان بريد إلكتروني.',
      summary: 'حقل واحد أو أكثر به خطأ. يرجى المراجعة والمحاولة مرة أخرى.',
    },
    submission: {
      notConfigured:
        'لم يتم إرسال رسالتك: لم يتم ربط هذا الموقع بخادم لاستقبال النماذج بعد. يرجى مراسلتنا على info@datahubanalytics.com أو الاتصال على (+962) 78 1005100.',
      success: 'شكرًا لك على رسالتك. تم الإرسال بنجاح.',
      failure: 'حدث خطأ أثناء إرسال رسالتك. يرجى المحاولة لاحقًا.',
    },
    footer: {
      connect: 'تواصل معنا',
      phone: 'هاتف',
      copyright: '© 2023 داتا هب أناليتكس. جميع الحقوق محفوظة',
    },
    readMore: 'اقرأ المزيد',
    viewAll: 'عرض الكل',
    discoverNow: 'اكتشف الان',
    playVideo: 'تشغيل الفيديو',
    closeVideo: 'إغلاق الفيديو',
    notFound: {
      title: 'الصفحة غير موجودة',
      text: 'الصفحة التي تبحث عنها غير موجودة أو تم نقلها.',
      backHome: 'العودة إلى الصفحة الرئيسية',
    },
  },
};
