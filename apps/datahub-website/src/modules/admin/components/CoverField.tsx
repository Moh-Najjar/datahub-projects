import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { useBlogImageLibrary } from '@/core/hooks/useAdminBlogs';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';

const C = ADMIN_TEXT.cover;

/** The collection: images already used by posts, searchable by post title; a click picks one. */
function LibraryDialog({ selected, onPick, onClose }: { selected: string; onPick: (url: string) => void; onClose: () => void }) {
  const library = useBlogImageLibrary(true);
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const images = (library.data ?? []).filter((image) => !q || image.title.toLowerCase().includes(q));

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>{C.libraryTitle}</DialogTitle>
      <DialogContent dividers>
        <TextField
          size="small"
          fullWidth
          type="search"
          label={C.librarySearch}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
        {library.status === 'pending' ? (
          <Box role="status" aria-label={C.libraryLoading} sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : library.status === 'error' ? (
          <Alert severity="error" action={<Button color="inherit" onClick={() => void library.refetch()}>{ADMIN_TEXT.list.retry}</Button>}>
            {C.libraryError}
          </Alert>
        ) : images.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {C.libraryEmpty}
          </Typography>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px' }}>
            {images.map((image) => (
              <li key={image.url}>
                <ButtonBase
                  onClick={() => onPick(image.url)}
                  aria-label={image.title}
                  aria-pressed={image.url === selected}
                  title={image.title}
                  sx={{
                    display: 'block',
                    width: '100%',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    outline: image.url === selected ? '3px solid' : 'none',
                    outlineColor: 'primary.main',
                    '&:hover img, &:focus-visible img': { opacity: 0.85 },
                  }}
                >
                  <Box component="img" src={image.url} alt="" loading="lazy" width={370} height={230} sx={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '370 / 230', objectFit: 'cover', bgcolor: 'background.default' }} />
                </ButtonBase>
              </li>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>{C.close}</Button>
      </DialogActions>
    </Dialog>
  );
}

interface CoverFieldProps {
  /** The featured image's https:// address, or `''` for none. */
  value: string;
  onChange: (url: string) => void;
  onBlur: () => void;
  error?: string;
}

/**
 * Featured image: pick one from the collection (images already used by posts) or enter the address of an image that is
 * online (the backend stores a URL — `featuredImageUrl` — and has no upload endpoint yet). Preview as on the blog cards.
 */
export function CoverField({ value, onChange, onBlur, error }: CoverFieldProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const [library, setLibrary] = useState(false);
  const url = value.trim();
  const showPreview = /^https:\/\/\S+$/i.test(url) && !error;

  return (
    <Box sx={{ display: 'grid', gap: '12px' }}>
      {showPreview && failed !== url ? (
        <Box>
          <Box
            component="img"
            src={url}
            alt=""
            onError={() => setFailed(url)}
            sx={{ display: 'block', width: '100%', aspectRatio: '370 / 230', objectFit: 'cover', borderRadius: '8px', bgcolor: 'background.default' }}
          />
          <Typography variant="caption" color="text.secondary">
            {C.preview}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', placeItems: 'center', aspectRatio: '370 / 230', borderRadius: '8px', border: '1px dashed', borderColor: 'divider', bgcolor: 'background.default', p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color={showPreview ? 'error' : 'text.secondary'}>
            {showPreview ? C.loadFailed : C.none}
          </Typography>
        </Box>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button size="small" variant="outlined" startIcon={<CollectionsOutlinedIcon />} onClick={() => setLibrary(true)} sx={{ height: 34, px: 1.5 }}>
          {C.choose}
        </Button>
        {value && (
          <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => onChange('')} sx={{ height: 34, px: 1.5 }}>
            {C.remove}
          </Button>
        )}
      </Box>
      <TextField
        size="small"
        label={C.urlLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        error={Boolean(error)}
        helperText={error ?? C.urlHelp}
        slotProps={{ htmlInput: { dir: 'ltr', spellCheck: false, inputMode: 'url' } }}
      />
      {library && (
        <LibraryDialog
          selected={url}
          onClose={() => setLibrary(false)}
          onPick={(picked) => {
            onChange(picked);
            setLibrary(false);
          }}
        />
      )}
    </Box>
  );
}
