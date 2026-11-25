import type { ReactElement } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import SlideshowOutlinedIcon from '@mui/icons-material/SlideshowOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { radius, status, tint } from '@/core/theme/tokens';
import { formatFileSize } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { useFileOpener } from '../hooks/useFileOpener';
import type { FileItemDto, FileKind } from '../types/content';
import { extensionOf } from '../utils/files';
import { previewTypeOf } from '../utils/openFile';

type Look = { icon: ReactElement; color: string; bg: string };

const LOOKS: Record<string, Look> = {
  pdf: { icon: <PictureAsPdfOutlinedIcon fontSize="small" />, color: status.error, bg: tint.error },
  image: { icon: <ImageOutlinedIcon fontSize="small" />, color: status.success, bg: tint.success },
  doc: { icon: <DescriptionOutlinedIcon fontSize="small" />, color: status.info, bg: tint.info },
  sheet: { icon: <TableChartOutlinedIcon fontSize="small" />, color: status.success, bg: tint.success },
  slides: { icon: <SlideshowOutlinedIcon fontSize="small" />, color: status.warning, bg: tint.warning },
  video: { icon: <MovieOutlinedIcon fontSize="small" />, color: status.info, bg: tint.info },
  archive: { icon: <FolderZipOutlinedIcon fontSize="small" />, color: status.warning, bg: tint.warning },
  other: { icon: <InsertDriveFileOutlinedIcon fontSize="small" />, color: 'text.secondary', bg: 'grey.100' },
};

const GROUPS: Record<string, keyof typeof LOOKS> = {
  '.pdf': 'pdf',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.svg': 'image',
  '.doc': 'doc', '.docx': 'doc', '.txt': 'doc', '.md': 'doc',
  '.xls': 'sheet', '.xlsx': 'sheet',
  '.ppt': 'slides', '.pptx': 'slides',
  '.mp4': 'video', '.mov': 'video', '.avi': 'video', '.mkv': 'video',
  '.zip': 'archive', '.rar': 'archive', '.7z': 'archive',
};

const lookOf = (fileName: string): Look => LOOKS[GROUPS[extensionOf(fileName)] ?? 'other']!;

interface FileListProps {
  files: readonly FileItemDto[];
  /** Which download endpoint the files belong to. */
  kind: FileKind;
  /** Accessible name of the list. */
  label: string;
  /** Shows an edit button on each file (e.g. its title). */
  onEdit?: (file: FileItemDto) => void;
  /** Shows a remove button on each file. */
  onRemove?: (file: FileItemDto) => void;
}

/**
 * Stored files as rows: type icon, name (click = show it in a new tab when the browser can, else download), type and
 * size, a Download button and — when allowed — Remove. Used for training materials, assignment attachments and submissions.
 */
export function FileList({ files, kind, label, onEdit, onRemove }: FileListProps) {
  const t = useT();
  const { locale } = useLocale();
  const opener = useFileOpener(kind);

  return (
    <Box
      component="ul"
      aria-label={label}
      sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(280px, 1fr))' } }}
    >
      {files.map((file) => {
        const name = file.title || file.fileName;
        const look = lookOf(file.fileName);
        const extension = extensionOf(file.fileName).slice(1).toUpperCase();
        const pending = opener.pendingId === file.id;
        const showable = previewTypeOf(file) !== null;
        return (
          <Box
            component="li"
            key={file.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              minWidth: 0,
              py: 1,
              pl: 1.25,
              pr: 0.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: `${radius.md}px`,
              bgcolor: 'background.paper',
              transition: 'border-color .15s',
              '&:hover': { borderColor: 'primary.light' },
            }}
          >
            <Box aria-hidden sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: `${radius.sm}px`, display: 'grid', placeItems: 'center', color: look.color, bgcolor: look.bg }}>
              {look.icon}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Tooltip title={showable ? t.files.open : t.files.download} placement="top-start" describeChild>
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  onClick={() => opener.open(file)}
                  disabled={pending}
                  sx={{ display: 'block', maxWidth: '100%', fontWeight: 600, fontSize: 14, color: 'text.primary', textAlign: 'start', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {name}
                </Link>
              </Tooltip>
              <Typography variant="caption" color="text.secondary" component="p" noWrap>
                {[file.title && file.title !== file.fileName ? file.fileName : extension, formatFileSize(file.fileSizeBytes, locale)].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
            {pending ? (
              <Box sx={{ width: 34, display: 'grid', placeItems: 'center' }} role="status" aria-label={t.files.opening}>
                <CircularProgress size={18} />
              </Box>
            ) : (
              <Tooltip title={t.files.download}>
                <IconButton size="small" aria-label={`${t.files.download}: ${name}`} onClick={() => opener.download(file)}>
                  <DownloadOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {onEdit && (
              <Tooltip title={t.common.edit}>
                <IconButton size="small" aria-label={`${t.common.edit}: ${name}`} onClick={() => onEdit(file)}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {onRemove && (
              <Tooltip title={t.common.delete}>
                <IconButton size="small" aria-label={`${t.common.delete}: ${name}`} onClick={() => onRemove(file)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
