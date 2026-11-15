import { PageSeo } from '@/modules/shared/PageSeo';
import { AboutSection } from '@/modules/home/components/AboutSection';
import { BlogSection } from '@/modules/home/components/BlogSection';
import { HeroSection } from '@/modules/home/components/HeroSection';
import { IndustriesSection } from '@/modules/home/components/IndustriesSection';
import { SolutionsSection } from '@/modules/home/components/SolutionsSection';
import { StatsSection } from '@/modules/home/components/StatsSection';
import { TechnologiesSection } from '@/modules/home/components/TechnologiesSection';
import { XaasSection } from '@/modules/home/components/XaasSection';
import { HOME_CONTENT } from '@/modules/home/data/homeContent';
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
