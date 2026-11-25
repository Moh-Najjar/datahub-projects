import { useState, type ReactElement } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { safeHttpUrl } from '@/core/utils/safeUrl';
import { fill } from '@/i18n';
import { useT } from '@/i18n/useT';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';
import { useFeedback } from '@/modules/shared/hooks/feedbackContext';
import { EmptyState, ErrorState, SkeletonBlock } from '@/modules/shared/states';
import { useMaterials, useMaterialMutations } from '../hooks/useTrainings';
import type { FileItemDto, MaterialDto, MaterialType } from '../types/content';
import { FileList } from './FileList';
import { AddFilesDialog, FileMaterialDialog, FileTitleDialog, LinkMaterialDialog, TextMaterialDialog } from './MaterialDialogs';
import { SortableList } from './SortableList';

const TYPE_ICONS: Record<MaterialType, ReactElement> = { text: <ArticleOutlinedIcon />, link: <LinkIcon />, file: <AttachFileIcon /> };

type Dialog =
  | { kind: 'text'; material: MaterialDto | null }
  | { kind: 'link'; material: MaterialDto | null }
  | { kind: 'file'; material: MaterialDto | null }
  | { kind: 'addFiles'; material: MaterialDto }
  | { kind: 'fileTitle'; material: MaterialDto; file: FileItemDto };

/** Learning materials of a training: text, links and files — viewed by learners, managed (and ordered) by authors. */
export function ContentTab({ trainingId, canAuthor }: { trainingId: string; canAuthor: boolean }) {
  const t = useT();
  const feedback = useFeedback();
  const query = useMaterials(trainingId);
  const mutations = useMaterialMutations(trainingId);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [deleting, setDeleting] = useState<MaterialDto | null>(null);
  const [deletingFile, setDeletingFile] = useState<{ material: MaterialDto; file: FileItemDto } | null>(null);
  const saved = () => feedback.success(t.content.saved);
  const common = { trainingId, onClose: () => setDialog(null), onSaved: saved };

  const addMenu = canAuthor && (
    <>
      <Button variant="contained" startIcon={<AddIcon />} onClick={(e) => setAddAnchor(e.currentTarget)} aria-haspopup="menu">
        {t.content.add}
      </Button>
      <Menu anchorEl={addAnchor} open={addAnchor !== null} onClose={() => setAddAnchor(null)}>
        {(['text', 'link', 'file'] as const).map((kind) => (
          <MenuItem
            key={kind}
            onClick={() => {
              setAddAnchor(null);
              setDialog({ kind, material: null });
            }}
          >
            {t.content.addByType[kind]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );

  const reorder = async (orderedIds: string[]) => {
    try {
      await mutations.reorder.mutateAsync(orderedIds);
      feedback.success(t.content.reordered);
    } catch {
      feedback.error(t.errors.generic);
    }
  };

  if (query.isLoading) return <SkeletonBlock lines={5} height={28} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} dense />;
  const materials = query.data ?? [];

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }} spacing={2}>
        <Typography color="text.secondary">{canAuthor ? t.content.hintAuthor : t.content.hintLearner}</Typography>
        {addMenu}
      </Stack>

      {materials.length === 0 ? (
        <Card>
          <EmptyState icon={<FolderOpenOutlinedIcon />} title={t.content.empty.title} description={canAuthor ? t.content.empty.bodyAuthor : t.content.empty.bodyLearner} action={addMenu || undefined} />
        </Card>
      ) : (
        <SortableList
          label={t.content.title}
          items={materials}
          getId={(m) => m.id}
          disabled={!canAuthor || mutations.reorder.isPending}
          onReorder={reorder}
          renderItem={(material) => (
            <MaterialCard
              material={material}
              canAuthor={canAuthor}
              onEdit={() => setDialog({ kind: material.type, material })}
              onDelete={() => setDeleting(material)}
              onAddFiles={() => setDialog({ kind: 'addFiles', material })}
              onEditFile={(file) => setDialog({ kind: 'fileTitle', material, file })}
              onDeleteFile={(file) => setDeletingFile({ material, file })}
            />
          )}
        />
      )}

      {dialog?.kind === 'text' && <TextMaterialDialog {...common} material={dialog.material} />}
      {dialog?.kind === 'link' && <LinkMaterialDialog {...common} material={dialog.material} />}
      {dialog?.kind === 'file' && <FileMaterialDialog {...common} material={dialog.material} />}
      {dialog?.kind === 'addFiles' && <AddFilesDialog {...common} material={dialog.material} />}
      {dialog?.kind === 'fileTitle' && <FileTitleDialog {...common} material={dialog.material} file={dialog.file} />}
      <ConfirmDialog
        open={deleting !== null}
        title={t.content.delete.title}
        message={fill(t.content.delete.message, { title: deleting?.title ?? '' })}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await mutations.remove.mutateAsync(deleting.id);
          feedback.success(t.content.deleted);
        }}
        onClose={() => setDeleting(null)}
      />
      <ConfirmDialog
        open={deletingFile !== null}
        title={t.content.deleteFile.title}
        message={fill(t.content.deleteFile.message, { name: deletingFile?.file.fileName ?? '' })}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          if (!deletingFile) return;
          await mutations.deleteFileItem.mutateAsync({ id: deletingFile.material.id, fileId: deletingFile.file.id });
          feedback.success(t.content.deleted);
        }}
        onClose={() => setDeletingFile(null)}
      />
    </Box>
  );
}

