import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Typography from '@mui/material/Typography';
import InboxOutlined from '@mui/icons-material/InboxOutlined';
import { useTranslation } from 'react-i18next';
import type { Paginated, SortDirection } from '@/core/api/types';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { PAGE_SIZES } from '@/modules/shared/hooks/useListState';
import { visuallyHidden } from './styles';

export interface Column<T, TSort extends string> {
  id: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  /** Server-side sort field; omit for unsortable columns. */
  sortField?: TSort;
  align?: 'left' | 'right' | 'center';
  /** Hide on narrow screens (the column is secondary). */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  /** Header text for screen readers when `label` is visually empty. */
  srLabel?: string;
}

interface DataTableProps<T, TSort extends string> {
  label: string;
  columns: readonly Column<T, TSort>[];
  getRowId: (row: T) => string;
  query: { data: Paginated<T> | undefined; isPending: boolean; isError: boolean; isFetching: boolean; refetch: () => unknown };
  sort: { sortBy: TSort; sortDirection: SortDirection; toggleSort: (field: TSort) => void };
  pagination: { setPage: (page: number) => void; setPageSize: (size: number) => void };
  /** True when search/filters are applied (changes the empty message). */
  filtered: boolean;
}

const SKELETON_ROWS = 5;


/**
 * Server-side table: the parent owns the query and list state; this renders sortable headers, rows,
 * pagination (1-based pages in the API, 0-based in MUI) and the loading / error + retry / empty states.
 * On narrow screens secondary columns hide and the table scrolls horizontally inside its container.
 */
export function DataTable<T, TSort extends string>({ label, columns, getRowId, query, sort, pagination, filtered }: DataTableProps<T, TSort>) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { data } = query;
  const hide = (column: Column<T, TSort>) => (column.hideBelow ? { display: { xs: 'none', [column.hideBelow]: 'table-cell' } } : undefined);

  if (query.isError && !data) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void query.refetch()}>
            {t('actions.retry')}
          </Button>
        }
      >
        {t('list.loadError')}
      </Alert>
    );
  }

  return (
    <Paper variant="outlined" sx={{ position: 'relative', overflow: 'hidden' }}>
      {/* Refetching (paging, sorting, after a change): keep the rows, show progress. */}
      {query.isFetching && data && <LinearProgress aria-hidden sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, height: 2 }} />}
      {/* Positioned, so visually-hidden header text stays inside the horizontal scroll area. */}
      <TableContainer sx={{ position: 'relative' }}>
        {/* Tighter cell padding on phones so the essential columns fit without scrolling. */}
        <Table aria-label={label} aria-busy={query.isFetching || undefined} sx={{ '& .MuiTableCell-root': { px: { xs: 1.25, sm: 2 } } }}>
          <TableHead>
            <TableRow>
              {columns.map((column) => {
                const sortField = column.sortField;
                const active = sortField !== undefined && sort.sortBy === sortField;
                return (
                  <TableCell
                    key={column.id}
                    align={column.align}
                    sortDirection={active ? sort.sortDirection : false}
                    sx={{ whiteSpace: 'nowrap', ...hide(column) }}
                  >
                    {sortField ? (
                      <TableSortLabel active={active} direction={active ? sort.sortDirection : 'asc'} onClick={() => sort.toggleSort(sortField)}>
                        {column.label}
                      </TableSortLabel>
                    ) : (
                      column.label
                    )}
                    {column.srLabel && <Box component="span" sx={visuallyHidden}>{column.srLabel}</Box>}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isPending &&
              Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <TableRow key={i}>
                  {columns.map((column, c) => (
                    <TableCell key={column.id} sx={hide(column)}>
                      {i === 0 && c === 0 && (
                        <Box component="span" role="status" sx={visuallyHidden}>
                          {t('shell.loading')}
                        </Box>
                      )}
                      <Skeleton variant="text" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {data?.items.map((row) => (
              <TableRow key={getRowId(row)} hover>
                {columns.map((column) => (
                  <TableCell key={column.id} align={column.align} sx={hide(column)}>
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {data && data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ borderBottom: 0 }}>
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <InboxOutlined aria-hidden="true" sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">{filtered ? t('list.noResults') : t('list.empty')}</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {data && data.total > 0 && (
        <TablePagination
          component="div"
          count={data.total}
          page={Math.max(0, data.page - 1)}
          rowsPerPage={data.pageSize}
          rowsPerPageOptions={[...PAGE_SIZES]}
          onPageChange={(_, page) => pagination.setPage(page + 1)}
          onRowsPerPageChange={(event) => pagination.setPageSize(Number(event.target.value))}
          labelRowsPerPage={t('list.rowsPerPage')}
          labelDisplayedRows={({ from, to, count }) => t('list.displayedRows', { from: formatNumber(from, language), to: formatNumber(to, language), value: formatNumber(count, language) })}
          getItemAriaLabel={(type) => t(`pagination.${type}`)}
        />
      )}
    </Paper>
  );
}
