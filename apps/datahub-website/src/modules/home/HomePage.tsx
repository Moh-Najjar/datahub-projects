import { PageSeo } from '@/shared/components/seo/PageSeo';
import {
  AboutSection,
  BlogSection,
  HeroSection,
  HOME_CONTENT,
  IndustriesSection,
  SolutionsSection,
  StatsSection,
  TechnologiesSection,
  XaasSection,
} from '@/features/home';
import { useLocalized } from '@/i18n/LocaleContext';

/** Homepage — sections in the original's order. Consultation, form and footer come from the layout. */
export default function HomePage() {
  const content = useLocalized(HOME_CONTENT);
  return (
    <>
      <PageSeo routeKey="home" />
      <HeroSection content={content.hero} />
      <XaasSection cards={content.xaas} />
      <AboutSection content={content.about} />
      <StatsSection content={content.stats} />
      <SolutionsSection content={content.solutions} />
      <TechnologiesSection content={content.technologies} />
      <IndustriesSection content={content.industries} />
      <BlogSection content={content.blog} />
    </>
  );
}
