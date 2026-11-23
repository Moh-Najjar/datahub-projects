import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import type { ReportColumn, ReportRow } from '@/modules/reports/types/reports';
import { sortRows } from '@/modules/reports/utils/builder';
import { DASH, formatValue, isLtrKind, isNumericKind, label } from '@/modules/reports/utils/format';
import { visuallyHidden } from '@/modules/shared/styles';

/** One cell: identifiers and amounts stay LTR inside Arabic; "not available" is announced, not shown as 0. */
export function ValueCell({ column, value }: { column: ReportColumn; value: ReportRow[string] }) {
  const { t } = useTranslation('reports');
  const { language } = useLanguage();
  const text = formatValue(t, language, column.kind, value ?? null, column.enum);
  if (text === DASH)
    return (
      <Box component="span" sx={{ color: 'text.disabled' }} title={t('view.unavailable')}>
        {DASH}
        <Box component="span" sx={visuallyHidden}>
          {t('view.unavailable')}
        </Box>
      </Box>
    );
  return isLtrKind(column.kind) ? (
    <Box component="bdi" dir="ltr" sx={{ fontVariantNumeric: 'tabular-nums' }}>
      {text}
    </Box>
  ) : (
    <>{text}</>
  );
}

/** The report's records: search, sorting and paging in the browser (the API returned every matching record). */
export function ResultTable({ columns, rows, currency, caption }: { columns: ReportColumn[]; rows: ReportRow[]; currency: string | null; caption: string }) {
  const { t } = useTranslation('reports');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    const list = q ? rows.filter((r) => columns.some((c) => formatValue(t, language, c.kind, r[c.key] ?? null, c.enum).toLocaleLowerCase().includes(q))) : rows;
    return sortRows(list, sort.key, sort.direction);
  }, [rows, columns, search, sort, t, language]);
  const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const toggle = (key: string) => {
    setSort((s) => (s.key === key ? { key, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }));
    setPage(0);
  };

  return (
    <Box sx={{ minWidth: 0 }}>
      <TextField
        size="small"
        type="search"
        label={t('view.search')}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlined fontSize="small" /></InputAdornment> } }}
        sx={{ mb: 1.5, width: { xs: '100%', sm: 320 } }}
      />
      {/* Positioned, so absolutely positioned descendants (screen-reader-only texts) are clipped by its scroll area. */}
      <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto', position: 'relative' }}>
        <Table size="small" aria-label={caption} sx={{ '& .MuiTableCell-root': { px: { xs: 1, sm: 1.5 }, whiteSpace: 'nowrap' } }}>
          <TableHead>
            <TableRow>
              {columns.map((c) => (
                <TableCell key={c.key} align={isNumericKind(c.kind) ? 'right' : undefined} sortDirection={sort.key === c.key ? sort.direction : false} sx={{ fontWeight: 600 }}>
                  <TableSortLabel active={sort.key === c.key} direction={sort.key === c.key ? sort.direction : 'asc'} onClick={() => toggle(c.key)}>
                    {label(t, c.key)}
                    {c.kind === 'money' && currency && (
                      <Box component="span" dir="ltr" sx={{ color: 'text.secondary', fontWeight: 400, ml: 0.5 }}>
                        ({currency})
                      </Box>
                    )}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={Math.max(1, columns.length)}>
                  <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center', whiteSpace: 'normal' }}>
                    {rows.length === 0 ? t('view.noRows') : t('view.noMatches')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visible.map((row, index) => (
              <TableRow key={page * pageSize + index} hover>
                {columns.map((c) => (
                  <TableCell key={c.key} align={isNumericKind(c.kind) ? 'right' : undefined}>
                    <ValueCell column={c} value={row[c.key] ?? null} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {filtered.length > 0 && (
        <TablePagination
          component="div"
          count={filtered.length}
          page={Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1))}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[10, 25, 50, 100]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(0);
          }}
          labelRowsPerPage={tc('list.rowsPerPage')}
          labelDisplayedRows={({ from, to, count }) => tc('list.displayedRows', { from: formatNumber(from, language), to: formatNumber(to, language), value: formatNumber(count, language) })}
          getItemAriaLabel={(type) => tc(`pagination.${type}`)}
        />
      )}
    </Box>
  );
}
