import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import { useColorScheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

/** Light/dark switch. MUI remembers the choice (see `COLOR_MODE_STORAGE_KEY`); light is the default. */
export function ThemeModeSwitcher() {
  const { t } = useTranslation();
  const { mode, systemMode, setMode } = useColorScheme();
  const isDark = (mode === 'system' ? systemMode : mode) === 'dark';
  const label = isDark ? t('theme.switchToLight') : t('theme.switchToDark');

  return (
    <Tooltip title={label}>
      <IconButton color="inherit" aria-label={label} onClick={() => setMode(isDark ? 'light' : 'dark')}>
        {isDark ? <LightModeOutlined /> : <DarkModeOutlined />}
      </IconButton>
    </Tooltip>
  );
}