interface MaterialCardProps {
  material: MaterialDto;
  canAuthor: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddFiles: () => void;
  onEditFile: (file: FileItemDto) => void;
  onDeleteFile: (file: FileItemDto) => void;
}

function MaterialCard({ material, canAuthor, onEdit, onDelete, onAddFiles, onEditFile, onDeleteFile }: MaterialCardProps) {
  const t = useT();
  return (
    <Card sx={{ p: 2.5, height: '100%' }} component="article" aria-label={material.title}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Box aria-hidden sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.main' }}>
          {TYPE_ICONS[material.type]}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h6" component="h3" sx={{ overflowWrap: 'anywhere' }}>
              {material.title}
            </Typography>
            <Chip size="small" variant="outlined" label={t.enums.materialType[material.type]} />
          </Stack>
          {material.type === 'text' && (
            <Typography sx={{ mt: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{material.textContent}</Typography>
          )}
          {material.type === 'link' && (
            <Stack component="ul" spacing={0.75} sx={{ mt: 1, p: 0, m: 0, listStyle: 'none' }} aria-label={material.title}>
              {material.links.map((link) => (
                <li key={link.id}>
                  {safeHttpUrl(link.url) ? (
                    <Link href={safeHttpUrl(link.url)!} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, overflowWrap: 'anywhere' }}>
                      {link.title || link.url}
                      <OpenInNewIcon sx={{ fontSize: 15 }} aria-hidden />
                    </Link>
                  ) : (
                    // No usable address: plain text, never a link that would reopen this app.
                    <Typography component="span" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                      {link.title || link.url || t.content.linkUnavailable}
                    </Typography>
                  )}
                  {link.title && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} dir="ltr">
                      {link.url}
                    </Typography>
                  )}
                </li>
              ))}
            </Stack>
          )}
          {material.type === 'file' && (
            <Box sx={{ mt: 1 }}>
              <FileList files={material.files} kind="material" label={material.title} onEdit={canAuthor ? onEditFile : undefined} onRemove={canAuthor ? onDeleteFile : undefined} />
              {canAuthor && (
                <Button size="small" startIcon={<AddIcon />} onClick={onAddFiles} sx={{ mt: 1 }}>
                  {t.content.addMoreFiles}
                </Button>
              )}
            </Box>
          )}
        </Box>
        {canAuthor && (
          <Stack direction="row" sx={{ flexShrink: 0 }}>
            <Tooltip title={t.common.edit}>
              <IconButton size="small" aria-label={`${t.common.edit}: ${material.title}`} onClick={onEdit}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t.common.delete}>
              <IconButton size="small" color="error" aria-label={`${t.common.delete}: ${material.title}`} onClick={onDelete}>
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
