import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useAuth } from '@/core/auth/authContext';
import { isDepartmentScoped } from '@/core/auth/trainingPolicy';
import { useT } from '@/i18n/useT';
import { useDepartmentOptions } from '@/modules/departments';
import { FilterSelect } from '@/modules/shared/FilterBar';
import { LoadingState } from '@/modules/shared/states';
import { StatusChip } from '@/modules/shared/StatusChip';
import { apiErrorMessage } from '@/modules/shared/utils/apiMessage';
import { useReorderTrainings, useTrainingOptions } from '../hooks/useTrainings';
import { SortableList } from './SortableList';

/**
 * Manual order of trainings (drag and drop, or the up/down buttons). Order is per department — the original rule —
 * so one department is edited at a time (a DepartmentAdmin has only their own). Saving stores the new positions.
 */
export function ReorderDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const { actor } = useAuth();
  const scoped = actor ? isDepartmentScoped(actor) : false;
  const options = useTrainingOptions();
  const departments = useDepartmentOptions();
  const reorder = useReorderTrainings();
  const [departmentId, setDepartmentId] = useState<string | undefined>(scoped ? (actor?.departmentId ?? undefined) : undefined);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [failure, setFailure] = useState<unknown>(null);

  const departmentList = useMemo(() => {
    const first = departmentId ?? options.data?.[0]?.departmentId;
    return { id: first, items: (options.data ?? []).filter((tr) => tr.departmentId === first) };
  }, [options.data, departmentId]);

  // The draft order is only meaningful for the department it was made in.
  const items = useMemo(() => {
    if (!draft) return departmentList.items;
    const byId = new Map(departmentList.items.map((i) => [i.id, i]));
    return draft.map((id) => byId.get(id)).filter((i): i is (typeof departmentList.items)[number] => !!i);
  }, [draft, departmentList]);

  const save = async () => {
    setFailure(null);
    try {
      await reorder.mutateAsync(items.map((i) => i.id));
      onSaved();
      onClose();
    } catch (error) {
      setFailure(error);
    }
  };

  return (
    <Dialog open onClose={reorder.isPending ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="reorder-title">
      <DialogTitle id="reorder-title">{t.trainings.reorder.title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{t.trainings.reorder.hint}</DialogContentText>
        {!scoped && (
          <Box sx={{ mb: 2 }}>
            <FilterSelect
              label={t.trainings.fields.department}
              value={departmentList.id}
              options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))}
              allLabel={t.trainings.reorder.firstDepartment}
              onChange={(value) => {
                setDepartmentId(value);
                setDraft(null);
              }}
              minWidth={240}
            />
          </Box>
        )}
        {options.isLoading && <LoadingState minHeight={160} />}
        {options.data && items.length === 0 && <Typography color="text.secondary">{t.trainings.reorder.none}</Typography>}
        {items.length > 0 && (
          <SortableList
            label={t.trainings.reorder.title}
            items={items}
            getId={(item) => item.id}
            onReorder={(ids) => setDraft(ids)}
            disabled={reorder.isPending}
            renderItem={(item, { index }) => (
              <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 24, fontVariantNumeric: 'tabular-nums' }}>
                  {index + 1}
                </Typography>
                <Typography sx={{ flex: 1, fontWeight: 500 }}>{item.title}</Typography>
                <Stack direction="row">
                  <StatusChip kind="training" value={item.status} />
                </Stack>
              </Paper>
            )}
          />
        )}
        {failure != null && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {apiErrorMessage(t, failure)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={reorder.isPending}>
          {t.common.cancel}
        </Button>
        <Button variant="contained" onClick={save} disabled={reorder.isPending || draft === null}>
          {reorder.isPending ? t.common.saving : t.trainings.reorder.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
