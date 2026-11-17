import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

/** Loading state of an admin page. */
export function PageLoading() {
  return (
    <Box role="status" aria-label="Loading" sx={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
      <CircularProgress size={32} />
    </Box>
  );
}
