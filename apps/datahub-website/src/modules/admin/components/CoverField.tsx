import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import LinkIcon from '@mui/icons-material/Link';
import { getCoverLibrary, type BlogCover } from '@/modules/blog';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { ImagePrepareError, isImageUrl, measureImage, prepareUpload } from '@/modules/admin/utils/image';

const C = ADMIN_TEXT.cover;

type Library = Awaited<ReturnType<typeof getCoverLibrary>>;

function LibraryDialog({ onPick, onClose }: { onPick: (cover: BlogCover) => void; onClose: () => void }) {
  const [items, setItems] = useState<Library | null>(null);
  useEffect(() => {
    let active = true;
    void getCoverLibrary().then((list) => active && setItems(list));
    return () => {
      active = false;
    };
  }, []);
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ color: 'brand.heading' }}>{C.libraryTitle}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {C.librarySearchHint}
        </Typography>
        {!items ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box component="ul" sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
            {items.map((item) => (
              <li key={item.src}>
                <ButtonBase
                  onClick={() => onPick({ src: item.src, alt: item.alt, width: item.width, height: item.height })}
                  aria-label={item.alt}
                  sx={{ display: 'block', width: '100%', borderRadius: '4px', overflow: 'hidden', outlineOffset: 2, '&:hover img, &:focus-visible img': { opacity: 0.8 } }}
                >
                  <Box component="img" src={item.thumbnail} alt="" loading="lazy" width={370} height={207} sx={{ width: '100%', height: 'auto', aspectRatio: '370 / 207', objectFit: 'cover' }} />
                </ButtonBase>
              </li>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ height: 40, px: 2 }}>
          {C.close}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface CoverFieldProps {
  value: BlogCover | null;
  onChange: (cover: BlogCover | null) => void;
  altError?: string;
}

/** Cover image: upload (resized in the browser), an image address, or a cover of an existing post; plus its alt text. */
export function CoverField({ value, onChange, altError }: CoverFieldProps) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [urlMode, setUrlMode] = useState(false);
  const [url, setUrl] = useState('');
  const [library, setLibrary] = useState(false);

  const applyImage = (image: { src: string; width: number; height: number }) => {
    onChange({ ...image, alt: value?.alt ?? '' });
    setError(undefined);
  };

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError(undefined);
    try {
      applyImage(await prepareUpload(f));
    } catch (e) {
      setError(e instanceof ImagePrepareError ? C[e.reason] : C.loadFailed);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  };

  const applyUrl = async () => {
    if (!isImageUrl(url)) return setError(C.invalidUrl);
    setBusy(true);
    try {
      applyImage(await measureImage(url.trim()));
      setUrlMode(false);
      setUrl('');
    } catch {
      setError(C.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: '12px' }}>
      {value ? (
        <Box>
          <Box component="img" src={value.src} alt={value.alt} sx={{ display: 'block', width: '100%', aspectRatio: '370 / 230', objectFit: 'cover', borderRadius: '5px', bgcolor: '#eee' }} />
          <Typography variant="caption" color="text.secondary">
            {C.preview}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', placeItems: 'center', aspectRatio: '370 / 230', borderRadius: '5px', border: '1px dashed', borderColor: 'divider', bgcolor: '#fafbfc', p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {busy ? C.processing : C.none}
          </Typography>
        </Box>
      )}
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void upload(e.target.files?.[0])} />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button size="small" variant="outlined" startIcon={busy ? <CircularProgress size={14} /> : <CloudUploadOutlinedIcon />} disabled={busy} onClick={() => file.current?.click()} sx={{ height: 34, px: 1.5 }}>
          {C.upload}
        </Button>
        <Button size="small" variant="outlined" startIcon={<CollectionsOutlinedIcon />} disabled={busy} onClick={() => setLibrary(true)} sx={{ height: 34, px: 1.5 }}>
          {C.choose}
        </Button>
        <Button size="small" variant="outlined" startIcon={<LinkIcon />} disabled={busy} onClick={() => setUrlMode((m) => !m)} aria-expanded={urlMode} sx={{ height: 34, px: 1.5 }}>
          {C.fromUrl}
        </Button>
        {value && (
          <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} disabled={busy} onClick={() => onChange(null)} sx={{ height: 34, px: 1.5 }}>
            {C.remove}
          </Button>
        )}
      </Box>
      {urlMode && (
        <Box sx={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <TextField
            size="small"
            fullWidth
            label={C.urlLabel}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void applyUrl();
              }
            }}
            helperText={C.urlHelp}
            slotProps={{ htmlInput: { dir: 'ltr' } }}
          />
          <Button variant="contained" disabled={busy || !url.trim()} onClick={() => void applyUrl()} sx={{ height: 40, px: 1.5, flexShrink: 0 }}>
            {C.apply}
          </Button>
        </Box>
      )}
      {error && <FormHelperText error>{error}</FormHelperText>}
      {value && (
        <TextField
          size="small"
          label={ADMIN_TEXT.fields.coverAlt}
          value={value.alt}
          onChange={(e) => onChange({ ...value, alt: e.target.value })}
          error={Boolean(altError)}
          helperText={altError}
        />
      )}
      {library && (
        <LibraryDialog
          onClose={() => setLibrary(false)}
          onPick={(cover) => {
            onChange(cover);
            setLibrary(false);
            setError(undefined);
          }}
        />
      )}
    </Box>
  );
}
