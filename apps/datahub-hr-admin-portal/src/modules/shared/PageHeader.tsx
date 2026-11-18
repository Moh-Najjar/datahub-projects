import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/** Page title (the page's only h1), optional subtitle and the page's primary actions. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: { xs: 'stretch', sm: 'flex-end' },
        justifyContent: 'space-between',
        gap: 2,
        mb: 2.5,
      }}
    >
      <Box sx={{ minWidth: 0, flex: '1 1 240px' }}>
        <Typography variant="h3" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>{actions}</Box>
      )}
    </Box>
  );
}
