
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined';
import { useTranslation } from 'react-i18next';

import { FilterSelect } from '@/modules/shared/ListToolbar';
import { useFilterOptions } from '@/modules/reports/hooks/useReportLabels';
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, type FilterField, type ReportFilters } from '@/modules/reports/types/reports';
import { enumLabel } from '@/modules/reports/utils/format';

interface Props {
  fields: readonly FilterField[];
  value: ReportFilters;
  onChange: (next: ReportFilters) => void;
  onReset: () => void;
  /** Field errors from the API (`VALIDATION`), keyed by filter. */
  errors?: Readonly<Record<string, string[]>>;
}

/** The filters that apply to the current report (others are not shown). Dates stay LTR (ISO input). */
export function ReportFiltersBar({ fields, value, onChange, onReset, errors }: Props) {
  const { t } = useTranslation('reports');
  const { departments, locations } = useFilterOptions();
  const set = <K extends keyof ReportFilters>(key: K, v: ReportFilters[K]) => onChange({ ...value, [key]: v });
  const error = (key: string) => {
    const reason = errors?.[key]?.[0];
    return reason ? (t(`validation.${reason}` as never, { defaultValue: reason }) as string) : undefined;
  };
  if (!fields.length) return <Typography color="text.secondary">{t('filters.none')}</Typography>;
  const dateField = { flex: '1 1 150px', minWidth: 150, maxWidth: { sm: 190 } };
  return (
    <Box role="group" aria-label={t('filters.label')} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
      {fields.includes('dateRange') && (
        <>
          <TextField size="small" type="date" label={t('filters.from')} value={value.from} onChange={(e) => set('from', e.target.value)} error={!!error('from')} helperText={error('from')} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} sx={dateField} />
          <TextField size="small" type="date" label={t('filters.to')} value={value.to} onChange={(e) => set('to', e.target.value)} error={!!error('to')} helperText={error('to')} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} sx={dateField} />
        </>
      )}
      {fields.includes('departmentId') && <FilterSelect label={t('filters.department')} value={value.departmentId} onChange={(v) => set('departmentId', v)} allLabel={t('filters.allDepartments')} options={departments} />}
      {fields.includes('locationId') && <FilterSelect label={t('filters.location')} value={value.locationId} onChange={(v) => set('locationId', v)} allLabel={t('filters.allLocations')} options={locations} />}
      {fields.includes('employmentType') && (
        <FilterSelect label={t('filters.employmentType')} value={value.employmentType} onChange={(v) => set('employmentType', v as ReportFilters['employmentType'])} allLabel={t('filters.allTypes')} options={EMPLOYMENT_TYPES.map((x) => ({ value: x, label: enumLabel(t, 'employmentType', x) }))} />
      )}
      {fields.includes('employeeStatus') && (
        <FilterSelect label={t('filters.employeeStatus')} value={value.employeeStatus} onChange={(v) => set('employeeStatus', v as ReportFilters['employeeStatus'])} allLabel={t('filters.allStatuses')} options={EMPLOYEE_STATUSES.map((x) => ({ value: x, label: enumLabel(t, 'employeeStatus', x) }))} />
      )}
      <Button variant="text" startIcon={<RestartAltOutlined />} onClick={onReset} sx={{ alignSelf: 'center' }}>
        {t('filters.reset')}
      </Button>
    </Box>
  );
}
