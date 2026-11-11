import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { SmartLink } from '@/shared/components/ui/SmartLink';
import type { NavColumn } from '@/shared/types/navigation';
import { DropdownPanel, subLinkSx } from '../Navigation/DesktopNav.styles';

interface MegaMenuProps {
  columns: NavColumn[];
  open: boolean;
  onNavigate: () => void;
}

/** "Solutions & Services" mega menu: one column per service category, spanning the container. */
export function MegaMenu({ columns, open, onNavigate }: MegaMenuProps) {
  return (
    <DropdownPanel
      open={open}
      sx={{ left: 15, right: 15, pt: '37px', pb: '40px', px: '32px', boxShadow: (t) => t.customShadows.mega }}
    >
      <Grid container columns={columns.length}>
        {columns.map((col) => (
          <Grid key={col.title} size={1} sx={{ px: '15px' }}>
            <Typography
              component="h2"
              sx={{ mb: '13px', color: 'brand.heading', fontSize: 14, fontWeight: 700, lineHeight: 1.42, textTransform: 'uppercase' }}
            >
              {col.title}
            </Typography>
            <Box component="ul">
              {[...col.links, col.more].map((link) => (
                <li key={link.href + link.label}>
                  <Box component={SmartLink} href={link.href} onClick={onNavigate} sx={subLinkSx}>
                    <span className="sub-label">{link.label}</span>
                  </Box>
                </li>
              ))}
            </Box>
          </Grid>
        ))}
      </Grid>
    </DropdownPanel>
  );
}
