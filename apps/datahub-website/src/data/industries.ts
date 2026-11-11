import type { SvgIconComponent } from '@mui/icons-material';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import CellTowerOutlinedIcon from '@mui/icons-material/CellTowerOutlined';
import DirectionsBoatOutlinedIcon from '@mui/icons-material/DirectionsBoatOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import FlightTakeoffOutlinedIcon from '@mui/icons-material/FlightTakeoffOutlined';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import SportsEsportsOutlinedIcon from '@mui/icons-material/SportsEsportsOutlined';
import type { IndustryId } from './navigation';

/**
 * Industry icons. The original uses Font Awesome 5 Pro *Light* icons (licensed); each is mapped
 * to the closest outlined Material icon:
 * globe, landmark, ship, truck, industry-alt, plane-departure, shopping-cart,
 * broadcast-tower, book-reader, gamepad.
 */
export const INDUSTRY_ICONS: Record<IndustryId, SvgIconComponent> = {
  gov: LanguageOutlinedIcon,
  banking: AccountBalanceOutlinedIcon,
  ports: DirectionsBoatOutlinedIcon,
  supplychain: LocalShippingOutlinedIcon,
  manufacturing: FactoryOutlinedIcon,
  aviation: FlightTakeoffOutlinedIcon,
  retail: ShoppingCartOutlinedIcon,
  tele: CellTowerOutlinedIcon,
  edu: MenuBookOutlinedIcon,
  sports: SportsEsportsOutlinedIcon,
};
