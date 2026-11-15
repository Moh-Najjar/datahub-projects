import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { ButtonLink } from '@/modules/shared/ButtonLink';
import { Seo } from '@/modules/shared/Seo';
import { ROUTES } from '@/core/routes/paths';
import { useLocalized } from '@/i18n/LocaleContext';
import { UI } from '@/i18n';

export default function NotFoundPage() {
  const ui = useLocalized(UI);
  return (
    <>
      <Seo title={`${ui.notFound.title} - Datahub Analytics`} path="/404/" />
      <meta name="robots" content="noindex" />
      <Container sx={{ py: '150px', textAlign: 'center' }}>
        <Typography variant="h1" component="h1" sx={{ mb: '20px' }}>
          {ui.notFound.title}
        </Typography>
        <Typography sx={{ mb: '40px' }}>{ui.notFound.text}</Typography>
        <ButtonLink href={ROUTES.home}>{ui.notFound.backHome}</ButtonLink>
      </Container>
    </>
  );
}
