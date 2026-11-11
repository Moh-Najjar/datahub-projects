import Button, { type ButtonProps } from '@mui/material/Button';
import EastIcon from '@mui/icons-material/East';
import { useTheme } from '@mui/material/styles';
import { SmartLink } from '../SmartLink/SmartLink';

export type ButtonLinkProps = Omit<ButtonProps<typeof SmartLink>, 'component'>;

/**
 * MUI `Button` rendered as a router-aware link. Use the theme's custom variants:
 * `solid`, `gradient`, `textArrow` (adds the "→" arrow) and `pill`.
 */
export function ButtonLink({ variant = 'solid', endIcon, sx, ...rest }: ButtonLinkProps) {
  const { direction } = useTheme();
  const arrow =
    variant === 'textArrow' ? (
      <EastIcon sx={{ fontSize: '16px !important', transform: direction === 'rtl' ? 'scaleX(-1)' : undefined }} />
    ) : (
      endIcon
    );

  return <Button component={SmartLink} variant={variant} endIcon={arrow} sx={sx} {...rest} />;
}
