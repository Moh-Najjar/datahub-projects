import { use } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import FacebookIcon from '@mui/icons-material/Facebook';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import XIcon from '@mui/icons-material/X';
import { useParams } from 'react-router-dom';
import { LinkedInIcon } from '@/shared/components/ui/LinkedInIcon';
import { Seo, SITE_URL } from '@/shared/components/seo/Seo';
import { SmartLink } from '@/shared/components/ui/SmartLink';
import { type BlogPostSummary, formatPostDate, loadBlogBody, loadBlogIndex } from '@/features/blog';
import { useLocale } from '@/i18n/LocaleContext';
import NotFoundPage from '../Errors/NotFoundPage';

/** Typography for the article body (WordPress content styles of the original theme). */
const articleSx = {
  '& p': { mb: '1.5em' },
  '& h2': { mt: '40px', mb: '18px', fontSize: { xs: 30, md: 42 }, lineHeight: 1.42, color: 'brand.heading' },
  '& h3': { mt: '32px', mb: '18px', fontSize: { xs: 24, md: 32 }, lineHeight: 1.42, color: 'brand.heading' },
  '& h4, & h5, & h6': { mt: '24px', mb: '14px', color: 'brand.heading' },
  '& ul': { listStyle: 'disc', pl: '20px', mb: '1.5em' },
  '& ol': { listStyle: 'decimal', pl: '20px', mb: '1.5em' },
  '& li': { mb: '8px' },
  '& strong, & b': { color: 'brand.heading' },
  '& a': { color: 'info.main', textDecoration: 'underline' },
  '& blockquote': { m: '30px 0', pl: '20px', borderLeft: '4px solid', borderColor: 'info.main', fontSize: 18, color: 'brand.heading' },
  '& img': { maxWidth: '100%', height: 'auto', borderRadius: '5px' },
  '& table': { width: '100%', mb: '1.5em', borderCollapse: 'collapse' },
  '& th, & td': { p: '10px', border: '1px solid #ededed', textAlign: 'left' },
  '& hr': { my: '30px', border: 0, borderTop: '1px solid #ededed' },
} as const;

function NavCard({ post, label, align }: { post: BlogPostSummary; label: string; align: 'left' | 'right' }) {
  return (
    <Box
      component={SmartLink}
      href={`/${post.slug}/`}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: 120,
        p: '20px 30px',
        overflow: 'hidden',
        borderRadius: '5px',
        textAlign: align,
        color: 'common.white',
        bgcolor: 'brand.dark',
        backgroundImage: post.image ? `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.55)), url(${post.image.grid})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        '&:hover': { color: 'common.white', opacity: 0.92 },
      }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px', color: 'inherit', opacity: 0.8 }}>{label}</Typography>
      <Typography sx={{ mt: '6px', fontSize: 16, fontWeight: 500, lineHeight: 1.4, color: 'inherit' }}>{post.title}</Typography>
    </Box>
  );
}

/** Single blog post (`/<slug>/`) — content exported from the original WordPress site. */
export default function BlogPostPage() {
  const { slug = '' } = useParams();
  const { locale } = useLocale();
  const index = use(loadBlogIndex());
  const body = use(loadBlogBody(slug));
  const position = index.findIndex((p) => p.slug === slug);
  const post = index[position];
  if (!post || !body) return <NotFoundPage />;

  const newer = index[position - 1];
  const older = index[position + 1];
  const url = `${SITE_URL}/${post.slug}/`;
  const share = [
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, Icon: FacebookIcon },
    { label: 'X', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}`, Icon: XIcon },
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, Icon: LinkedInIcon },
    { label: 'Email', href: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(url)}`, Icon: EmailOutlinedIcon },
  ];

  return (
    <>
      <Seo title={`${post.title} Datahub Analytics`} description={post.excerpt} path={`/${post.slug}/`} image={post.image?.large} type="article" locales={['en']} />
      <Box component="article" dir="ltr" sx={{ pt: { xs: '60px', md: '120px' }, pb: '100px' }}>
        <Container>
          {post.image && (
            <Box
              component="img"
              src={post.image.large}
              alt={post.image.alt || post.title}
              width={post.image.width || undefined}
              height={post.image.height || undefined}
              decoding="async"
              sx={{ display: 'block', width: '100%', height: 'auto', borderRadius: '5px' }}
            />
          )}
          <Box sx={{ maxWidth: 800, mx: 'auto', px: '15px', mt: '40px' }}>
            <Box component="header" sx={{ textAlign: 'center' }}>
              {post.categories.length > 0 && (
                <Typography sx={{ color: 'brand.green', fontSize: 14, fontWeight: 500, textTransform: 'uppercase', '& span + span::before': { content: '" | "', color: 'text.primary', mx: '6px' } }}>
                  {post.categories.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </Typography>
              )}
              <Typography variant="h1" sx={{ mt: '12px', mb: '16px', fontSize: { xs: 28, md: 40 }, lineHeight: 1.4 }}>
                {post.title}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 16px', fontSize: 14 }}>
                {post.author && (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <PersonOutlineOutlinedIcon sx={{ fontSize: 16 }} />
                    {post.author}
                  </Box>
                )}
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <CalendarTodayOutlinedIcon sx={{ fontSize: 14 }} />
                  <time dateTime={post.date}>{formatPostDate(post.date, locale)}</time>
                </Box>
              </Box>
            </Box>

            <Box sx={{ mt: '50px', ...articleSx }} dangerouslySetInnerHTML={{ __html: body.html }} />

            <Box component="footer" sx={{ mt: '50px', pt: '30px', borderTop: '1px solid #ededed', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
              {post.tags.length > 0 && (
                <Box sx={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: '1 1 300px' }}>
                  <LocalOfferOutlinedIcon sx={{ fontSize: 16, mt: '3px', color: 'brand.footerLink' }} />
                  <Typography component="ul" sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', color: 'brand.footerLink', fontSize: 13, fontWeight: 500 }}>
                    {post.tags.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Typography sx={{ fontWeight: 500 }}>Share this post</Typography>
                {share.map(({ label, href, Icon }) => (
                  <IconButton key={label} component="a" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${label}`} sx={{ color: 'text.primary', '&:hover': { color: 'info.main' } }}>
                    <Icon sx={{ fontSize: 18 }} />
                  </IconButton>
                ))}
              </Box>
            </Box>

            {(older || newer) && (
              <Box component="nav" aria-label="Post navigation" sx={{ mt: '50px', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '30px' }}>
                <Box>{older && <NavCard post={older} label="Prev" align="left" />}</Box>
                <Box>{newer && <NavCard post={newer} label="Next" align="right" />}</Box>
              </Box>
            )}
          </Box>
        </Container>
      </Box>
    </>
  );
}
