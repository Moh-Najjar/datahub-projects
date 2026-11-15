import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { SmartLink } from '@/modules/shared/SmartLink';

/** Same shape as a page document's `titleBar`. */
interface TitleBarData {
  title: string;
  crumbs: Array<{ label: string; href?: string }>;
}

/** Theme "page-title-bar-01": beige band with the dotted globe, big blue title and breadcrumb. */
export function PageTitleBar({ data }: { data: TitleBarData }) {
  return (
    <Box
      component="section"
      sx={{
        pt: { xs: '80px', md: '110px', xl: '136px' },
        pb: { xs: '75px', md: '105px', xl: '131px' },
        bgcolor: '#f6f2ed',
        backgroundImage: 'url(/assets/backgrounds/title-bar.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        textAlign: 'center',
      }}
    >
      <Container>
        <Typography variant="h1" sx={{ color: '#002fa6', fontSize: { xs: 34, md: 44, lg: 54, xl: 64 }, fontWeight: 700, lineHeight: 1.13 }}>
          {data.title}
        </Typography>
        <Breadcrumbs
          aria-label="breadcrumb"
          separator="/"
          sx={{ mt: '21px', '& .MuiBreadcrumbs-ol': { justifyContent: 'center' }, '& li, & a': { color: 'brand.heading', fontSize: { xs: 18, md: 24 }, fontWeight: 500, lineHeight: 1.67 } }}
        >
          {data.crumbs.map((c) =>
            c.href ? (
              <Box key={c.label} component={SmartLink} href={c.href} sx={{ '&:hover': { color: 'primary.main' } }}>
                {c.label}
              </Box>
            ) : (
              <span key={c.label} aria-current="page">
                {c.label}
              </span>
            ),
          )}
        </Breadcrumbs>
      </Container>
    </Box>
  );
}
