import { PageSeo } from '@/components/common/Seo/PageSeo';
import { HOME_CONTENT } from '@/content/home';
import { useLocalized } from '@/i18n/LocaleContext';
import { AboutSection } from '@/sections/home/AboutSection';
import { BlogSection } from '@/sections/home/BlogSection';
import { HeroSection } from '@/sections/home/HeroSection';
import { IndustriesSection } from '@/sections/home/IndustriesSection';
import { SolutionsSection } from '@/sections/home/SolutionsSection';
import { StatsSection } from '@/sections/home/StatsSection';
import { TechnologiesSection } from '@/sections/home/TechnologiesSection';
import { XaasSection } from '@/sections/home/XaasSection';

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
