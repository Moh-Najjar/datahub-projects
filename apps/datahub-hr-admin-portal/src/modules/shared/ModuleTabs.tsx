import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { Link } from 'react-router-dom';

export interface ModuleTab<T extends string> {
  key: T;
  to: string;
  label: string;
}

/**
 * Section navigation shared by every HR module. Scroll buttons stay off: MUI's automatic
 * detection misfires in RTL, while swipe and keyboard scrolling still work.
 */
export function ModuleTabs<T extends string>({ label, value, tabs }: { label: string; value: T | false; tabs: readonly ModuleTab<T>[] }) {
  return (
    <Box component="nav" aria-label={label} sx={{ mb: 3 }}>
      <Tabs value={value} variant="scrollable" scrollButtons={false} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        {tabs.map((item) => (
          <Tab
            key={item.key}
            value={item.key}
            label={item.label}
            component={Link}
            to={item.to}
            aria-current={item.key === value ? 'page' : undefined}
          />
        ))}
      </Tabs>
    </Box>
  );
}
